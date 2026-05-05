import { useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useCreateExpense } from '@/hooks/useExpenses';
import { useTrip } from '@/hooks/useTrips';
import { useAuthStore } from '@/stores/authStore';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Sparkles, Camera, Users, AlertCircle, Mic, MicOff } from 'lucide-react';
import { aiService } from '@/services/aiService';
import type { ExpenseCategory, SplitType } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const CATEGORIES: ExpenseCategory[] = [
  'FOOD', 'TRANSPORT', 'ACCOMMODATION', 'ACTIVITIES', 'SHOPPING',
  'HEALTH', 'COMMUNICATION', 'ENTERTAINMENT', 'FEES', 'MISCELLANEOUS',
];

export default function CreateExpensePage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const { data: trip, isLoading: tripLoading } = useTrip(tripId!);
  const createExpense = useCreateExpense(tripId!);

  const [form, setForm] = useState({
    title: '',
    amount: '',
    currency: '',
    category: 'FOOD' as ExpenseCategory,
    description: '',
    date: new Date().toISOString().split('T')[0],
    splitType: 'EQUAL' as SplitType,
    paidById: '',
  });

  // Per-member split details: { [userId]: value }
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});

  const [nlpInput, setNlpInput] = useState('');
  const [nlpLoading, setNlpLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  if (tripLoading || !trip) return <PageLoader />;

  if (!form.currency && trip.budgetCurrency) {
    setForm((prev) => ({ ...prev, currency: trip.budgetCurrency }));
  }

  if (!form.paidById && currentUser?.id) {
    setForm((prev) => ({ ...prev, paidById: currentUser.id }));
  }

  const members = trip.members ?? [];

  // ---------- Split helpers ----------
  const totalAmount = Number(form.amount) || 0;

  const splitSummary = useMemo(() => {
    if (form.splitType === 'PERCENTAGE') {
      const total = Object.values(splitValues).reduce((s, v) => s + (Number(v) || 0), 0);
      return { total, valid: Math.abs(total - 100) < 0.01, label: `${total.toFixed(1)}% of 100%` };
    }
    if (form.splitType === 'EXACT') {
      const total = Object.values(splitValues).reduce((s, v) => s + (Number(v) || 0), 0);
      return { total, valid: Math.abs(total - totalAmount) < 0.01, label: `${form.currency} ${total.toFixed(2)} of ${form.currency} ${totalAmount.toFixed(2)}` };
    }
    if (form.splitType === 'SHARES') {
      const total = Object.values(splitValues).reduce((s, v) => s + (Number(v) || 0), 0);
      return { total, valid: total > 0, label: `${total} total shares` };
    }
    return { total: 0, valid: true, label: '' };
  }, [form.splitType, splitValues, totalAmount, form.currency]);

  const updateSplitValue = (userId: string, value: string) => {
    setSplitValues((prev) => ({ ...prev, [userId]: value }));
  };

  // When switching split type, reset split values with sensible defaults.
  // Values represent CONTRIBUTIONS (how much each person paid), not what they owe.
  // Payer is pre-filled with the full amount; others start at 0.
  const handleSplitTypeChange = (newType: string) => {
    const payer = form.paidById || currentUser?.id || '';
    setForm((prev) => ({ ...prev, splitType: newType as SplitType }));
    const defaults: Record<string, string> = {};
    if (newType === 'PERCENTAGE') {
      // Payer contributed 100%, others 0%
      members.forEach((m) => { defaults[m.userId] = m.userId === payer ? '100' : '0'; });
    } else if (newType === 'EXACT') {
      // Payer contributed the full amount
      members.forEach((m) => { defaults[m.userId] = m.userId === payer ? (totalAmount > 0 ? totalAmount.toFixed(2) : '') : '0'; });
    } else if (newType === 'SHARES') {
      members.forEach((m) => { defaults[m.userId] = '1'; });
    }
    setSplitValues(defaults);
  };

  const toggleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return; // Browser doesn't support speech recognition

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript;
      setNlpInput(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const handleNLP = async () => {
    if (!nlpInput.trim()) return;
    setNlpLoading(true);
    try {
      const result = await aiService.parseNaturalLanguage(nlpInput);
      setForm((prev) => ({
        ...prev,
        title: result.title || prev.title,
        amount: result.amount?.toString() || prev.amount,
        currency: result.currency || prev.currency,
        category: result.category || prev.category,
        splitType: result.splitType || prev.splitType,
      }));
    } catch {
      // Silently fail—user can still fill manually
    } finally {
      setNlpLoading(false);
    }
  };

  const handleReceiptScan = async (file: File) => {
    try {
      const result = await aiService.scanReceipt(file);
      setForm((prev) => ({
        ...prev,
        title: result.title || prev.title,
        amount: result.amount?.toString() || prev.amount,
        currency: result.currency || prev.currency,
        category: result.category || prev.category,
        date: result.date || prev.date,
        description: result.description || prev.description,
      }));
    } catch {
      // Silently fail
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Build splits based on split type
    let splits;
    if (form.splitType === 'EQUAL') {
      splits = members.map((m) => ({ userId: m.userId }));
    } else if (form.splitType === 'PERCENTAGE') {
      splits = members.map((m) => ({
        userId: m.userId,
        percentage: Number(splitValues[m.userId]) || 0,
      }));
    } else if (form.splitType === 'EXACT') {
      splits = members.map((m) => ({
        userId: m.userId,
        amount: Number(splitValues[m.userId]) || 0,
      }));
    } else if (form.splitType === 'SHARES') {
      splits = members.map((m) => ({
        userId: m.userId,
        shares: Number(splitValues[m.userId]) || 1,
      }));
    }

    createExpense.mutate(
      {
        title: form.title,
        amount: Number(form.amount),
        currency: form.currency || trip.budgetCurrency,
        category: form.category,
        description: form.description || undefined,
        date: new Date(form.date).toISOString(),
        splitType: form.splitType,
        splits,
        tripId: tripId!,
        paidById: form.paidById || currentUser!.id,
      },
      { onSuccess: () => navigate(`/trips/${tripId}/expenses`) }
    );
  };

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/trips/${tripId}/expenses`}><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Add Expense</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{trip.name}</p>
        </div>
      </div>

      {/* AI Quick Entry */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> AI Quick Entry
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                value={nlpInput}
                onChange={(e) => setNlpInput(e.target.value)}
                placeholder={isListening ? 'Listening… speak now' : 'e.g. "Lunch at seafood restaurant $45 split equally"'}
                className="pr-10"
                onKeyDown={(e) => e.key === 'Enter' && handleNLP()}
              />
              {/* Mic button — Web Speech API */}
              {'SpeechRecognition' in window || 'webkitSpeechRecognition' in window ? (
                <button
                  type="button"
                  onClick={toggleVoice}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors ${isListening ? 'text-destructive animate-pulse' : 'text-muted-foreground hover:text-foreground'}`}
                  title={isListening ? 'Stop recording' : 'Speak your expense'}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              ) : null}
            </div>
            <Button variant="secondary" onClick={handleNLP} disabled={nlpLoading} className="shrink-0">
              {nlpLoading ? 'Parsing…' : 'Parse'}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" asChild className="cursor-pointer">
              <label>
                <Camera className="h-4 w-4 mr-2" /> Scan Receipt
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleReceiptScan(e.target.files[0])} />
              </label>
            </Button>
          </div>
        </CardContent>
      </Card>

      {createExpense.isError && (
        <Alert variant="destructive">
          <AlertDescription>{(createExpense.error as Error)?.message || 'Failed to create expense'}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="p-6 space-y-5">
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="What was this expense for?" required className="mt-1.5" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Amount *</Label>
                <Input type="number" value={form.amount} onChange={(e) => update('amount', e.target.value)} placeholder="0.00" min="0.01" step="0.01" required className="mt-1.5" />
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={(v) => update('currency', v)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['USD', 'EUR', 'GBP', 'JPY', 'INR', 'AUD', 'CAD', 'CHF', 'SGD', 'THB'].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={(v) => update('category', v)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => update('date', e.target.value)} className="mt-1.5 dark:[color-scheme:dark]" />
              </div>
            </div>

            {/* Paid By */}
            <div>
              <Label className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Paid By *
              </Label>
              <Select value={form.paidById} onValueChange={(v) => update('paidById', v)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Who paid?" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">
                          {m.user?.name?.charAt(0).toUpperCase()}
                        </div>
                        {m.user?.name}
                        {m.userId === currentUser?.id && (
                          <span className="text-xs text-muted-foreground">(You)</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Split Type</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1.5">
                {(['EQUAL', 'PERCENTAGE', 'EXACT', 'SHARES'] as SplitType[]).map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant="outline"
                    onClick={() => handleSplitTypeChange(s)}
                    className={cn(
                      'text-xs font-medium',
                      form.splitType === s && 'border-primary bg-primary/10 text-primary'
                    )}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>

            {/* ─── Split Details ─── */}
            {members.length > 0 && form.amount && (
              <div className="bg-muted rounded-lg p-4 space-y-3">
                {/* EQUAL Split Preview */}
                {form.splitType === 'EQUAL' && (
                  <>
                    <p className="text-xs font-medium text-muted-foreground">Equal Split — who paid what</p>
                    <div className="space-y-1.5">
                      {members.map((m) => {
                        const isPayer = m.userId === (form.paidById || currentUser?.id);
                        const fairShare = members.length > 0 ? totalAmount / members.length : 0;
                        const contributed = isPayer ? totalAmount : 0;
                        const net = contributed - fairShare;
                        return (
                          <div key={m.userId} className="flex justify-between text-sm items-center">
                            <span className="text-muted-foreground">{m.user?.name}{isPayer && <span className="ml-1 text-xs text-primary">(payer)</span>}</span>
                            <div className="text-right">
                              <span className="font-medium">{form.currency} {contributed.toFixed(2)} paid</span>
                              <span className={cn('ml-2 text-xs', net > 0 ? 'text-green-600' : net < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                                {net > 0 ? `+${form.currency} ${net.toFixed(2)}` : net < 0 ? `-${form.currency} ${Math.abs(net).toFixed(2)}` : 'settled'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">Fair share per person: {form.currency} {members.length > 0 ? (totalAmount / members.length).toFixed(2) : '0.00'}</p>
                  </>
                )}

                {/* PERCENTAGE Split */}
                {form.splitType === 'PERCENTAGE' && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Who paid what % of the bill?</p>
                      <span className={cn(
                        'text-xs font-semibold',
                        splitSummary.valid ? 'text-green-600' : 'text-destructive'
                      )}>
                        {splitSummary.label}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {members.map((m) => {
                        const pct = Number(splitValues[m.userId]) || 0;
                        const contributed = totalAmount > 0 ? (totalAmount * pct / 100) : 0;
                        const fairShare = members.length > 0 ? totalAmount / members.length : 0;
                        const net = contributed - fairShare;
                        return (
                          <div key={m.userId} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                            <span className="text-sm text-muted-foreground sm:w-24 truncate">{m.user?.name}</span>
                            <div className="flex-1 flex items-center gap-2">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={splitValues[m.userId] ?? ''}
                                onChange={(e) => updateSplitValue(m.userId, e.target.value)}
                                placeholder="0"
                                className="h-8 text-sm"
                              />
                              <span className="text-xs text-muted-foreground w-6">%</span>
                            </div>
                            <div className="text-right sm:w-28">
                              <div className="text-xs font-medium">{form.currency} {contributed.toFixed(2)}</div>
                              {splitSummary.valid && totalAmount > 0 && (
                                <div className={cn('text-[10px]', net > 0.005 ? 'text-green-600' : net < -0.005 ? 'text-destructive' : 'text-muted-foreground')}>
                                  {net > 0.005 ? `owed +${net.toFixed(2)}` : net < -0.005 ? `owes ${Math.abs(net).toFixed(2)}` : 'settled'}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {!splitSummary.valid && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Percentages must add up to 100% (full bill must be accounted for)
                      </p>
                    )}
                  </>
                )}

                {/* EXACT Split */}
                {form.splitType === 'EXACT' && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">How much did each person pay?</p>
                      <span className={cn(
                        'text-xs font-semibold',
                        splitSummary.valid ? 'text-green-600' : 'text-destructive'
                      )}>
                        {splitSummary.label}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {members.map((m) => {
                        const contributed = Number(splitValues[m.userId]) || 0;
                        const fairShare = members.length > 0 ? totalAmount / members.length : 0;
                        const net = contributed - fairShare;
                        return (
                          <div key={m.userId} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                            <span className="text-sm text-muted-foreground sm:w-24 truncate">{m.user?.name}</span>
                            <div className="flex-1 flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{form.currency}</span>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={splitValues[m.userId] ?? ''}
                                onChange={(e) => updateSplitValue(m.userId, e.target.value)}
                                placeholder="0.00"
                                className="h-8 text-sm"
                              />
                            </div>
                            {splitSummary.valid && totalAmount > 0 && (
                              <div className={cn('text-[10px] text-right sm:w-20', net > 0.005 ? 'text-green-600' : net < -0.005 ? 'text-destructive' : 'text-muted-foreground')}>
                                {net > 0.005 ? `owed +${net.toFixed(2)}` : net < -0.005 ? `owes ${Math.abs(net).toFixed(2)}` : 'settled'}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {!splitSummary.valid && totalAmount > 0 && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Contributions must add up to {form.currency} {totalAmount.toFixed(2)} (the full bill)
                      </p>
                    )}
                  </>
                )}

                {/* SHARES Split */}
                {form.splitType === 'SHARES' && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Contribution shares (proportional to how much each paid)</p>
                      <span className="text-xs font-semibold text-muted-foreground">{splitSummary.label}</span>
                    </div>
                    <div className="space-y-2">
                      {members.map((m) => {
                        const shares = Number(splitValues[m.userId]) || 0;
                        const totalShares = splitSummary.total;
                        const contributed = totalShares > 0 ? (totalAmount * shares / totalShares) : 0;
                        const fairShare = members.length > 0 ? totalAmount / members.length : 0;
                        const net = contributed - fairShare;
                        return (
                          <div key={m.userId} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                            <span className="text-sm text-muted-foreground sm:w-24 truncate">{m.user?.name}</span>
                            <div className="flex-1 flex items-center gap-2">
                              <Input
                                type="number"
                                min="0"
                                step="1"
                                value={splitValues[m.userId] ?? ''}
                                onChange={(e) => updateSplitValue(m.userId, e.target.value)}
                                placeholder="1"
                                className="h-8 text-sm"
                              />
                              <span className="text-xs text-muted-foreground w-12">shares</span>
                            </div>
                            <div className="text-right sm:w-24">
                              <div className="text-xs font-medium">{form.currency} {contributed.toFixed(2)}</div>
                              {totalShares > 0 && totalAmount > 0 && (
                                <div className={cn('text-[10px]', net > 0.005 ? 'text-green-600' : net < -0.005 ? 'text-destructive' : 'text-muted-foreground')}>
                                  {net > 0.005 ? `owed +${net.toFixed(2)}` : net < -0.005 ? `owes ${Math.abs(net).toFixed(2)}` : 'settled'}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            <div>
              <Label>Notes</Label>
              <Textarea value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Optional notes..." className="mt-1.5 min-h-[60px]" />
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" asChild className="flex-1">
                <Link to={`/trips/${tripId}/expenses`}>Cancel</Link>
              </Button>
              <Button type="submit" disabled={createExpense.isPending} className="flex-1">
                {createExpense.isPending ? 'Adding...' : 'Add Expense'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
