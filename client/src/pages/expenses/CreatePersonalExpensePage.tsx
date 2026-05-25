import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router';
import { Sparkles, Camera, AlertCircle, Mic, MicOff, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { CATEGORY_STYLES } from '@/lib/categoryStyle';
import { useCreatePersonalExpense } from '@/hooks/usePersonalExpenses';
import { aiService } from '@/services/aiService';
import { cn } from '@/lib/utils';
import type { ExpenseCategory } from '@/types';

const CATEGORIES: ExpenseCategory[] = [
  'FOOD', 'GROCERIES', 'TRANSPORT', 'ACCOMMODATION', 'ACTIVITIES', 'SHOPPING',
  'HEALTH', 'COMMUNICATION', 'ENTERTAINMENT', 'FEES', 'MISCELLANEOUS',
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'AUD', 'CAD', 'CHF', 'SGD', 'THB'];

interface Form {
  title: string;
  amount: string;
  currency: string;
  category: ExpenseCategory;
  date: string;
  description: string;
  isRecurring: boolean;
  recurringPattern: string;
}

function todayDateValue() {
  return new Date().toISOString().split('T')[0];
}

export default function CreatePersonalExpensePage() {
  const navigate = useNavigate();
  const createMutation = useCreatePersonalExpense();

  const [form, setForm] = useState<Form>({
    title: '',
    amount: '',
    currency: 'USD',
    category: 'MISCELLANEOUS',
    date: todayDateValue(),
    description: '',
    isRecurring: false,
    recurringPattern: '',
  });
  const [error, setError] = useState('');

  // NLP / voice
  const [nlpInput, setNlpInput]     = useState('');
  const [nlpLoading, setNlpLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Receipt scan
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [scanLoading, setScanLoading] = useState(false);

  const set = (field: keyof Form, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // ── Voice input ──────────────────────────────────────────────────────────

  const toggleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const r = new SR();
    r.lang = 'en-US';
    r.interimResults = false;
    r.onresult = (e: SpeechRecognitionEvent) => { setNlpInput(e.results[0][0].transcript); setIsListening(false); };
    r.onerror = () => setIsListening(false);
    r.onend   = () => setIsListening(false);
    recognitionRef.current = r;
    r.start();
    setIsListening(true);
  };

  // ── NLP parse ────────────────────────────────────────────────────────────

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
    } catch { /* silent */ } finally {
      setNlpLoading(false);
    }
  };

  // ── Receipt scan ─────────────────────────────────────────────────────────

  const handleReceiptScan = async (file: File) => {
    setScanLoading(true);
    try {
      const result = await aiService.scanReceipt(file);
      setForm((prev) => ({
        ...prev,
        title:    result.title  || prev.title,
        amount:   result.amount?.toString()  || prev.amount,
        currency: result.currency || prev.currency,
        category: (result.category as ExpenseCategory) || prev.category,
        date:     result.date?.split('T')[0] || prev.date,
        description: result.description || prev.description,
      }));
    } catch { /* silent */ } finally {
      setScanLoading(false);
    }
  };

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.title.trim())       return setError('Title is required.');
    if (!form.amount || Number(form.amount) <= 0) return setError('Enter a valid amount.');

    try {
      await createMutation.mutateAsync({
        title:       form.title.trim(),
        amount:      Number(form.amount),
        currency:    form.currency,
        category:    form.category,
        date:        new Date(form.date).toISOString(),
        description: form.description || undefined,
        isRecurring:      form.isRecurring,
        recurringPattern: form.isRecurring && form.recurringPattern ? form.recurringPattern : undefined,
      });
      navigate('/expenses');
    } catch {
      setError('Failed to save expense. Please try again.');
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/expenses"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">Add Expense</h1>
          <p className="text-xs text-muted-foreground">Personal expense</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* NLP bar */}
      <Card>
        <CardContent className="pt-4">
          <Label className="text-xs text-muted-foreground mb-2 block">Quick add with AI</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 text-sm"
                placeholder='e.g. "Coffee $4.50" or "Uber 12 euros"'
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
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={scanLoading}
              onClick={() => receiptInputRef.current?.click()}
            >
              {scanLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </Button>
            <input
              ref={receiptInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReceiptScan(f); }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
          <Input
            id="title"
            placeholder="What did you spend on?"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </div>

        {/* Amount + Currency */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="amount">Amount <span className="text-destructive">*</span></Label>
            <Input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => set('amount', e.target.value)}
            />
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

        {/* Category */}
        <div className="space-y-2">
          <Label>Category</Label>
          <div className="grid grid-cols-5 gap-2">
            {CATEGORIES.map((c) => {
              const style = CATEGORY_STYLES[c];
              const Icon  = style.icon;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('category', c)}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2 rounded-xl border text-[10px] font-medium transition-all',
                    form.category === c
                      ? `${style.bg} border-primary/30 shadow-sm`
                      : 'border-border hover:border-border/80 hover:bg-accent/40'
                  )}
                >
                  <Icon className={cn('h-4 w-4', form.category === c ? style.fg : 'text-muted-foreground')} />
                  <span className={form.category === c ? style.fg : 'text-muted-foreground'}>{style.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            placeholder="Optional notes…"
            rows={2}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>

        {/* Recurring */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Recurring expense</p>
                <p className="text-xs text-muted-foreground">Mark as a regular expense</p>
              </div>
              <Switch
                checked={form.isRecurring}
                onCheckedChange={(v) => set('isRecurring', v)}
              />
            </div>
            {form.isRecurring && (
              <div className="space-y-1.5">
                <Label htmlFor="pattern" className="text-xs">Pattern (e.g. "daily", "weekly")</Label>
                <Input
                  id="pattern"
                  placeholder="daily / weekly / monthly"
                  value={form.recurringPattern}
                  onChange={(e) => set('recurringPattern', e.target.value)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full"
          disabled={createMutation.isPending || !form.title.trim() || !form.amount}
        >
          {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save Expense
        </Button>
      </form>
    </div>
  );
}
