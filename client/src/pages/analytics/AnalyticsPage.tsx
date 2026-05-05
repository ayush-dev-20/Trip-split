import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '@/services/analyticsService';
import { useTrips } from '@/hooks/useTrips';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import {
  BarChart3, TrendingUp, MapPin, Wallet, Receipt,
  CalendarDays, ArrowUpRight, ArrowDownRight, CheckCircle2,
  Clock, AlertTriangle, DollarSign, PieChart as PieChartIcon,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, Line, Legend, Area, AreaChart,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ─── Consistent colour palette ────────────────────────────
const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48', '#a855f7', '#0ea5e9', '#d97706',
];

const CATEGORY_COLORS: Record<string, string> = {
  FOOD: '#ef4444',
  TRANSPORT: '#3b82f6',
  ACCOMMODATION: '#8b5cf6',
  ACTIVITIES: '#f59e0b',
  SHOPPING: '#ec4899',
  ENTERTAINMENT: '#06b6d4',
  HEALTH: '#10b981',
  COMMUNICATION: '#6366f1',
  FEES: '#f97316',
  MISCELLANEOUS: '#64748b',
};

const SPLIT_COLORS: Record<string, string> = {
  EQUAL: '#3b82f6',
  PERCENTAGE: '#f59e0b',
  EXACT: '#10b981',
  SHARES: '#8b5cf6',
};

function getCategoryColor(category: string, idx: number) {
  return CATEGORY_COLORS[category] || COLORS[idx % COLORS.length];
}

function fmt(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// ─── Stat Card ────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, className }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-xl font-bold tracking-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className="rounded-lg bg-primary/10 p-2">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Chart Card wrapper ───────────────────────────────────
// scrollable=true wraps children in a horizontal scroll container with a
// minimum width so charts don't get squished on narrow phone screens.
function ChartCard({ title, children, className, minW = 280 }: {
  title: string;
  children: React.ReactNode;
  className?: string;
  minW?: number;
}) {
  return (
    <Card className={className}>
      <CardContent className="p-4 sm:p-5">
        <h3 className="text-sm font-semibold mb-3">{title}</h3>
        <div className="chart-scroll -mx-1 px-1">
          <div style={{ minWidth: minW }}>
            {children}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Custom tooltip ───────────────────────────────────────
function CustomTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-popover-foreground">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? fmt(p.value, currency || '') : p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────
export default function AnalyticsPage() {
  const { data: tripsData, isLoading: tripsLoading } = useTrips();
  const [selectedTrip, setSelectedTrip] = useState('');
  const trips = tripsData?.trips ?? [];

  // Auto-select most recent active trip
  useEffect(() => {
    if (trips.length > 0 && !selectedTrip) {
      const active = trips.find((t) => t.status === 'ACTIVE');
      setSelectedTrip(active?.id ?? trips[0].id);
    }
  }, [trips, selectedTrip]);

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics', selectedTrip],
    queryFn: () => analyticsService.getTripAnalytics(selectedTrip),
    enabled: !!selectedTrip,
  });

  const { data: yearReview } = useQuery({
    queryKey: ['yearInReview'],
    queryFn: () => analyticsService.yearInReview(),
  });

  if (tripsLoading) return <PageLoader />;

  // Trip currency: use analytics once loaded, immediately fall back to trips list (never waits for async)
  const tripCurrency = analytics?.summary?.currency
    || trips.find((t) => t.id === selectedTrip)?.budgetCurrency
    || trips[0]?.budgetCurrency
    || 'USD';

  // Year-in-review currency — from API (authoritative), fallback to tripCurrency
  const yearCurrency = yearReview?.currency || tripCurrency;

  const currency = tripCurrency;

  // Year-in-review category data for horizontal bar
  const yearCategoryData = yearReview?.categoryBreakdown
    ? Object.entries(yearReview.categoryBreakdown)
        .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
        .sort((a, b) => b.total - a.total)
    : [];

  // Budget health
  const budgetRatio = analytics?.summary?.budget
    ? analytics.summary.totalSpent / analytics.summary.budget
    : 0;
  const budgetColor = budgetRatio <= 0.6 ? 'text-green-500' : budgetRatio <= 0.85 ? 'text-amber-500' : 'text-red-500';
  const budgetBarColor = budgetRatio <= 0.6 ? 'bg-green-500' : budgetRatio <= 0.85 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Deep dive into your spending patterns</p>
      </div>

      {/* ═══════════ SECTION A — Year in Review ═══════════ */}
      {yearReview && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" /> Year in Review
          </h2>

          {/* A1: Summary stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <StatCard icon={DollarSign} label="Total Spent" value={fmt(yearReview.totalSpent, yearCurrency)} sub={`across ${yearReview.totalExpenses} expenses`} />
            <StatCard icon={MapPin} label="Trips Taken" value={String(yearReview.totalTrips)} sub={`${yearReview.destinationCount ?? yearReview.topDestinations?.length ?? 0} destinations`} />
            <StatCard icon={Receipt} label="Avg Per Trip" value={fmt(yearReview.avgPerTrip ?? 0, yearCurrency)} />
            <StatCard icon={PieChartIcon} label="Top Category" value={yearReview.topCategory || 'N/A'} />
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            {/* A2: Monthly Spending Trend — Column chart */}
            {yearReview.monthlySpending && yearReview.monthlySpending.length > 0 && (
              <ChartCard title="Monthly Spending">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={yearReview.monthlySpending} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="month" className="text-xs" tickLine={false} axisLine={false} />
                    <YAxis className="text-xs" tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip currency={yearCurrency} />} />
                    <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Spent" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* A3: Category Breakdown — Horizontal bar */}
            {yearCategoryData.length > 0 && (
              <ChartCard title="Spending by Category">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={yearCategoryData} layout="vertical" barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                    <XAxis type="number" className="text-xs" tickLine={false} axisLine={false} />
                    <YAxis dataKey="category" type="category" width={90} className="text-xs" tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip currency={yearCurrency} />} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]} name="Total">
                      {yearCategoryData.map((entry, idx) => (
                        <Cell key={idx} fill={getCategoryColor(entry.category, idx)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          {/* A4: Top Destinations */}
          {yearReview.topDestinations && yearReview.topDestinations.length > 0 && (
            <ChartCard title="Trips by Destination">
              <ResponsiveContainer width="100%" height={Math.max(140, yearReview.topDestinations.length * 40)}>
                <BarChart data={yearReview.topDestinations} layout="vertical" barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} className="text-xs" tickLine={false} axisLine={false} />
                  <YAxis dataKey="destination" type="category" width={90} className="text-xs" tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Trips" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </motion.div>
      )}

      <Separator />

      {/* ═══════════ SECTION B — Trip Analytics ═══════════ */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" /> Trip Analytics
          </h2>
          <Select value={selectedTrip} onValueChange={setSelectedTrip}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Select a trip" />
            </SelectTrigger>
            <SelectContent>
              {trips.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {analyticsLoading && selectedTrip && <PageLoader />}

        <AnimatePresence mode="wait">
          {analytics && (
            <motion.div
              key={selectedTrip}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
              className="space-y-5"
            >
              {/* B1: Trip Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
                <StatCard icon={DollarSign} label="Total Spent" value={fmt(analytics.summary.totalSpent, currency)} />
                <StatCard icon={Wallet} label="Budget" value={analytics.summary.budget ? fmt(analytics.summary.budget, currency) : 'No budget'} />
                <StatCard
                  icon={analytics.summary.remainingBudget != null && analytics.summary.remainingBudget >= 0 ? ArrowUpRight : ArrowDownRight}
                  label="Remaining"
                  value={analytics.summary.remainingBudget != null ? fmt(analytics.summary.remainingBudget, currency) : '—'}
                  className={analytics.summary.remainingBudget != null && analytics.summary.remainingBudget < 0 ? 'border-red-500/30' : ''}
                />
                <StatCard icon={Receipt} label="Expenses" value={String(analytics.summary.totalTransactions)} />
                <StatCard icon={CalendarDays} label="Daily Average" value={fmt(analytics.summary.avgDailySpend, currency)} />
                <StatCard
                  icon={CheckCircle2}
                  label="Settled"
                  value={`${analytics.settlementProgress.percentage}%`}
                  sub={analytics.settlementProgress.outstanding > 0 ? `${fmt(analytics.settlementProgress.outstanding, currency)} still outstanding` : 'All settled up!'}
                />
              </div>

              {/* B2: Budget Health Bar */}
              {analytics.summary.budget != null && analytics.summary.budget > 0 && (
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold">Budget Health</h3>
                      <span className={cn('text-sm font-bold', budgetColor)}>
                        {Math.round(budgetRatio * 100)}% used
                      </span>
                    </div>
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', budgetBarColor)}
                        style={{ width: `${Math.min(budgetRatio * 100, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                      <span>{fmt(0, currency)}</span>
                      <span>{fmt(analytics.summary.budget, currency)}</span>
                    </div>
                    {budgetRatio > 1 && (
                      <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Over budget by {fmt(Math.abs(analytics.summary.remainingBudget ?? 0), currency)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="grid lg:grid-cols-2 gap-5">
                {/* B3: Category Breakdown — Horizontal bar */}
                {analytics.categoryBreakdown.length > 0 && (
                  <ChartCard title="Category Breakdown">
                    <ResponsiveContainer width="100%" height={Math.max(180, analytics.categoryBreakdown.length * 36)}>
                      <BarChart
                        data={[...analytics.categoryBreakdown].sort((a, b) => b.total - a.total)}
                        layout="vertical"
                        barSize={16}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                        <XAxis type="number" className="text-xs" tickLine={false} axisLine={false} />
                        <YAxis dataKey="category" type="category" width={90} className="text-xs" tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip currency={currency} />} />
                        <Bar dataKey="total" radius={[0, 4, 4, 0]} name="Spent">
                          {[...analytics.categoryBreakdown]
                            .sort((a, b) => b.total - a.total)
                            .map((entry, idx) => (
                              <Cell key={idx} fill={getCategoryColor(entry.category, idx)} />
                            ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}

                {/* B4: Daily Spending — Column chart */}
                {analytics.dailySpending.length > 0 && (
                  <ChartCard title="Daily Spending">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={analytics.dailySpending} barSize={analytics.dailySpending.length <= 7 ? 32 : 16}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                        <XAxis dataKey="date" className="text-xs" tickLine={false} axisLine={false} />
                        <YAxis className="text-xs" tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip currency={currency} />} />
                        <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Spent" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}
              </div>

              {/* B5: Budget vs Actual — Area chart */}
              {analytics.budgetVsActual.length > 0 && (
                <ChartCard title="Budget vs Actual (Cumulative)">
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={analytics.budgetVsActual}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" className="text-xs" tickLine={false} axisLine={false} />
                      <YAxis className="text-xs" tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip currency={currency} />} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="cumulative"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.12}
                        strokeWidth={2}
                        name="Cumulative Spent"
                      />
                      {analytics.budgetVsActual[0]?.budget != null && (
                        <Line
                          type="monotone"
                          dataKey="budget"
                          stroke="#ef4444"
                          strokeWidth={2}
                          strokeDasharray="6 3"
                          dot={false}
                          name="Budget"
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              <div className="grid lg:grid-cols-2 gap-5">
                {/* B6: Per Member — Grouped horizontal bar */}
                {analytics.perUser.length > 0 && (
                  <ChartCard title="Per Member Contribution">
                    <ResponsiveContainer width="100%" height={Math.max(180, analytics.perUser.length * 52)}>
                      <BarChart data={analytics.perUser} layout="vertical" barSize={12} barGap={2}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                        <XAxis type="number" className="text-xs" tickLine={false} axisLine={false} />
                        <YAxis dataKey="name" type="category" width={80} className="text-xs" tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip currency={currency} />} />
                        <Legend />
                        <Bar dataKey="paid" fill="#10b981" radius={[0, 4, 4, 0]} name="Contributed" />
                        <Bar dataKey="owes" fill="#6366f1" radius={[0, 4, 4, 0]} name="Fair Share" />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
                      {analytics.perUser.map((u) => (
                        <Badge key={u.userId} variant={u.net >= 0 ? 'default' : 'destructive'} className="text-xs">
                          {u.name}: {u.net >= 0 ? '+' : ''}{fmt(u.net, currency)}
                        </Badge>
                      ))}
                    </div>
                  </ChartCard>
                )}

                {/* B7: Spending by Day of Week — Column chart */}
                {analytics.spendingByDayOfWeek && analytics.spendingByDayOfWeek.some((d) => d.amount > 0) && (
                  <ChartCard title="Spending by Day of Week">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={analytics.spendingByDayOfWeek} barSize={28}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                        <XAxis dataKey="day" className="text-xs" tickLine={false} axisLine={false} />
                        <YAxis className="text-xs" tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip currency={currency} />} />
                        <Bar dataKey="amount" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Spent" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                )}
              </div>

              <div className="grid lg:grid-cols-2 gap-5">
                {/* B8: Top 5 Expenses — Table */}
                {analytics.topExpenses.length > 0 && (
                  <ChartCard title="Top Expenses">
                    <div className="space-y-2">
                      {analytics.topExpenses.map((e, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{e.title}</p>
                              <p className="text-xs text-muted-foreground">{e.paidBy} · {e.category} · {e.date}</p>
                            </div>
                          </div>
                          <span className="text-sm font-bold whitespace-nowrap">{fmt(e.amount, currency)}</span>
                        </div>
                      ))}
                    </div>
                  </ChartCard>
                )}

                <div className="space-y-5">
                  {/* B9: Split Type Distribution — Donut */}
                  {analytics.splitTypeDistribution.length > 0 && (
                    <ChartCard title="Split Type Distribution">
                      <ResponsiveContainer width="100%" height={220}>
                        <RechartsPie>
                          <Pie
                            data={analytics.splitTypeDistribution}
                            dataKey="count"
                            nameKey="type"
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={85}
                            paddingAngle={3}
                            label={({ type, count }) => `${type} (${count})`}
                          >
                            {analytics.splitTypeDistribution.map((entry) => (
                              <Cell key={entry.type} fill={SPLIT_COLORS[entry.type] || '#64748b'} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </RechartsPie>
                      </ResponsiveContainer>
                    </ChartCard>
                  )}

                  {/* B10: Settlement Progress */}
                  <ChartCard title="Settlement Progress">
                    <div className="flex items-center gap-5">
                      <div className="relative h-20 w-20 flex-shrink-0">
                        <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            className="stroke-muted"
                            strokeWidth="3"
                          />
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="3"
                            strokeDasharray={`${analytics.settlementProgress.percentage}, 100`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                          {analytics.settlementProgress.percentage}%
                        </span>
                      </div>
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Total Debt</span>
                          <span className="font-medium">{fmt(analytics.settlementProgress.total, currency)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-green-500">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Settled
                          </span>
                          <span className="font-medium">{fmt(analytics.settlementProgress.settled, currency)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-amber-500">
                            <Clock className="h-3.5 w-3.5" /> Outstanding
                          </span>
                          <span className="font-medium">{fmt(analytics.settlementProgress.outstanding, currency)}</span>
                        </div>
                        {analytics.settlementProgress.pending > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 text-blue-500">
                              <Clock className="h-3.5 w-3.5" /> Pending Confirmation
                            </span>
                            <span className="font-medium">{fmt(analytics.settlementProgress.pending, currency)}</span>
                          </div>
                        )}
                        {analytics.settlementProgress.disputed > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5 text-red-500">
                              <AlertTriangle className="h-3.5 w-3.5" /> Disputed
                            </span>
                            <span className="font-medium">{fmt(analytics.settlementProgress.disputed, currency)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </ChartCard>
                </div>
              </div>

              {/* Spending Velocity */}
              {analytics.spendingVelocity && (
                <Card className="bg-muted/30">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" /> Spending Velocity
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                      <div>
                        <p className="text-xl font-bold">{fmt(analytics.spendingVelocity.dailyAverage, currency)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Daily Average</p>
                      </div>
                      <div>
                        <p className="text-xl font-bold">{fmt(analytics.spendingVelocity.projectedTotal, currency)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Projected Total</p>
                      </div>
                      <div>
                        <p className="text-xl font-bold">{analytics.spendingVelocity.daysElapsed}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Days Elapsed</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!selectedTrip && !analyticsLoading && (
          <div className="py-16 text-center text-muted-foreground">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Select a trip to view detailed analytics</p>
          </div>
        )}
      </div>
    </div>
  );
}
