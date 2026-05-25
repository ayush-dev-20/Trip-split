import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ChevronLeft, ChevronRight, Wallet, CalendarDays, List } from 'lucide-react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/ui/EmptyState';
import { usePersonalExpenses, usePersonalExpensesCalendar, useDeletePersonalExpense } from '@/hooks/usePersonalExpenses';
import { CATEGORY_STYLES, getCategoryStyle } from '@/lib/categoryStyle';
import { cn } from '@/lib/utils';
import type { ExpenseCategory, PersonalExpense, PersonalExpenseCalendarDay } from '@/types';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ALL_CATEGORIES = Object.keys(CATEGORY_STYLES) as ExpenseCategory[];

function formatMoney(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
}

function formatDayLabel(dateStr: string) {
  const d = parseISO(dateStr);
  if (isToday(d))     return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEE, MMM d');
}

// ── Expense Card ────────────────────────────────────────────────────────────

function ExpenseCard({ expense, onDelete }: { expense: PersonalExpense; onDelete: (id: string) => void }) {
  const cat = getCategoryStyle(expense.category);
  const Icon = cat.icon;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors group"
    >
      <div className={cn('flex items-center justify-center h-10 w-10 rounded-xl shrink-0', cat.bg)}>
        <Icon className={cn('h-5 w-5', cat.fg)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{expense.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {cat.label} · {format(parseISO(expense.date), 'h:mm a')}
        </p>
      </div>
      <div className="text-right shrink-0 flex items-center gap-2">
        <p className="text-sm font-semibold tabular-nums">
          {formatMoney(expense.amount, expense.currency)}
        </p>
        <button
          onClick={() => onDelete(expense.id)}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity text-xs px-1"
          aria-label="Delete"
        >
          ✕
        </button>
      </div>
    </motion.div>
  );
}

// ── Today View ───────────────────────────────────────────────────────────────

function TodayView({ category }: { category: string }) {
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endDate   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

  const { data, isLoading } = usePersonalExpenses({
    startDate,
    endDate,
    category: category !== 'ALL' ? category : undefined,
    limit: 100,
  });
  const deleteMutation = useDeletePersonalExpense();

  const expenses = data?.expenses ?? [];
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
      {/* Today's summary card */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Today's Total</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{formatMoney(totalToday)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Transactions</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{expenses.length}</p>
        </Card>
      </div>

      {expenses.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-7 w-7" />}
          title="No expenses today"
          description="Tap + to log your first expense of the day."
          action={
            <Button asChild>
              <Link to="/expenses/new"><Plus className="h-4 w-4 mr-1" />Add Expense</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today</p>
            <p className="text-xs text-muted-foreground tabular-nums">{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</p>
          </div>
          <ul className="divide-y">
            <AnimatePresence>
              {expenses.map((e) => (
                <ExpenseCard
                  key={e.id}
                  expense={e}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))}
            </AnimatePresence>
          </ul>
        </Card>
      )}

      {/* Recent — last 7 days excluding today */}
      <RecentList category={category} />
    </div>
  );
}

function RecentList({ category }: { category: string }) {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  const endOfYesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, -1);

  const { data } = usePersonalExpenses({
    startDate: sevenDaysAgo.toISOString(),
    endDate:   endOfYesterday.toISOString(),
    category:  category !== 'ALL' ? category : undefined,
    limit: 50,
  });
  const deleteMutation = useDeletePersonalExpense();

  const expenses = data?.expenses ?? [];
  if (expenses.length === 0) return null;

  // Group by date
  const grouped = useMemo(() => {
    const map: Record<string, PersonalExpense[]> = {};
    for (const e of expenses) {
      const key = e.date.split('T')[0];
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [expenses]);

  return (
    <div className="space-y-4 mt-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Recent</p>
      {grouped.map(([day, items]) => (
        <div key={day}>
          <div className="flex items-center justify-between mb-1 px-1">
            <p className="text-xs text-muted-foreground">{formatDayLabel(day)}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatMoney(items.reduce((s, e) => s + e.baseAmount, 0))}
            </p>
          </div>
          <Card>
            <ul className="divide-y">
              {items.map((e) => (
                <ExpenseCard
                  key={e.id}
                  expense={e}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))}
            </ul>
          </Card>
        </div>
      ))}
    </div>
  );
}

// ── Calendar View ────────────────────────────────────────────────────────────

// Map category to a safe dot color (CSS color strings, not dynamic Tailwind classes)
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

function formatCompact(amount: number) {
  if (amount >= 10000) return `$${Math.round(amount / 1000)}k`;
  if (amount >= 1000)  return `$${(amount / 1000).toFixed(1)}k`;
  if (amount >= 100)   return `$${Math.round(amount)}`;
  return `$${amount.toFixed(0)}`;
}

function CalendarView({ category }: { category: string }) {
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
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const firstDayOfMonth = new Date(year, month - 1, 1);
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7; // Monday-first
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
              {formatMoney(monthTotal)} this month
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={nextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7">
        {DAYS_OF_WEEK.map(d => (
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
            const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const dayData = dayMap[dateStr];
            const isCurrentDay = isToday(new Date(year, month - 1, day));
            const dots = dayData ? getCategoryDots(dayData.expenses) : [];

            return (
              <button
                key={idx}
                onClick={() => dayData && setSelectedDay(dayData)}
                className={cn(
                  'relative flex flex-col items-center h-[72px] rounded-xl pt-2 pb-1.5 gap-0.5 transition-all',
                  'active:scale-95',
                  isCurrentDay
                    ? 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                    : '',
                  dayData
                    ? 'bg-primary/8 hover:bg-primary/12 cursor-pointer'
                    : 'hover:bg-accent/40 cursor-default',
                )}
              >
                {/* Day number */}
                <span className={cn(
                  'text-xs font-semibold leading-none',
                  isCurrentDay ? 'text-primary' : 'text-foreground',
                  !dayData && 'text-muted-foreground/70',
                )}>
                  {day}
                </span>

                {dayData ? (
                  <>
                    {/* Amount */}
                    <span className={cn(
                      'text-[10px] font-bold leading-none tabular-nums',
                      isCurrentDay ? 'text-primary' : 'text-foreground/80',
                    )}>
                      {formatCompact(dayData.total)}
                    </span>

                    {/* Category dot cluster */}
                    <div className="flex items-center gap-0.5 mt-auto mb-0.5">
                      {dots.map((color, i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                      {dayData.count > 3 && (
                        <span className="text-[8px] text-muted-foreground leading-none">+{dayData.count - 3}</span>
                      )}
                    </div>
                  </>
                ) : (
                  <span className="mt-auto mb-1 h-1.5 w-1.5" /> /* spacing placeholder */
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
                    {formatMoney(selectedDay.total)}
                  </span>
                </div>
              </SheetHeader>
              <ul className="divide-y mt-1">
                {selectedDay.expenses.map((e) => (
                  <ExpenseCard
                    key={e.id}
                    expense={e}
                    onDelete={(id) => { deleteMutation.mutate(id); setSelectedDay(null); }}
                  />
                ))}
              </ul>
              <div className="px-5 pt-3 pb-2">
                <Button asChild className="w-full" variant="outline" size="sm">
                  <Link to="/expenses/new">
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

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PersonalExpensesPage() {
  const [view, setView]         = useState<'today' | 'calendar'>('today');
  const [category, setCategory] = useState('ALL');

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

      {/* View toggle */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => setView('today')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            view === 'today' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <List className="h-3.5 w-3.5" /> Today
        </button>
        <button
          onClick={() => setView('calendar')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            view === 'calendar' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <CalendarDays className="h-3.5 w-3.5" /> Calendar
        </button>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {view === 'today'
            ? <TodayView category={category} />
            : <CalendarView category={category} />
          }
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
    </div>
  );
}
