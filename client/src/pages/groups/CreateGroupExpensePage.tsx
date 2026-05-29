import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link, useSearchParams, useParams } from 'react-router';
import { Sparkles, Camera, AlertCircle, Mic, MicOff, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { CATEGORY_STYLES } from '@/lib/categoryStyle';
import {
  useCreateGroupExpense,
  useUpdateGroupExpense,
  useGroupExpense,
} from '@/hooks/useGroupExpenses';
import { useGroup } from '@/hooks/useGroups';
import { useAuthStore } from '@/stores/authStore';
import { aiService } from '@/services/aiService';
import { cn } from '@/lib/utils';
import type { ExpenseCategory, SplitType } from '@/types';

const CATEGORIES: ExpenseCategory[] = [
  'FOOD', 'GROCERIES', 'TRANSPORT', 'ACCOMMODATION', 'ACTIVITIES', 'SHOPPING',
  'HEALTH', 'COMMUNICATION', 'ENTERTAINMENT', 'FEES', 'MISCELLANEOUS',
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'AUD', 'CAD', 'CHF', 'SGD', 'THB'];

const SPLIT_TYPES: { value: SplitType; label: string; hint: string }[] = [
  { value: 'EQUAL',      label: 'Equal',      hint: 'Split evenly' },
  { value: 'PERCENTAGE', label: 'Percentage', hint: 'By %' },
  { value: 'EXACT',      label: 'Exact',      hint: 'Custom amounts' },
  { value: 'SHARES',     label: 'Shares',     hint: 'Proportional' },
];

interface Form {
  title: string;
  amount: string;
  currency: string;
  category: ExpenseCategory;
  date: string;
  description: string;
  splitType: SplitType;
  paidById: string;
  isRecurring: boolean;
  recurringPattern: string;
}

function todayDateValue() {
  return new Date().toISOString().split('T')[0];
}

export default function CreateGroupExpensePage() {
  const navigate = useNavigate();
  const { groupId, id: editId } = useParams<{ groupId: string; id?: string }>();
  const isEditMode = !!editId;

  const [searchParams] = useSearchParams();
  const currentUser   = useAuthStore((s) => s.user);
  const preferredCurrency = useAuthStore((s) => s.user?.preferredCurrency ?? 'USD');

  const { data: group } = useGroup(groupId!);
  const groupCurrency = preferredCurrency;

  const [form, setForm] = useState<Form>({
    title:            '',
    amount:           '',
    currency:         groupCurrency,
    category:         'MISCELLANEOUS',
    date:             searchParams.get('date') || todayDateValue(),
    description:      '',
    splitType:        'EQUAL',
    paidById:         currentUser?.id ?? '',
    isRecurring:      false,
    recurringPattern: '',
  });
  const [splitValues, setSplitValues] = useState<Record<string, string>>({});
  const [formReady, setFormReady] = useState(!isEditMode);
  const [error, setError] = useState('');


  // Fetch existing expense in edit mode
  const { data: existingExpense, isLoading: loadingExpense } = useGroupExpense(groupId!, editId ?? '');

  useEffect(() => {
    if (!existingExpense) return;
    setForm({
      title:            existingExpense.title,
      amount:           existingExpense.amount.toString(),
      currency:         existingExpense.currency,
      category:         existingExpense.category,
      date:             existingExpense.date.split('T')[0],
      description:      existingExpense.description ?? '',
      splitType:        existingExpense.splitType,
      paidById:         existingExpense.paidById,
      isRecurring:      existingExpense.isRecurring,
      recurringPattern: existingExpense.recurringPattern ?? '',
    });
    setFormReady(true);
  }, [existingExpense]);

  const createMutation = useCreateGroupExpense(groupId!);
  const updateMutation = useUpdateGroupExpense(groupId!, editId ?? '');
  const isPending = isEditMode ? updateMutation.isPending : createMutation.isPending;

  // NLP / voice
  const [nlpInput, setNlpInput]       = useState('');
  const [nlpLoading, setNlpLoading]   = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Receipt scan
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [scanLoading, setScanLoading] = useState(false);

  const set = (field: keyof Form, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

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

  const updateSplitValue = (userId: string, value: string) =>
    setSplitValues((prev) => ({ ...prev, [userId]: value }));

  const handleSplitTypeChange = (newType: SplitType) => {
    set('splitType', newType);
    const payer = form.paidById || currentUser?.id || '';
    const defaults: Record<string, string> = {};
    if (newType === 'PERCENTAGE') {
      members.forEach((m) => { defaults[m.userId] = m.userId === payer ? '100' : '0'; });
    } else if (newType === 'EXACT') {
      members.forEach((m) => { defaults[m.userId] = m.userId === payer ? (totalAmount > 0 ? totalAmount.toFixed(2) : '') : '0'; });
    } else if (newType === 'SHARES') {
      members.forEach((m) => { defaults[m.userId] = '1'; });
    }
    setSplitValues(defaults);
  };

  // ── Voice ────────────────────────────────────────────────────────────────────

  const toggleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const r = new SR();
    r.lang = 'en-US'; r.interimResults = false;
    r.onresult = (e: SpeechRecognitionEvent) => { setNlpInput(e.results[0][0].transcript); setIsListening(false); };
    r.onerror = () => setIsListening(false);
    r.onend   = () => setIsListening(false);
    recognitionRef.current = r;
    r.start(); setIsListening(true);
  };

  // ── NLP ──────────────────────────────────────────────────────────────────────

  const handleNLP = async () => {
    if (!nlpInput.trim()) return;
    setNlpLoading(true);
    try {
      const result = await aiService.parseNaturalLanguage(nlpInput);
      setForm((prev) => ({
        ...prev,
        title:    result.title    || prev.title,
        amount:   result.amount?.toString() || prev.amount,
        currency: result.currency || prev.currency,
        category: (result.category as ExpenseCategory) || prev.category,
      }));
    } catch { /* silent */ } finally { setNlpLoading(false); }
  };

  // ── Receipt scan ─────────────────────────────────────────────────────────────

  const handleReceiptScan = async (file: File) => {
    setScanLoading(true);
    try {
      const result = await aiService.scanReceipt(file);
      setForm((prev) => ({
        ...prev,
        title:       result.title    || prev.title,
        amount:      result.amount?.toString() || prev.amount,
        currency:    result.currency || prev.currency,
        category:    (result.category as ExpenseCategory) || prev.category,
        date:        result.date?.split('T')[0] || prev.date,
        description: result.description || prev.description,
      }));
    } catch { /* silent */ } finally { setScanLoading(false); }
  };

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.title.trim())                       return setError('Title is required.');
    if (!form.amount || Number(form.amount) <= 0) return setError('Enter a valid amount.');

    let splits: { userId: string; amount?: number; percentage?: number; shares?: number }[] | undefined;
    if (form.splitType === 'PERCENTAGE') {
      splits = members.map((m) => ({ userId: m.userId, percentage: Number(splitValues[m.userId]) || 0 }));
    } else if (form.splitType === 'EXACT') {
      splits = members.map((m) => ({ userId: m.userId, amount: Number(splitValues[m.userId]) || 0 }));
    } else if (form.splitType === 'SHARES') {
      splits = members.map((m) => ({ userId: m.userId, shares: Number(splitValues[m.userId]) || 1 }));
    }

    const payload = {
      title:            form.title.trim(),
      amount:           Number(form.amount),
      currency:         form.currency,
      category:         form.category,
      date:             new Date(form.date).toISOString(),
      description:      form.description || undefined,
      splitType:        form.splitType,
      splits,
      paidById:         form.paidById || undefined,
      isRecurring:      form.isRecurring,
      recurringPattern: form.isRecurring && form.recurringPattern ? form.recurringPattern : undefined,
    };

    try {
      if (isEditMode) {
        await updateMutation.mutateAsync(payload);
      } else {
        await createMutation.mutateAsync(payload);
      }
      navigate(`/groups/${groupId}`, { state: { tab: 'expenses' } });
    } catch {
      setError(`Failed to ${isEditMode ? 'update' : 'save'} expense. Please try again.`);
    }
  };

  // ── Loading skeleton ─────────────────────────────────────────────────────────

  if (isEditMode && loadingExpense) {
    return (
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/groups/${groupId}`}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <Skeleton className="h-6 w-32" />
        </div>
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
      </div>
    );
  }

  const members = group?.members ?? [];

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/groups/${groupId}`}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">{isEditMode ? 'Edit Expense' : 'Add Group Expense'}</h1>
          <p className="text-xs text-muted-foreground">
            {group ? `Group · ${group.name}` : 'Group expense'}
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* NLP bar — only in create mode */}
      {!isEditMode && (
        <Card>
          <CardContent className="pt-4">
            <Label className="text-xs text-muted-foreground mb-2 block">Quick add with AI</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 text-sm"
                  placeholder='e.g. "Groceries $45" or "Dinner 60 euros"'
                  value={nlpInput}
                  onChange={(e) => setNlpInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleNLP()}
                />
              </div>
              {('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) && (
                <Button type="button" variant="outline" size="icon" onClick={toggleVoice} className={cn(isListening && 'text-destructive')}>
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              )}
              <Button type="button" variant="outline" size="icon" onClick={handleNLP} disabled={nlpLoading || !nlpInput.trim()}>
                {nlpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
              <Button type="button" variant="outline" size="icon" disabled={scanLoading} onClick={() => receiptInputRef.current?.click()}>
                {scanLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </Button>
              <input ref={receiptInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReceiptScan(f); }} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      {formReady && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
            <Input id="title" placeholder="What did you spend on?" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>

          {/* Amount + Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="amount">Amount <span className="text-destructive">*</span></Label>
              <Input id="amount" type="number" min="0.01" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => set('amount', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.currency}
                onChange={(e) => set('currency', e.target.value)}
              >
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Paid by */}
          {members.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="paidBy">Paid by</Label>
              <select
                id="paidBy"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.paidById}
                onChange={(e) => set('paidById', e.target.value)}
              >
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user?.name ?? m.userId}{m.userId === currentUser?.id ? ' (you)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {CATEGORIES.map((c) => {
                const style = CATEGORY_STYLES[c];
                const Icon  = style.icon;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set('category', c)}
                    className={cn(
                      'flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-[10px] font-medium transition-all',
                      form.category === c
                        ? `${style.bg} border-primary/30 shadow-sm`
                        : 'border-border hover:border-border/80 hover:bg-accent/40',
                    )}
                  >
                    <Icon className={cn('h-4 w-4 shrink-0', form.category === c ? style.fg : 'text-muted-foreground')} />
                    <span className={cn('text-center leading-tight w-full', form.category === c ? style.fg : 'text-muted-foreground')}>{style.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" placeholder="Optional notes…" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>

          {/* Split */}
          <div className="space-y-3">
            <Label>Split type</Label>
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
                      : 'border-border hover:border-muted-foreground/30',
                  )}
                >
                  <span className={cn('text-xs font-semibold', form.splitType === s.value && 'text-primary')}>{s.label}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{s.hint}</span>
                </button>
              ))}
            </div>

            {members.length > 0 && form.amount && (
              <div className="bg-muted rounded-lg p-4 space-y-3">
                {/* EQUAL preview */}
                {form.splitType === 'EQUAL' && (
                  <>
                    <p className="text-xs font-medium text-muted-foreground">Equal split among {members.length} members</p>
                    <div className="space-y-1.5">
                      {members.map((m) => {
                        const isPayer = m.userId === form.paidById;
                        const fairShare = members.length > 0 ? totalAmount / members.length : 0;
                        const contributed = isPayer ? totalAmount : 0;
                        const net = contributed - fairShare;
                        return (
                          <div key={m.userId} className="flex justify-between text-sm items-center">
                            <span className="text-muted-foreground truncate mr-2">
                              {m.user?.name}{isPayer && <span className="ml-1 text-xs text-primary">(payer)</span>}
                            </span>
                            <div className="text-right shrink-0">
                              <span className="font-medium">{form.currency} {contributed.toFixed(2)}</span>
                              <span className={cn('ml-2 text-xs', net > 0 ? 'text-green-600' : net < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                                {net > 0 ? `+${net.toFixed(2)}` : net < 0 ? `${net.toFixed(2)}` : 'settled'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">Fair share per person: {form.currency} {members.length > 0 ? (totalAmount / members.length).toFixed(2) : '0.00'}</p>
                  </>
                )}

                {/* PERCENTAGE */}
                {form.splitType === 'PERCENTAGE' && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Who paid what % of the bill?</p>
                      <span className={cn('text-xs font-semibold', splitSummary.valid ? 'text-green-600' : 'text-destructive')}>{splitSummary.label}</span>
                    </div>
                    <div className="space-y-2">
                      {members.map((m) => {
                        const pct = Number(splitValues[m.userId]) || 0;
                        const contributed = totalAmount > 0 ? (totalAmount * pct / 100) : 0;
                        const fairShare = members.length > 0 ? totalAmount / members.length : 0;
                        const net = contributed - fairShare;
                        return (
                          <div key={m.userId} className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground w-20 truncate shrink-0">{m.user?.name}</span>
                            <Input type="number" min="0" max="100" step="0.1" value={splitValues[m.userId] ?? ''} onChange={(e) => updateSplitValue(m.userId, e.target.value)} placeholder="0" className="h-8 text-sm" />
                            <span className="text-xs text-muted-foreground w-4 shrink-0">%</span>
                            <div className="text-right w-20 shrink-0">
                              <div className="text-xs font-medium">{form.currency} {contributed.toFixed(2)}</div>
                              {splitSummary.valid && totalAmount > 0 && (
                                <div className={cn('text-[10px]', net > 0.005 ? 'text-green-600' : net < -0.005 ? 'text-destructive' : 'text-muted-foreground')}>
                                  {net > 0.005 ? `+${net.toFixed(2)}` : net < -0.005 ? `${net.toFixed(2)}` : 'settled'}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {!splitSummary.valid && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Percentages must add up to 100%
                      </p>
                    )}
                  </>
                )}

                {/* EXACT */}
                {form.splitType === 'EXACT' && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">How much did each person pay?</p>
                      <span className={cn('text-xs font-semibold', splitSummary.valid ? 'text-green-600' : 'text-destructive')}>{splitSummary.label}</span>
                    </div>
                    <div className="space-y-2">
                      {members.map((m) => {
                        const contributed = Number(splitValues[m.userId]) || 0;
                        const fairShare = members.length > 0 ? totalAmount / members.length : 0;
                        const net = contributed - fairShare;
                        return (
                          <div key={m.userId} className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground w-20 truncate shrink-0">{m.user?.name}</span>
                            <span className="text-xs text-muted-foreground shrink-0">{form.currency}</span>
                            <Input type="number" min="0" step="0.01" value={splitValues[m.userId] ?? ''} onChange={(e) => updateSplitValue(m.userId, e.target.value)} placeholder="0.00" className="h-8 text-sm" />
                            {splitSummary.valid && totalAmount > 0 && (
                              <div className={cn('text-[10px] text-right w-16 shrink-0', net > 0.005 ? 'text-green-600' : net < -0.005 ? 'text-destructive' : 'text-muted-foreground')}>
                                {net > 0.005 ? `+${net.toFixed(2)}` : net < -0.005 ? `${net.toFixed(2)}` : 'settled'}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {!splitSummary.valid && totalAmount > 0 && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> Amounts must add up to {form.currency} {totalAmount.toFixed(2)}
                      </p>
                    )}
                  </>
                )}

                {/* SHARES */}
                {form.splitType === 'SHARES' && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Contribution shares (proportional)</p>
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
                          <div key={m.userId} className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground w-20 truncate shrink-0">{m.user?.name}</span>
                            <Input type="number" min="0" step="1" value={splitValues[m.userId] ?? ''} onChange={(e) => updateSplitValue(m.userId, e.target.value)} placeholder="1" className="h-8 text-sm" />
                            <span className="text-xs text-muted-foreground shrink-0">shares</span>
                            <div className="text-right w-16 shrink-0">
                              <div className="text-xs font-medium">{form.currency} {contributed.toFixed(2)}</div>
                              {totalShares > 0 && totalAmount > 0 && (
                                <div className={cn('text-[10px]', net > 0.005 ? 'text-green-600' : net < -0.005 ? 'text-destructive' : 'text-muted-foreground')}>
                                  {net > 0.005 ? `+${net.toFixed(2)}` : net < -0.005 ? `${net.toFixed(2)}` : 'settled'}
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
          </div>

          {/* Recurring */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Recurring expense</p>
                  <p className="text-xs text-muted-foreground">Mark as a regular group expense</p>
                </div>
                <Switch checked={form.isRecurring} onCheckedChange={(v) => set('isRecurring', v)} />
              </div>
              {form.isRecurring && (
                <div className="space-y-1.5">
                  <Label htmlFor="pattern" className="text-xs">Pattern (e.g. "daily", "weekly")</Label>
                  <Input id="pattern" placeholder="daily / weekly / monthly" value={form.recurringPattern} onChange={(e) => set('recurringPattern', e.target.value)} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit */}
          <Button type="submit" className="w-full" disabled={isPending || !form.title.trim() || !form.amount}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isEditMode ? 'Update Expense' : 'Save Expense'}
          </Button>
        </form>
      )}
    </div>
  );
}
