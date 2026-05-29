import { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Map, Plus, Copy, Trash2, Loader2, Check, MapPin,
  Wallet, ChevronLeft, ChevronRight, History, List, CalendarDays,
  TrendingUp, TrendingDown, Minus, BarChart2, Pencil, Sparkles,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import { useAuthStore } from '@/stores/authStore';
import { useGroup, useDeleteGroup } from '@/hooks/useGroups';
import { useTrips } from '@/hooks/useTrips';
import {
  useGroupExpenses, useGroupExpensesCalendar,
  useDeleteGroupExpense, useGroupAnalytics, useGroupExpenseSocket,
} from '@/hooks/useGroupExpenses';
import { useSocket } from '@/contexts/SocketContext';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import SectionHeading from '@/components/ui/SectionHeading';
import EmptyState from '@/components/ui/EmptyState';
import UserAvatar from '@/components/ui/UserAvatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CATEGORY_STYLES, getCategoryStyle } from '@/lib/categoryStyle';
import { formatMoney, formatMoneyCompact, formatRelativeDay } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { GroupExpense, GroupAnalyticsPeriod, ExpenseCategory } from '@/types';
import AIChatPanel from '@/components/ui/AIChatPanel';
import { aiService } from '@/services/aiService';

// ── Chart helpers ─────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  FOOD: '#ea580c', GROCERIES: '#16a34a', TRANSPORT: '#2563eb',
  ACCOMMODATION: '#9333ea', ACTIVITIES: '#059669', SHOPPING: '#db2777',
  HEALTH: '#dc2626', COMMUNICATION: '#0891b2', ENTERTAINMENT: '#7c3aed',
  FEES: '#d97706', MISCELLANEOUS: '#64748b',
};
const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
function getCategoryColor(cat: string, idx: number) { return CATEGORY_COLORS[cat] || COLORS[idx % COLORS.length]; }
function fmtTick(v: number, currency: string) {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(v); }
  catch { return `${currency} ${v}`; }
}

const CATEGORY_DOT_COLOR: Record<string, string> = CATEGORY_COLORS;
const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatDayLabel(dateStr: string) {
  const d = parseISO(dateStr);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEE, MMM d');
}

// ── Expense Card ──────────────────────────────────────────────────────────────

function GroupExpenseCard({
  expense, onDelete, onClick,
}: { expense: GroupExpense; onDelete: (id: string) => void; onClick?: () => void }) {
  const cat  = getCategoryStyle(expense.category);
  const Icon = cat.icon;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const memberCount = expense.splits?.length ?? 1;

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
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
            {cat.label}
            {expense.paidBy && <span> · paid by {expense.paidBy.name}</span>}
            {memberCount > 1 && <span> · split {memberCount} ways</span>}
          </p>
        </div>
        <div className="text-right shrink-0 flex items-center gap-1">
          <p className="text-sm font-semibold tabular-nums">
            {formatMoney(expense.amount, expense.currency)}
          </p>
          <Link
            to={`/groups/${expense.groupId}/expenses/${expense.id}/edit`}
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
          >✕</button>
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
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Today Sub-view ────────────────────────────────────────────────────────────

function TodayView({ groupId, currency }: { groupId: string; currency: string }) {
  const { startDate, endDate } = useMemo(() => {
    const d = new Date();
    return {
      startDate: new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString(),
      endDate:   new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).toISOString(),
    };
  }, []);

  const { data, isLoading } = useGroupExpenses(groupId, { startDate, endDate, limit: 100 });
  const deleteMutation = useDeleteGroupExpense(groupId);
  const expenses = data?.expenses ?? [];
  const total = expenses.reduce((s, e) => s + e.baseAmount, 0);

  if (isLoading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Today's Total</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{formatMoney(total, currency)}</p>
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
          description="Tap + to log the first group expense of the day."
          action={<Button asChild><Link to={`/groups/${groupId}/expenses/new`}><Plus className="h-4 w-4 mr-1" />Add Expense</Link></Button>}
        />
      ) : (
        <Card>
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today</p>
            <p className="text-xs text-muted-foreground">{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</p>
          </div>
          <ul className="divide-y">
            <AnimatePresence>
              {expenses.map((e) => (
                <GroupExpenseCard key={e.id} expense={e} onDelete={(id) => deleteMutation.mutate(id)} />
              ))}
            </AnimatePresence>
          </ul>
        </Card>
      )}
    </div>
  );
}

// ── History Sub-view ──────────────────────────────────────────────────────────

function HistoryView({ groupId, currency }: { groupId: string; currency: string }) {
  const LIMIT = 50;
  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState<GroupExpense[]>([]);

  const endDate = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 23, 59, 59, 999).toISOString();
  }, []);

  const { data, isLoading, isFetching } = useGroupExpenses(groupId, { endDate, page, limit: LIMIT });
  const deleteMutation = useDeleteGroupExpense(groupId);

  useEffect(() => {
    if (!data?.expenses) return;
    setAccumulated((prev) => page === 1 ? data.expenses : [...prev, ...data.expenses]);
  }, [data?.expenses, page]);

  const grouped = useMemo(() => {
    const map: Record<string, GroupExpense[]> = {};
    for (const e of accumulated) {
      const key = e.date.split('T')[0];
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [accumulated]);

  const hasMore = data ? accumulated.length < data.pagination.total : false;

  if (isLoading && page === 1) return <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)}</div>;

  if (grouped.length === 0 && !isFetching) {
    return <EmptyState icon={<History className="h-7 w-7" />} title="No past expenses" description="Past group expenses will appear here." />;
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
                <GroupExpenseCard
                  key={e.id}
                  expense={e}
                  onDelete={(id) => deleteMutation.mutate(id, {
                    onSuccess: () => setAccumulated((prev) => prev.filter((x) => x.id !== id)),
                  })}
                />
              ))}
            </ul>
          </Card>
        </div>
      ))}
      {hasMore && (
        <Button variant="outline" className="w-full" onClick={() => setPage((p) => p + 1)} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Load more
        </Button>
      )}
    </div>
  );
}

// ── Calendar Sub-view ─────────────────────────────────────────────────────────

function CalendarView({ groupId, currency }: { groupId: string; currency: string }) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<{ date: string; total: number; count: number; expenses: GroupExpense[] } | null>(null);

  const { data: calendarDays = [], isLoading } = useGroupExpensesCalendar(groupId, year, month);
  const deleteMutation = useDeleteGroupExpense(groupId);

  const dayMap = useMemo(() => {
    const m: Record<string, { date: string; total: number; count: number; expenses: GroupExpense[] }> = {};
    for (const d of calendarDays) {
      if (d.expenses.length > 0) {
        m[d.date] = { ...d, total: d.expenses.reduce((s, e) => s + e.baseAmount, 0) };
      }
    }
    return m;
  }, [calendarDays]);

  const monthTotal = useMemo(() => Object.values(dayMap).reduce((s, d) => s + d.total, 0), [dayMap]);

  function prevMonth() { if (month === 1) { setYear((y) => y - 1); setMonth(12); } else setMonth((m) => m - 1); }
  function nextMonth() { if (month === 12) { setYear((y) => y + 1); setMonth(1); } else setMonth((m) => m + 1); }

  const firstDay = new Date(year, month - 1, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
        <div className="text-center">
          <p className="font-semibold text-sm">{monthLabel}</p>
          {monthTotal > 0 && <p className="text-xs text-muted-foreground">{formatMoney(monthTotal, currency)} this month</p>}
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      <div className="grid grid-cols-7">
        {DAYS_OF_WEEK.map((d) => <p key={d} className="text-[10px] font-semibold uppercase text-muted-foreground text-center py-1">{d}</p>)}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-7 gap-1">{Array(35).fill(null).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} className="h-[72px]" />;
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayData = dayMap[dateStr];
            const isCurrentDay = isToday(new Date(year, month - 1, day));
            const dots = dayData ? [...new Set(dayData.expenses.map((e) => e.category))].slice(0, 3).map((c) => CATEGORY_DOT_COLOR[c] ?? '#64748b') : [];

            return (
              <button
                key={idx}
                onClick={() => dayData && setSelectedDay(dayData)}
                className={cn(
                  'relative flex flex-col items-center h-[72px] rounded-xl pt-2 pb-1.5 gap-0.5 transition-all active:scale-95',
                  isCurrentDay ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : '',
                  dayData ? 'bg-primary/[0.08] hover:bg-primary/[0.12] cursor-pointer' : 'hover:bg-accent/40 cursor-default',
                )}
              >
                <span className={cn('text-xs font-semibold leading-none', isCurrentDay ? 'text-primary' : 'text-foreground', !dayData && 'text-muted-foreground/70')}>{day}</span>
                {dayData ? (
                  <>
                    <span className={cn('text-[10px] font-bold leading-none tabular-nums', isCurrentDay ? 'text-primary' : 'text-foreground/80')}>
                      {formatMoneyCompact(dayData.total, currency)}
                    </span>
                    <div className="flex items-center gap-0.5 mt-auto mb-0.5">
                      {dots.map((color, i) => <span key={i} className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />)}
                    </div>
                  </>
                ) : <span className="mt-auto mb-1 h-1.5 w-1.5" />}
              </button>
            );
          })}
        </div>
      )}

      <Sheet open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl px-0 pb-safe">
          {selectedDay && (
            <>
              <SheetHeader className="px-5 pt-2 pb-4 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <SheetTitle className="text-base">{formatDayLabel(selectedDay.date)}</SheetTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedDay.count} expense{selectedDay.count !== 1 ? 's' : ''}</p>
                  </div>
                  <span className="text-lg font-bold tabular-nums text-primary">{formatMoney(selectedDay.total, currency)}</span>
                </div>
              </SheetHeader>
              <ul className="divide-y mt-1">
                {selectedDay.expenses.map((e) => (
                  <GroupExpenseCard key={e.id} expense={e} onDelete={(id) => { deleteMutation.mutate(id); setSelectedDay(null); }} />
                ))}
              </ul>
              <div className="px-5 pt-3 pb-2">
                <Button asChild className="w-full" variant="outline" size="sm">
                  <Link to={`/groups/${groupId}/expenses/new?date=${selectedDay.date}`}>
                    <Plus className="h-4 w-4 mr-1.5" />Add expense for this day
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

// ── Expenses Tab ──────────────────────────────────────────────────────────────

type SubView = 'today' | 'history' | 'calendar';
const SUB_VIEWS: { id: SubView; label: string; icon: React.ElementType }[] = [
  { id: 'today',    label: 'Today',    icon: List },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'history',  label: 'History',  icon: History },
];

function GroupExpensesTab({ groupId, currency }: { groupId: string; currency: string }) {
  const [sub, setSub] = useState<SubView>('today');
  const { isConnected, joinGroup, leaveGroup } = useSocket();

  useEffect(() => {
    joinGroup(groupId);
    return () => leaveGroup(groupId);
  }, [groupId]); // eslint-disable-line

  // Invalidate cache on real-time events from other members
  useGroupExpenseSocket(groupId);

  return (
    <div className="space-y-4">
      {/* Sub-tab toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          {SUB_VIEWS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSub(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                sub === id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>
        {isConnected && (
          <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />Live
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={sub} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
          {sub === 'today'    && <TodayView    groupId={groupId} currency={currency} />}
          {sub === 'calendar' && <CalendarView groupId={groupId} currency={currency} />}
          {sub === 'history'  && <HistoryView  groupId={groupId} currency={currency} />}
        </motion.div>
      </AnimatePresence>

      {/* FAB */}
      <Button asChild size="icon" className="fixed bottom-20 right-5 h-14 w-14 rounded-full shadow-lg z-10">
        <Link to={`/groups/${groupId}/expenses/new`} aria-label="Add expense"><Plus className="h-6 w-6" /></Link>
      </Button>
    </div>
  );
}

// ── Analytics Tab ─────────────────────────────────────────────────────────────

const PERIODS: GroupAnalyticsPeriod[] = ['week', 'month', 'quarter', 'year'];

function GroupAnalyticsTab({ groupId, currency }: { groupId: string; currency: string }) {
  const [period, setPeriod] = useState<GroupAnalyticsPeriod>('month');
  const { data, isLoading } = useGroupAnalytics(groupId, period);

  if (isLoading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;

  if (!data) return <EmptyState icon={<BarChart2 className="h-7 w-7" />} title="No analytics yet" description="Add group expenses to see analytics." />;

  const delta = data.comparisonToPrev;

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex gap-1.5">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize',
              period === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Spent</p>
          <p className="text-xl font-bold mt-1 tabular-nums">{formatMoney(data.totalSpent, currency)}</p>
          <div className="flex items-center gap-1 mt-1">
            {delta.direction === 'up'   && <TrendingUp   className="h-3 w-3 text-destructive" />}
            {delta.direction === 'down' && <TrendingDown className="h-3 w-3 text-green-600" />}
            {delta.direction === 'same' && <Minus        className="h-3 w-3 text-muted-foreground" />}
            <span className={cn('text-xs', delta.direction === 'up' ? 'text-destructive' : delta.direction === 'down' ? 'text-green-600' : 'text-muted-foreground')}>
              {delta.changePercent !== 0 ? `${Math.abs(delta.changePercent)}% vs prev` : 'No change'}
            </span>
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Transactions</p>
          <p className="text-xl font-bold mt-1">{data.transactionCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Daily Average</p>
          <p className="text-xl font-bold mt-1 tabular-nums">{formatMoney(data.avgPerDay, currency)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Top Category</p>
          <p className="text-sm font-bold mt-1 capitalize">{CATEGORY_STYLES[data.topCategory as ExpenseCategory]?.label ?? data.topCategory}</p>
        </Card>
      </div>

      {/* Time-series bar chart */}
      {data.timeSeriesData.length > 0 && (
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Spending over time</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.timeSeriesData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtTick(v, currency)} width={55} />
              <Tooltip formatter={(v: number) => formatMoney(v, currency)} />
              <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Category breakdown */}
      {data.categoryBreakdown.length > 0 && (
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">By Category</p>
          <div className="space-y-2">
            {data.categoryBreakdown.slice(0, 6).map((c, idx) => (
              <div key={c.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{CATEGORY_STYLES[c.category as ExpenseCategory]?.label ?? c.category}</span>
                  <span className="text-muted-foreground tabular-nums">{formatMoney(c.total, currency)} · {c.percentage}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${c.percentage}%`, backgroundColor: getCategoryColor(c.category, idx) }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Member breakdown */}
      {data.memberBreakdown.length > 0 && (
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Member Breakdown</p>
          <div className="space-y-3">
            {data.memberBreakdown.map((m) => (
              <div key={m.userId}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <UserAvatar name={m.name} size="sm" />
                    <span className="text-sm font-medium">{m.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{formatMoney(m.totalPaid, currency)}</p>
                    <p className={cn('text-xs tabular-nums', m.balance >= 0 ? 'text-green-600' : 'text-destructive')}>
                      {m.balance >= 0 ? '+' : ''}{formatMoney(m.balance, currency)}
                    </p>
                  </div>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${data.totalSpent > 0 ? Math.min(100, (m.totalPaid / data.totalSpent) * 100) : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Category donut */}
      {data.categoryBreakdown.length > 0 && (
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Category Distribution</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data.categoryBreakdown}
                dataKey="total"
                nameKey="category"
                cx="50%" cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {data.categoryBreakdown.map((c, idx) => (
                  <Cell key={c.category} fill={getCategoryColor(c.category, idx)} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatMoney(v, currency)} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}

// ── Overview Tab (existing content) ──────────────────────────────────────────

function OverviewTab({ group, trips, copyCode, copied }: {
  group: NonNullable<ReturnType<typeof useGroup>['data']>;
  trips: NonNullable<ReturnType<typeof useTrips>['data']>['trips'];
  copyCode: () => void;
  copied: boolean;
}) {
  return (
    <div className="space-y-5">
      {/* Invite Code */}
      <Card className="bg-gradient-to-br from-primary/5 to-info/5 border-primary/10">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Invite Code</p>
            <p className="text-xl sm:text-2xl font-mono font-bold mt-0.5 tracking-wide">{group.inviteCode}</p>
          </div>
          <Button variant={copied ? 'success' : 'default'} onClick={copyCode}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy Code'}
          </Button>
        </CardContent>
      </Card>

      {/* Members */}
      <section>
        <SectionHeading title={`Members (${group.members?.length ?? 0})`} />
        <div className="grid gap-2 sm:grid-cols-2">
          {group.members?.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <UserAvatar name={m.user?.name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{m.user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.user?.email}</p>
                </div>
                {m.role === 'ADMIN' && <Badge variant="secondary" className="text-[10px] shrink-0">Admin</Badge>}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Trips */}
      <section>
        <SectionHeading
          title="Trips"
          action={<Button asChild size="sm"><Link to="/trips/new"><Plus className="h-4 w-4" /> New Trip</Link></Button>}
        />
        {trips.length === 0 ? (
          <EmptyState
            icon={<Map className="h-7 w-7" />}
            title="No trips yet"
            description="Create the first trip for this group."
            action={<Button asChild><Link to="/trips/new"><Plus className="h-4 w-4" /> Create Trip</Link></Button>}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {trips.map((trip) => (
              <Link key={trip.id} to={`/trips/${trip.id}`}>
                <Card className="hover:shadow-card-hover transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-sm flex-1 truncate">{trip.name}</h3>
                      <Badge variant="outline" className={cn(
                        'text-[10px] shrink-0',
                        trip.status === 'ACTIVE'   && 'bg-success/10 text-success border-success/20',
                        trip.status === 'UPCOMING' && 'bg-info/10 text-info border-info/20',
                      )}>
                        {trip.status}
                      </Badge>
                    </div>
                    {trip.destination && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                        <MapPin className="h-3 w-3" />{trip.destination}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground border-t pt-2">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{trip._count?.members ?? 0}</span>
                      <span>{trip._count?.expenses ?? 0} expenses</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'expenses' | 'analytics' | 'ai';
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview',   label: 'Overview',   icon: Users },
  { id: 'expenses',   label: 'Expenses',   icon: Wallet },
  { id: 'analytics',  label: 'Analytics',  icon: BarChart2 },
  { id: 'ai',         label: 'AI',         icon: Sparkles },
];

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { data: group, isLoading } = useGroup(groupId!);
  const { data: tripsData } = useTrips({ groupId });
  const deleteGroup = useDeleteGroup();
  const preferredCurrency = useAuthStore((s) => s.user?.preferredCurrency ?? 'USD');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  if (isLoading || !group) return <PageLoader />;

  const trips = tripsData?.trips ?? [];
  const currency = preferredCurrency;

  const copyCode = () => {
    navigator.clipboard.writeText(group.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = () => {
    if (window.confirm('Delete this group? All associated data will be removed.')) {
      deleteGroup.mutate(groupId!, { onSuccess: () => navigate('/groups') });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={group.name}
        description={group.description}
        back="/groups"
        actions={
          <Button
            variant="ghost" size="icon" onClick={handleDelete} disabled={deleteGroup.isPending}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            aria-label="Delete group"
          >
            {deleteGroup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        }
      />

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              activeTab === id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === 'overview' && (
            <OverviewTab group={group} trips={trips} copyCode={copyCode} copied={copied} />
          )}
          {activeTab === 'expenses' && (
            <GroupExpensesTab groupId={groupId!} currency={currency} />
          )}
          {activeTab === 'analytics' && (
            <GroupAnalyticsTab groupId={groupId!} currency={currency} />
          )}
          {activeTab === 'ai' && (
            <div className="h-[65vh] flex flex-col border rounded-xl overflow-hidden bg-card">
              <AIChatPanel
                mutationFn={(msg) => aiService.chatbotGroup(groupId!, msg)}
                placeholder="Ask about group expenses…"
                emptyTitle="Ask about group spending"
                emptySubtitle='"Who paid the most?" · "What did we spend on food?"'
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
