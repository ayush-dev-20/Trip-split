import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, ChevronLeft, ChevronRight, Wallet, CalendarDays, List,
  History, Trash2, Loader2, Pencil, Sparkles, Search, X, RepeatIcon,
} from 'lucide-react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/ui/EmptyState';
import AIChatPanel from '@/components/ui/AIChatPanel';
import { aiService } from '@/services/aiService';
import {
  usePersonalExpenses,
  usePersonalExpense,
  usePersonalExpensesCalendar,
  useDeletePersonalExpense,
  useRecurringExpenses,
  useCreatePersonalExpense,
} from '@/hooks/usePersonalExpenses';
import { isDueToday, getMonthlyEquivalent, FREQUENCY_LABELS } from '@/lib/recurring';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuthStore } from '@/stores/authStore';
import { formatMoney, formatMoneyCompact, formatRelativeDay } from '@/lib/format';
import { CATEGORY_STYLES, getCategoryStyle } from '@/lib/categoryStyle';
import { cn } from '@/lib/utils';
import type { ExpenseCategory, PersonalExpense, PersonalExpenseCalendarDay, RecurringFrequency } from '@/types';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ALL_CATEGORIES = Object.keys(CATEGORY_STYLES) as ExpenseCategory[];

function formatDayLabel(dateStr: string) {
  const d = parseISO(dateStr);
  if (isToday(d))     return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEE, MMM d');
}

// ── Expense Card ─────────────────────────────────────────────────────────────

interface ExpenseCardProps {
  expense: PersonalExpense;
  onDelete: (id: string) => void;
  onClick?: () => void;
}

function ExpenseCard({ expense, onDelete, onClick }: ExpenseCardProps) {
  const cat = getCategoryStyle(expense.category);
  const Icon = cat.icon;
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className={cn(
          'flex items-center gap-3 px-4 py-3 transition-colors group',
          onClick ? 'cursor-pointer hover:bg-accent/50 active:bg-accent/70' : 'hover:bg-accent/40',
        )}
        onClick={onClick}
      >
        <div className={cn('flex items-center justify-center h-10 w-10 rounded-xl shrink-0', cat.bg)}>
          <Icon className={cn('h-5 w-5', cat.fg)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{expense.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {cat.label} · {format(parseISO(expense.createdAt), 'h:mm a')}
            {expense.updatedAt !== expense.createdAt && (
              <span className="italic"> · edited {format(parseISO(expense.updatedAt), 'h:mm a')}</span>
            )}
          </p>
        </div>
        <div className="text-right shrink-0 flex items-center gap-1">
          <p className="text-sm font-semibold tabular-nums">
            {formatMoney(expense.amount, expense.currency)}
          </p>
          <Link
            to={`/expenses/${expense.id}/edit`}
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity p-1"
            aria-label="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity text-xs px-1"
            aria-label="Delete"
          >
            ✕
          </button>
        </div>
      </motion.div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>
              "{expense.title}" will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => onDelete(expense.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Personal Expense Detail Dialog ───────────────────────────────────────────

function PersonalExpenseDetailDialog({
  expenseId,
  onClose,
  onDelete,
}: {
  expenseId: string | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const { data: expense, isLoading } = usePersonalExpense(expenseId ?? '');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const cat = expense ? getCategoryStyle(expense.category) : null;
  const Icon = cat?.icon;

  return (
    <Dialog open={!!expenseId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="sr-only">Expense Details</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3 py-4">
            <Skeleton className="h-14 w-14 rounded-2xl mx-auto" />
            <Skeleton className="h-8 w-36 mx-auto" />
            <Skeleton className="h-4 w-24 mx-auto" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        )}

        {expense && cat && Icon && (
          <div className="space-y-4">
            {/* Hero */}
            <div className="flex flex-col items-center pt-2 pb-1 text-center">
              <div className={cn('h-14 w-14 rounded-2xl flex items-center justify-center mb-3', cat.bg)}>
                <Icon className={cn('h-7 w-7', cat.fg)} />
              </div>
              <p className="text-3xl font-bold tabular-nums tracking-tight">
                {formatMoney(expense.amount, expense.currency)}
              </p>
              <p className="text-base font-medium mt-1 text-foreground">{expense.title}</p>
              <Badge variant="outline" className={cn('mt-2 border-transparent text-xs', cat.bg, cat.fg)}>
                {cat.label}
              </Badge>
            </div>

            {/* Detail rows */}
            <div className="rounded-xl border divide-y overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">{format(parseISO(expense.date), 'EEE, MMM d yyyy')}</span>
              </div>
              {expense.currency !== expense.currency /* placeholder — shows base if converted */ && (
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">Base amount</span>
                  <span className="font-medium tabular-nums">{formatMoney(expense.baseAmount, 'USD')}</span>
                </div>
              )}
              {expense.isRecurring && (
                <div className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">Recurring</span>
                  <Badge variant="secondary" className="text-xs">
                    {expense.recurringPattern || 'Yes'}
                  </Badge>
                </div>
              )}
              {expense.description && (
                <div className="px-4 py-2.5 text-sm">
                  <p className="text-muted-foreground mb-1">Notes</p>
                  <p className="leading-relaxed whitespace-pre-wrap">{expense.description}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" asChild>
                <Link to={`/expenses/${expense.id}/edit`} onClick={onClose}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Link>
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete expense?</AlertDialogTitle>
                  <AlertDialogDescription>
                    "{expense.title}" will be permanently deleted. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => { onDelete(expense.id); onClose(); }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Today View ───────────────────────────────────────────────────────────────

function TodayView({
  category,
  currency,
  search,
  onExpenseClick,
  showBanner,
  onDismissBanner,
}: {
  category: string;
  currency: string;
  search: string;
  onExpenseClick: (id: string) => void;
  showBanner: boolean;
  onDismissBanner: () => void;
}) {
  // One query covers today AND the previous 7 days (the "Recent" list below),
  // instead of two separate components each firing their own request. That
  // used to mean every settled search fired 2 API calls at once — this way
  // it's 1. Memoised so the params/keys are stable across re-renders.
  const { startDate, endDate, todayKey } = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
    return {
      startDate: new Date(y, m, day - 7).toISOString(),
      endDate:   new Date(y, m, day, 23, 59, 59, 999).toISOString(),
      todayKey:  `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    };
  }, []); // computed once per mount — same calendar window for the lifetime of the component

  const { data, isLoading } = usePersonalExpenses({
    startDate,
    endDate,
    category: category !== 'ALL' ? category : undefined,
    search: search || undefined,
    limit: 150,
  });
  const deleteMutation = useDeletePersonalExpense();

  const allExpenses = data?.expenses ?? [];
  const expenses = useMemo(
    () => allExpenses.filter((e) => e.date.split('T')[0] === todayKey),
    [allExpenses, todayKey],
  );
  const recentExpenses = useMemo(
    () => allExpenses.filter((e) => e.date.split('T')[0] !== todayKey),
    [allExpenses, todayKey],
  );
  const totalToday = expenses.reduce((s, e) => s + e.baseAmount, 0);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {showBanner && <DueTodayBanner onDismiss={onDismissBanner} />}
      </AnimatePresence>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Today's Total</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{formatMoney(totalToday, currency)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Transactions</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{expenses.length}</p>
        </Card>
      </div>

      {expenses.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-7 w-7" />}
          title={search ? `No matches for "${search}"` : 'No expenses today'}
          description={search ? 'Try a different title or note keyword.' : 'Tap + to log your first expense of the day.'}
          action={
            search ? undefined : (
              <Button asChild>
                <Link to="/expenses/new"><Plus className="h-4 w-4 mr-1" />Add Expense</Link>
              </Button>
            )
          }
        />
      ) : (
        <Card>
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
            </p>
          </div>
          <ul className="divide-y">
            <AnimatePresence>
              {expenses.map((e) => (
                <ExpenseCard
                  key={e.id}
                  expense={e}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onClick={() => onExpenseClick(e.id)}
                />
              ))}
            </AnimatePresence>
          </ul>
        </Card>
      )}

      <RecentList expenses={recentExpenses} currency={currency} onExpenseClick={onExpenseClick} />
    </div>
  );
}

// ── Recent (last 7 days, Today view footer) ──────────────────────────────────
// Purely presentational — TodayView fetches the data (one shared query for
// both "today" and "recent") and passes the already-filtered slice down here.

function RecentList({
  expenses,
  currency,
  onExpenseClick,
}: {
  expenses: PersonalExpense[];
  currency: string;
  onExpenseClick: (id: string) => void;
}) {
  const deleteMutation = useDeletePersonalExpense();

  // useMemo must be called before any early return (Rules of Hooks)
  const grouped = useMemo(() => {
    const map: Record<string, PersonalExpense[]> = {};
    for (const e of expenses) {
      const key = e.date.split('T')[0];
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [expenses]);

  if (expenses.length === 0) return null;

  return (
    <div className="space-y-4 mt-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Recent</p>
      {grouped.map(([day, items]) => (
        <div key={day}>
          <div className="flex items-center justify-between mb-1 px-1">
            <p className="text-xs text-muted-foreground">{formatDayLabel(day)}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatMoney(items.reduce((s, e) => s + e.baseAmount, 0), currency)}
            </p>
          </div>
          <Card>
            <ul className="divide-y">
              {items.map((e) => (
                <ExpenseCard
                  key={e.id}
                  expense={e}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onClick={() => onExpenseClick(e.id)}
                />
              ))}
            </ul>
          </Card>
        </div>
      ))}
    </div>
  );
}

// ── Past Expenses View ────────────────────────────────────────────────────────

function PastExpensesView({
  category,
  currency,
  search,
  onExpenseClick,
}: {
  category: string;
  currency: string;
  search: string;
  onExpenseClick: (id: string) => void;
}) {
  const LIMIT = 50;
  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState<PersonalExpense[]>([]);

  const endDate = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 23, 59, 59, 999).toISOString();
  }, []);

  const { data, isLoading, isFetching } = usePersonalExpenses({
    endDate,
    category: category !== 'ALL' ? category : undefined,
    search: search || undefined,
    page,
    limit: LIMIT,
  });

  // Accumulate pages; page=1 always resets the list
  useEffect(() => {
    if (!data?.expenses) return;
    setAccumulated((prev) =>
      page === 1 ? data.expenses : [...prev, ...data.expenses],
    );
  }, [data?.expenses, page]);

  const deleteMutation = useDeletePersonalExpense();

  const grouped = useMemo(() => {
    const map: Record<string, PersonalExpense[]> = {};
    for (const e of accumulated) {
      const key = e.date.split('T')[0];
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [accumulated]);

  const hasMore = data ? accumulated.length < data.pagination.total : false;

  if (isLoading && page === 1) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)}
      </div>
    );
  }

  if (grouped.length === 0 && !isFetching) {
    return (
      <EmptyState
        icon={<History className="h-7 w-7" />}
        title={search ? `No matches for "${search}"` : 'No past expenses'}
        description={search ? 'Try a different title or note keyword.' : 'Your expense history will appear here.'}
      />
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map(([day, items]) => (
        <div key={day}>
          <div className="flex items-center justify-between mb-1 px-1">
            <p className="text-xs font-semibold text-muted-foreground">
              {formatRelativeDay(day)}
              <span className="font-normal ml-1">· {format(parseISO(day), 'MMM d, yyyy')}</span>
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatMoney(items.reduce((s, e) => s + e.baseAmount, 0), currency)}
            </p>
          </div>
          <Card>
            <ul className="divide-y">
              {items.map((e) => (
                <ExpenseCard
                  key={e.id}
                  expense={e}
                  onDelete={(id) =>
                    deleteMutation.mutate(id, {
                      onSuccess: () => setAccumulated((prev) => prev.filter((x) => x.id !== id)),
                    })
                  }
                  onClick={() => onExpenseClick(e.id)}
                />
              ))}
            </ul>
          </Card>
        </div>
      ))}

      {hasMore && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setPage((p) => p + 1)}
          disabled={isFetching}
        >
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Load more
        </Button>
      )}
    </div>
  );
}

// ── Calendar View ─────────────────────────────────────────────────────────────

const CATEGORY_DOT_COLOR: Record<string, string> = {
  FOOD: '#ea580c',
  GROCERIES: '#16a34a',
  TRANSPORT: '#2563eb',
  ACCOMMODATION: '#9333ea',
  ACTIVITIES: '#059669',
  SHOPPING: '#db2777',
  HEALTH: '#dc2626',
  COMMUNICATION: '#0891b2',
  ENTERTAINMENT: '#7c3aed',
  FEES: '#d97706',
  MISCELLANEOUS: '#64748b',
};

function getCategoryDots(expenses: PersonalExpense[]) {
  const seen = new Set<string>();
  const dots: string[] = [];
  for (const e of expenses) {
    if (!seen.has(e.category)) {
      seen.add(e.category);
      dots.push(CATEGORY_DOT_COLOR[e.category] ?? '#64748b');
      if (dots.length === 3) break;
    }
  }
  return dots;
}

function CalendarView({
  category,
  currency,
  onExpenseClick,
}: {
  category: string;
  currency: string;
  onExpenseClick: (id: string) => void;
}) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<PersonalExpenseCalendarDay | null>(null);

  const { data: calendarDays = [], isLoading } = usePersonalExpensesCalendar(year, month);
  const deleteMutation = useDeletePersonalExpense();

  const dayMap = useMemo(() => {
    const m: Record<string, PersonalExpenseCalendarDay> = {};
    for (const d of calendarDays) {
      const filtered = category !== 'ALL'
        ? { ...d, expenses: d.expenses.filter((e) => e.category === category) }
        : d;
      if (filtered.expenses.length > 0) {
        m[d.date] = { ...filtered, total: filtered.expenses.reduce((s, e) => s + e.baseAmount, 0) };
      }
    }
    return m;
  }, [calendarDays, category]);

  const monthTotal = useMemo(
    () => Object.values(dayMap).reduce((s, d) => s + d.total, 0),
    [dayMap],
  );

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  const firstDayOfMonth = new Date(year, month - 1, 1);
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth  = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-3">
      {/* Month navigation + total */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <p className="font-semibold text-sm">{monthLabel}</p>
          {monthTotal > 0 && (
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatMoney(monthTotal, currency)} this month
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7">
        {DAYS_OF_WEEK.map((d) => (
          <p key={d} className="text-[10px] font-semibold uppercase text-muted-foreground text-center py-1">{d}</p>
        ))}
      </div>

      {/* Calendar grid */}
      {isLoading ? (
        <div className="grid grid-cols-7 gap-1">
          {Array(35).fill(null).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} className="h-[72px]" />;
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayData = dayMap[dateStr];
            const isCurrentDay = isToday(new Date(year, month - 1, day));
            const dots = dayData ? getCategoryDots(dayData.expenses) : [];

            return (
              <button
                key={idx}
                onClick={() => dayData && setSelectedDay(dayData)}
                className={cn(
                  'relative flex flex-col items-center h-[72px] rounded-xl pt-2 pb-1.5 gap-0.5 transition-all active:scale-95',
                  isCurrentDay ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : '',
                  dayData
                    ? 'bg-primary/[0.08] hover:bg-primary/[0.12] cursor-pointer'
                    : 'hover:bg-accent/40 cursor-default',
                )}
              >
                <span className={cn(
                  'text-xs font-semibold leading-none',
                  isCurrentDay ? 'text-primary' : 'text-foreground',
                  !dayData && 'text-muted-foreground/70',
                )}>
                  {day}
                </span>

                {dayData ? (
                  <>
                    <span className={cn(
                      'text-[10px] font-bold leading-none tabular-nums',
                      isCurrentDay ? 'text-primary' : 'text-foreground/80',
                    )}>
                      {formatMoneyCompact(dayData.total, currency)}
                    </span>
                    <div className="flex items-center gap-0.5 mt-auto mb-0.5">
                      {dots.map((color, i) => (
                        <span key={i} className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      ))}
                      {dayData.count > 3 && (
                        <span className="text-[8px] text-muted-foreground leading-none">+{dayData.count - 3}</span>
                      )}
                    </div>
                  </>
                ) : (
                  <span className="mt-auto mb-1 h-1.5 w-1.5" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Day detail sheet */}
      <Sheet open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl px-0 pb-safe">
          {selectedDay && (
            <>
              <SheetHeader className="px-5 pt-2 pb-4 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <SheetTitle className="text-base">{formatDayLabel(selectedDay.date)}</SheetTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedDay.count} expense{selectedDay.count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="text-lg font-bold tabular-nums text-primary">
                    {formatMoney(selectedDay.total, currency)}
                  </span>
                </div>
              </SheetHeader>
              <ul className="divide-y mt-1">
                {selectedDay.expenses.map((e) => (
                  <ExpenseCard
                    key={e.id}
                    expense={e}
                    onDelete={(id) => { deleteMutation.mutate(id); setSelectedDay(null); }}
                    onClick={() => onExpenseClick(e.id)}
                  />
                ))}
              </ul>
              <div className="px-5 pt-3 pb-2">
                <Button asChild className="w-full" variant="outline" size="sm">
                  <Link to={`/expenses/new?date=${selectedDay.date}`}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add expense for this day
                  </Link>
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Due Today Banner ──────────────────────────────────────────────────────────

function DueTodayBanner({ onDismiss }: { onDismiss: () => void }) {
  const { data: recurring = [] } = useRecurringExpenses();
  const createMutation           = useCreatePersonalExpense();
  const [logging, setLogging]    = useState(false);
  const [logError, setLogError]  = useState(false);

  const dueToday = useMemo(
    () =>
      recurring.filter((e) =>
        isDueToday(e.date, (e.recurringPattern ?? 'monthly') as RecurringFrequency),
      ),
    [recurring],
  );

  if (dueToday.length === 0) return null;

  const handleLogAll = async () => {
    setLogging(true);
    setLogError(false);
    try {
      const today = new Date().toISOString().split('T')[0];
      await Promise.all(
        dueToday.map((e) =>
          createMutation.mutateAsync({
            title:       e.title,
            amount:      e.amount,
            currency:    e.currency,
            category:    e.category,
            date:        today,
            description: e.description ?? undefined,
            isRecurring: false,
          }),
        ),
      );
      onDismiss();
    } catch {
      setLogError(true);
    } finally {
      setLogging(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
    >
      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="p-3 flex items-center gap-3">
          <RepeatIcon className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">
              {dueToday.length} recurring {dueToday.length === 1 ? 'expense' : 'expenses'} due today
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {dueToday.map((e) => `${e.title} (${formatMoney(e.amount, e.currency)})`).join(' · ')}
            </p>
          </div>
          {logError ? (
            <p className="text-xs text-destructive shrink-0">Some items failed — check History and log remaining manually.</p>
          ) : (
            <Button size="sm" className="shrink-0" onClick={handleLogAll} disabled={logging}>
              {logging ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Log all
            </Button>
          )}
          <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={onDismiss} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Recurring Tab ─────────────────────────────────────────────────────────────

function RecurringTab({
  currency,
  onExpenseClick,
}: {
  currency: string;
  onExpenseClick: (id: string) => void;
}) {
  const { data: expenses = [], isLoading } = useRecurringExpenses();
  const deleteMutation = useDeletePersonalExpense();

  const { grouped, monthlyTotal } = useMemo(() => {
    const order: RecurringFrequency[] = ['daily', 'weekly', 'monthly', 'yearly'];
    const map: Record<string, typeof expenses> = {};
    for (const e of expenses) {
      const p = (e.recurringPattern ?? 'monthly') as RecurringFrequency;
      if (!map[p]) map[p] = [];
      map[p].push(e);
    }
    const grouped = order
      .filter((p) => map[p]?.length > 0)
      .map((p) => ({ pattern: p, items: map[p] }));
    const monthlyTotal = expenses.reduce(
      (sum, e) =>
        sum + getMonthlyEquivalent(e.baseAmount, (e.recurringPattern ?? 'monthly') as RecurringFrequency),
      0,
    );
    return { grouped, monthlyTotal };
  }, [expenses]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <EmptyState
        icon={<RepeatIcon className="h-7 w-7" />}
        title="No recurring expenses"
        description="Toggle 'Recurring expense' when adding an expense to track subscriptions and fixed costs here."
        action={
          <Button asChild>
            <Link to="/expenses/new"><Plus className="h-4 w-4 mr-1" />Add Recurring</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Monthly commitment summary */}
      <Card className="p-4">
        <p className="text-xs text-muted-foreground">Monthly Commitment</p>
        <p className="text-2xl font-bold mt-1 tabular-nums">{formatMoney(monthlyTotal, currency)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {expenses.length} recurring expense{expenses.length !== 1 ? 's' : ''}
        </p>
      </Card>

      {/* Grouped by frequency */}
      {grouped.map(({ pattern, items }) => (
        <div key={pattern}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2">
            {FREQUENCY_LABELS[pattern]}
          </p>
          <Card>
            <ul className="divide-y">
              <AnimatePresence initial={false}>
              {items.map((e) => {
                const cat  = getCategoryStyle(e.category);
                const Icon = cat.icon;
                return (
                  <motion.div
                    key={e.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-center gap-3 px-4 py-3 group hover:bg-accent/40 cursor-pointer transition-colors"
                    onClick={() => onExpenseClick(e.id)}
                  >
                    <div className={cn('flex items-center justify-center h-10 w-10 rounded-xl shrink-0', cat.bg)}>
                      <Icon className={cn('h-5 w-5', cat.fg)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{e.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Next: {format(e.nextDueDate, 'MMM d')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatMoney(e.amount, e.currency)}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity h-7 w-7"
                        onClick={(ev) => { ev.stopPropagation(); deleteMutation.mutate(e.id); }}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
              </AnimatePresence>
            </ul>
          </Card>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type View = 'today' | 'calendar' | 'past' | 'recurring' | 'ai';

export default function PersonalExpensesPage() {
  const [view, setView]               = useState<View>('today');
  const [category, setCategory]       = useState('ALL');
  const [detailId, setDetailId]       = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Search box updates instantly; `search` (used in queries) only updates once
  // the user pauses typing for 300ms, so we don't fire a request per keystroke.
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim(), 300);

  const preferredCurrency = useAuthStore((s) => s.user?.preferredCurrency ?? 'USD');
  const deleteMutation    = useDeletePersonalExpense();

  const TABS: { id: View; label: string; icon: React.ElementType }[] = [
    { id: 'today',     label: 'Today',     icon: List },
    { id: 'calendar',  label: 'Calendar',  icon: CalendarDays },
    { id: 'past',      label: 'History',   icon: History },
    { id: 'recurring', label: 'Recurring', icon: RepeatIcon },
    { id: 'ai',        label: 'AI',        icon: Sparkles },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            My Expenses
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Personal daily tracking</p>
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-36 text-xs h-8">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All categories</SelectItem>
            {ALL_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{CATEGORY_STYLES[c].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              view === id
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Search — only meaningful for Today and History, which fetch from the
          server; Calendar groups by month and AI is a chat interface. */}
      {(view === 'today' || view === 'past') && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by title or notes…"
            className="pl-9 pr-9"
          />
          {searchInput && (
            <Button variant="ghost" size="icon" className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setSearchInput('')} aria-label="Clear search">
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {view === 'today' && (
            <TodayView
              category={category}
              currency={preferredCurrency}
              search={search}
              onExpenseClick={setDetailId}
              showBanner={!bannerDismissed}
              onDismissBanner={() => setBannerDismissed(true)}
            />
          )}
          {view === 'calendar' && (
            <CalendarView
              category={category}
              currency={preferredCurrency}
              onExpenseClick={setDetailId}
            />
          )}
          {view === 'past' && (
            // key resets pagination + accumulated state when category or search filter changes
            <PastExpensesView
              key={`${category}-${search}`}
              category={category}
              currency={preferredCurrency}
              search={search}
              onExpenseClick={setDetailId}
            />
          )}
          {view === 'recurring' && (
            <RecurringTab
              currency={preferredCurrency}
              onExpenseClick={setDetailId}
            />
          )}
          {view === 'ai' && (
            <div className="h-[65vh] flex flex-col border rounded-xl overflow-hidden bg-card">
              <AIChatPanel
                mutationFn={(msg) => aiService.chatbotPersonal(msg)}
                placeholder="Ask about your expenses…"
                emptyTitle="Ask about your spending"
                emptySubtitle='"How much on food this week?" · "Show my top categories"'
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Floating + button */}
      <Button
        asChild
        size="icon"
        className="fixed bottom-20 right-5 h-14 w-14 rounded-full shadow-lg z-10"
      >
        <Link to="/expenses/new" aria-label="Add expense">
          <Plus className="h-6 w-6" />
        </Link>
      </Button>

      {/* Expense detail dialog */}
      <PersonalExpenseDetailDialog
        expenseId={detailId}
        onClose={() => setDetailId(null)}
        onDelete={(id) => deleteMutation.mutate(id)}
      />
    </div>
  );
}
