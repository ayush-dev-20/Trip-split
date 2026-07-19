import { useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router';
import { useCreateExpense } from '@/hooks/useExpenses';
import { useTrip } from '@/hooks/useTrips';
import { useAuthStore } from '@/stores/authStore';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import UserAvatar from '@/components/ui/UserAvatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sparkles, Camera, AlertCircle, Mic, MicOff, Loader2, Receipt, Lock, X } from 'lucide-react';
import { aiService } from '@/services/aiService';
import type { ExpenseCategory, SplitType, ItemizedReceipt, ExpenseItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import ItemizedSplitEditor from '@/components/expenses/ItemizedSplitEditor';
import { CATEGORY_STYLES } from '@/lib/categoryStyle';
import { cn } from '@/lib/utils';

const SPLIT_TYPES: { value: SplitType; label: string; hint: string }[] = [
  { value: 'EQUAL',      label: 'Equal',       hint: 'Split evenly' },
  { value: 'PERCENTAGE', label: 'Percentage',  hint: 'By %' },
  { value: 'EXACT',      label: 'Exact',       hint: 'Custom amounts' },
  { value: 'SHARES',     label: 'Shares',      hint: 'Proportional' },
];

const CATEGORIES: ExpenseCategory[] = [
  'FOOD', 'GROCERIES', 'TRANSPORT', 'ACCOMMODATION', 'ACTIVITIES', 'SHOPPING',
  'HEALTH', 'COMMUNICATION', 'ENTERTAINMENT', 'FEES', 'MISCELLANEOUS',
];

export default function CreateExpensePage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const suggestedPayerId = (location.state as { suggestedPayerId?: string } | null)?.suggestedPayerId;
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

  // Itemized receipt splitting (PRO feature)
  const [itemizedReceipt, setItemizedReceipt] = useState<ItemizedReceipt | null>(null);
  const [itemizedResult, setItemizedResult] = useState<{ perUser: { userId: string; owedAmount: number }[]; items: ExpenseItem[] } | null>(null);
  const [itemizeLoading, setItemizeLoading] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const tier = currentUser?.tier ?? 'FREE';
  const isPro = tier !== 'FREE';

  if (tripLoading || !trip) return <PageLoader />;

  if (!form.currency && trip.budgetCurrency) {
    setForm((prev) => ({ ...prev, currency: trip.budgetCurrency }));
  }

  if (!form.paidById && (suggestedPayerId || currentUser?.id)) {
    setForm((prev) => ({ ...prev, paidById: suggestedPayerId ?? currentUser!.id }));
  }

  const members = trip.members ?? [];

  // Stable reference for ItemizedSplitEditor — an inline `.map()` in JSX would
  // create a new array every render, which (combined with the totals useMemo
  // inside the editor) caused an infinite onChange -> setState -> render loop.
  const itemizedMembers = useMemo(
    () => members.map((m) => ({ id: m.userId, name: m.user?.name ?? '' })),
    [members]
  );

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
    // Amount/currency are locked to the scanned itemized receipt while it's active —
    // don't let AI quick entry silently overwrite them (see handleReceiptScan).
    if (!nlpInput.trim() || itemizedReceipt) return;
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
    // Amount/currency are locked to the scanned itemized receipt while it's active —
    // a plain (non-itemized) rescan must not silently overwrite them and desync
    // itemizedResult.perUser from form.amount.
    if (itemizedReceipt) return;
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

  const handleItemizedScan = async (file: File) => {
    if (!isPro) {
      setShowUpgradeDialog(true);
      return;
    }
    setItemizeLoading(true);
    try {
      const receipt = await aiService.scanReceiptItems(file);
      setItemizedReceipt(receipt);
      setForm((prev) => ({
        ...prev,
        title: receipt.vendor || prev.title,
        amount: receipt.total?.toString() || prev.amount,
        currency: receipt.currency || prev.currency,
        category: (receipt.category as ExpenseCategory) || prev.category,
        date: receipt.date || prev.date,
        splitType: 'EXACT',
      }));
    } catch (err) {
      const code = (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
      if (code === 'UPGRADE_REQUIRED') {
        setShowUpgradeDialog(true);
      }
      // Otherwise silently fail—user can still fill manually
    } finally {
      setItemizeLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payerId = form.paidById || currentUser!.id;
    const amount = Number(form.amount);

    // Itemized save: payer's contribution = full amount, others 0;
    // owedAmount per person comes from the editor's proportional split.
    if (itemizedReceipt && itemizedResult) {
      const splits = members.map((m) => {
        const owed = itemizedResult.perUser.find((p) => p.userId === m.userId)?.owedAmount ?? 0;
        return {
          userId: m.userId,
          amount: m.userId === payerId ? amount : 0,
          owedAmount: owed,
        };
      });

      createExpense.mutate(
        {
          title: form.title,
          amount,
          currency: form.currency || trip.budgetCurrency,
          category: form.category,
          description: form.description || undefined,
          date: new Date(form.date).toISOString(),
          splitType: 'EXACT',
          splits,
          items: itemizedResult.items,
          tripId: tripId!,
          paidById: payerId,
        },
        { onSuccess: () => navigate(`/trips/${tripId}/expenses`) }
      );
      return;
    }

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
        amount,
        currency: form.currency || trip.budgetCurrency,
        category: form.category,
        description: form.description || undefined,
        date: new Date(form.date).toISOString(),
        splitType: form.splitType,
        splits,
        tripId: tripId!,
        paidById: payerId,
      },
      { onSuccess: () => navigate(`/trips/${tripId}/expenses`) }
    );
  };

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  // Clears the itemized receipt split and restores manual split-type selection.
  const handleClearItemized = () => {
    setItemizedReceipt(null);
    setItemizedResult(null);
    handleSplitTypeChange('EQUAL');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <PageHeader
        title="Add Expense"
        description={trip.name}
        back={`/trips/${tripId}/expenses`}
      />

      {/* AI Quick Entry */}
      <Card className="bg-gradient-to-br from-primary/5 to-info/5 border-primary/10">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <p className="text-sm font-semibold">AI Quick Entry</p>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                value={nlpInput}
                onChange={(e) => setNlpInput(e.target.value)}
                placeholder={isListening ? 'Listening… speak now' : 'e.g. "Lunch $45 split equally"'}
                className="pr-10 h-10 bg-background"
                onKeyDown={(e) => e.key === 'Enter' && handleNLP()}
                disabled={!!itemizedReceipt}
              />
              {('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) && (
                <button
                  type="button"
                  onClick={toggleVoice}
                  disabled={!!itemizedReceipt}
                  className={cn(
                    'absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors',
                    isListening ? 'text-destructive animate-pulse' : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                    itemizedReceipt && 'opacity-40 pointer-events-none'
                  )}
                  title={isListening ? 'Stop recording' : 'Speak your expense'}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
            </div>
            <Button variant="secondary" onClick={handleNLP} disabled={nlpLoading || !nlpInput.trim() || !!itemizedReceipt} className="shrink-0 h-10">
              {nlpLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {nlpLoading ? 'Parsing…' : 'Parse'}
            </Button>
          </div>
          {itemizedReceipt && (
            <p className="text-xs text-muted-foreground -mt-1">
              AI quick entry and receipt scan are disabled while an itemized split is active — remove it first to use them.
            </p>
          )}
          <div className="flex items-center gap-1 flex-wrap">
            <Button variant="ghost" size="sm" asChild className={cn('cursor-pointer h-7 -ml-1', itemizedReceipt && 'opacity-40 pointer-events-none')} disabled={!!itemizedReceipt}>
              <label>
                <Camera className="h-3.5 w-3.5" /> Scan Receipt
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={!!itemizedReceipt}
                  onChange={(e) => e.target.files?.[0] && handleReceiptScan(e.target.files[0])}
                />
              </label>
            </Button>
            {isPro ? (
              <Button variant="ghost" size="sm" asChild className="cursor-pointer h-7" disabled={itemizeLoading}>
                <label>
                  {itemizeLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Receipt className="h-3.5 w-3.5" />}
                  Split by items
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={itemizeLoading}
                    onChange={(e) => e.target.files?.[0] && handleItemizedScan(e.target.files[0])}
                  />
                </label>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className="h-7" onClick={() => setShowUpgradeDialog(true)}>
                <Receipt className="h-3.5 w-3.5" /> Split by items
                <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0 h-4 border-primary/30 text-primary">
                  <Lock className="h-2.5 w-2.5 mr-0.5" /> PRO
                </Badge>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {itemizedReceipt && itemizedReceipt.reconciled === true && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            The scanned items don't perfectly add up to the receipt total — amounts may be slightly off. Review before saving.
          </AlertDescription>
        </Alert>
      )}

      {createExpense.isError && (
        <Alert variant="destructive">
          <AlertDescription>{(createExpense.error as Error)?.message || 'Failed to create expense'}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic info */}
        <Card>
          <CardContent className="p-5 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="What was this expense for?"
                required
                className="h-10"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="amount">Amount <span className="text-destructive">*</span></Label>
                <Input
                  id="amount"
                  type="number"
                  value={form.amount}
                  onChange={(e) => update('amount', e.target.value)}
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  required
                  disabled={!!itemizedReceipt}
                  className="h-10 tabular-nums text-base font-semibold"
                />
              </div>
              <div className="space-y-2 col-span-1">
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={(v) => update('currency', v)} disabled={!!itemizedReceipt}>
                  <SelectTrigger className="h-10">
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
            {itemizedReceipt && (
              <p className="text-xs text-muted-foreground -mt-3">Amount is set by the scanned receipt</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category <span className="text-destructive">*</span></Label>
                <Select value={form.category} onValueChange={(v) => update('category', v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const Icon = CATEGORY_STYLES[c].icon;
                            return <Icon className={cn('h-4 w-4', CATEGORY_STYLES[c].fg)} />;
                          })()}
                          {CATEGORY_STYLES[c].label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.date}
                  onChange={(e) => update('date', e.target.value)}
                  className="h-10 dark:[color-scheme:dark]"
                />
              </div>
            </div>

            {/* Paid By */}
            <div className="space-y-2">
              <Label>Paid by <span className="text-destructive">*</span></Label>
              <Select value={form.paidById} onValueChange={(v) => update('paidById', v)}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Who paid?" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      <div className="flex items-center gap-2">
                        <UserAvatar name={m.user?.name} size="xs" />
                        <span>{m.user?.name}</span>
                        {m.userId === currentUser?.id && (
                          <span className="text-xs text-muted-foreground">(You)</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Split */}
        <Card>
          <CardContent className="p-5 space-y-5">
            <div className="space-y-2">
              <Label>Split type</Label>
              {itemizedReceipt ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground italic">Split set by receipt items</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearItemized}
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" /> Remove itemized split
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SPLIT_TYPES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => handleSplitTypeChange(s.value)}
                      className={cn(
                        'flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg border-2 text-left transition-all active:scale-[0.98]',
                        form.splitType === s.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground/30'
                      )}
                    >
                      <span className={cn(
                        'text-xs font-semibold',
                        form.splitType === s.value && 'text-primary'
                      )}>{s.label}</span>
                      <span className="text-[10px] text-muted-foreground leading-tight">{s.hint}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ─── Itemized Split Editor ─── */}
            {itemizedReceipt && members.length > 0 && (
              <ItemizedSplitEditor
                key={`${itemizedReceipt.vendor}-${itemizedReceipt.total}-${itemizedReceipt.items.length}`}
                receipt={itemizedReceipt}
                members={itemizedMembers}
                onChange={setItemizedResult}
              />
            )}

            {/* ─── Split Details ─── */}
            {!itemizedReceipt && members.length > 0 && form.amount && (
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

          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardContent className="p-5">
            <div className="space-y-2">
              <Label htmlFor="description">Notes</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Optional notes..."
                className="min-h-[80px] resize-none"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" asChild className="flex-1">
            <Link to={`/trips/${tripId}/expenses`}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={createExpense.isPending || !form.title.trim() || !form.amount} className="flex-1">
            {createExpense.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {createExpense.isPending ? 'Adding…' : 'Add Expense'}
          </Button>
        </div>
      </form>

      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Upgrade to PRO
            </DialogTitle>
            <DialogDescription>
              Splitting a receipt by individual items is a PRO feature. Upgrade your plan to scan a receipt and assign each item to the people who had it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>Not now</Button>
            <Button asChild>
              <Link to="/settings/billing">Upgrade</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
