import { useState } from 'react';
import { BarChart3, MapPin, Users2, X, Receipt, Wallet, CheckCircle2, DollarSign, TrendingUp } from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import { StatCard, ChartCard, fmt, CustomTooltip, getCategoryColor } from '@/lib/analyticsHelpers';
import { useTripsOverview, useGroupsOverview } from '@/hooks/useAnalyticsOverview';
import { usePersonalAnalytics } from '@/hooks/usePersonalExpenses';
import { cn } from '@/lib/utils';

type Tab = 'overview' | 'trips' | 'groups';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'trips',    label: 'Trips',    icon: MapPin },
  { id: 'groups',   label: 'Groups',   icon: Users2 },
];

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const dateParams = { startDate: startDate || undefined, endDate: endDate || undefined };

  const tripsOverview  = useTripsOverview(dateParams, activeTab === 'overview' || activeTab === 'trips');
  const groupsOverview = useGroupsOverview(dateParams, activeTab === 'overview' || activeTab === 'groups');
  const personal = usePersonalAnalytics(
    startDate && endDate ? { startDate, endDate } : { period: 'month' },
    activeTab === 'overview'
  );
  // Overview always fetches month-scoped personal data unless a custom range
  // is set, matching the same "custom range requires both dates" rule used
  // on the Daily Expense analytics tab.

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl sm:text-[1.75rem] font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Your spending across every trip and group</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                activeTab === id
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-[150px] text-sm h-9"
            aria-label="Range start date"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-[150px] text-sm h-9"
            aria-label="Range end date"
          />
          {(startDate || endDate) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => { setStartDate(''); setEndDate(''); }}
              aria-label="Clear date range"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {activeTab === 'overview' && (
        tripsOverview.isLoading || groupsOverview.isLoading || personal.isLoading ? (
          <PageLoader />
        ) : tripsOverview.data && groupsOverview.data && personal.data ? (
          <div className="space-y-5">
            {(() => {
              const currency = tripsOverview.data!.currency;
              const combinedTotal =
                tripsOverview.data!.totalSpent + groupsOverview.data!.totalSpent + personal.data!.totalSpent;
              const splitData = [
                { name: 'Trips', value: tripsOverview.data!.totalSpent },
                { name: 'Groups', value: groupsOverview.data!.totalSpent },
                { name: 'Personal', value: personal.data!.totalSpent },
              ].filter((d) => d.value > 0);
              const SPLIT_COLORS = ['#3b82f6', '#8b5cf6', '#10b981'];

              return (
                <>
                  <StatCard icon={Wallet} label="Combined Total" value={fmt(combinedTotal, currency)} className="sm:max-w-xs" />

                  <div className="grid grid-cols-3 gap-3">
                    <StatCard icon={MapPin} label="Total Trips" value={String(tripsOverview.data!.totalTrips)} />
                    <StatCard icon={Users2} label="Total Groups" value={String(groupsOverview.data!.totalGroups)} />
                    <StatCard icon={Receipt} label="Personal Transactions" value={String(personal.data!.transactionCount)} />
                  </div>

                  {splitData.length > 0 && (
                    <ChartCard title="Where your money goes">
                      <ResponsiveContainer width="100%" height={240}>
                        <RechartsPie>
                          <Pie
                            data={splitData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={90}
                            paddingAngle={3}
                            label={({ name, value }) => `${name} ${fmt(value, currency)}`}
                          >
                            {splitData.map((_, idx) => (
                              <Cell key={idx} fill={SPLIT_COLORS[idx % SPLIT_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => fmt(v, currency)} />
                        </RechartsPie>
                      </ResponsiveContainer>
                    </ChartCard>
                  )}
                </>
              );
            })()}
          </div>
        ) : null
      )}
      {activeTab === 'trips' && (
        tripsOverview.isLoading ? (
          <PageLoader />
        ) : tripsOverview.data ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={MapPin} label="Total Trips" value={String(tripsOverview.data.totalTrips)} />
              <StatCard icon={DollarSign} label="Total Spent" value={fmt(tripsOverview.data.totalSpent, tripsOverview.data.currency)} />
              <StatCard icon={TrendingUp} label="Avg per Trip" value={fmt(tripsOverview.data.avgPerTrip, tripsOverview.data.currency)} />
              <StatCard
                icon={CheckCircle2}
                label="Budget Commitment"
                value={`${tripsOverview.data.budgetCommitment.percentage}%`}
                sub={`${tripsOverview.data.budgetCommitment.tripsUnderBudget}/${tripsOverview.data.budgetCommitment.tripsWithBudget} trips`}
              />
            </div>

            {tripsOverview.data.categoryBreakdown.length > 0 && (
              <ChartCard title="Category Breakdown">
                <ResponsiveContainer width="100%" height={Math.max(180, tripsOverview.data.categoryBreakdown.length * 36)}>
                  <BarChart data={tripsOverview.data.categoryBreakdown} layout="vertical" barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                    <XAxis type="number" className="text-xs" tickLine={false} axisLine={false} />
                    <YAxis dataKey="category" type="category" width={90} className="text-xs" tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip currency={tripsOverview.data.currency} />} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]} name="Spent">
                      {tripsOverview.data.categoryBreakdown.map((entry, idx) => (
                        <Cell key={idx} fill={getCategoryColor(entry.category, idx)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {tripsOverview.data.spendingOverTime.length > 0 && (
              <ChartCard title="Spending Over Time">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={tripsOverview.data.spendingOverTime} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="label" className="text-xs" tickLine={false} axisLine={false} />
                    <YAxis className="text-xs" tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip currency={tripsOverview.data.currency} />} />
                    <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Spent" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {tripsOverview.data.topDestinations.length > 0 && (
              <ChartCard title="Top Destinations">
                <ResponsiveContainer width="100%" height={Math.max(140, tripsOverview.data.topDestinations.length * 40)}>
                  <BarChart data={tripsOverview.data.topDestinations} layout="vertical" barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} className="text-xs" tickLine={false} axisLine={false} />
                    <YAxis dataKey="destination" type="category" width={90} className="text-xs" tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Trips" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {tripsOverview.data.settlementProgress.total > 0 && (
              <ChartCard title="Settlement Progress (All Trips)">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Debt</span>
                    <span className="font-medium">{fmt(tripsOverview.data.settlementProgress.total, tripsOverview.data.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-green-500">Settled</span>
                    <span className="font-medium">{fmt(tripsOverview.data.settlementProgress.settled, tripsOverview.data.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-amber-500">Outstanding</span>
                    <span className="font-medium">{fmt(tripsOverview.data.settlementProgress.outstanding, tripsOverview.data.currency)}</span>
                  </div>
                </div>
              </ChartCard>
            )}
          </div>
        ) : null
      )}
      {activeTab === 'groups' && (
        groupsOverview.isLoading ? (
          <PageLoader />
        ) : groupsOverview.data ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={Users2} label="Total Groups" value={String(groupsOverview.data.totalGroups)} />
              <StatCard icon={DollarSign} label="Total Spent" value={fmt(groupsOverview.data.totalSpent, groupsOverview.data.currency)} />
              <StatCard icon={TrendingUp} label="Avg per Group" value={fmt(groupsOverview.data.avgPerGroup, groupsOverview.data.currency)} />
              <StatCard
                icon={Receipt}
                label="Most Active"
                value={groupsOverview.data.mostActiveGroup?.name ?? '—'}
                sub={groupsOverview.data.mostActiveGroup ? `${groupsOverview.data.mostActiveGroup.expenseCount} expenses` : undefined}
              />
            </div>

            {groupsOverview.data.categoryBreakdown.length > 0 && (
              <ChartCard title="Category Breakdown">
                <ResponsiveContainer width="100%" height={Math.max(180, groupsOverview.data.categoryBreakdown.length * 36)}>
                  <BarChart data={groupsOverview.data.categoryBreakdown} layout="vertical" barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                    <XAxis type="number" className="text-xs" tickLine={false} axisLine={false} />
                    <YAxis dataKey="category" type="category" width={90} className="text-xs" tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip currency={groupsOverview.data.currency} />} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]} name="Spent">
                      {groupsOverview.data.categoryBreakdown.map((entry, idx) => (
                        <Cell key={idx} fill={getCategoryColor(entry.category, idx)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {groupsOverview.data.spendingOverTime.length > 0 && (
              <ChartCard title="Spending Over Time">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={groupsOverview.data.spendingOverTime} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="label" className="text-xs" tickLine={false} axisLine={false} />
                    <YAxis className="text-xs" tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip currency={groupsOverview.data.currency} />} />
                    <Bar dataKey="amount" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Spent" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {groupsOverview.data.groups.length > 0 && (
              <ChartCard title="Per-Group Breakdown">
                <div className="space-y-2">
                  {groupsOverview.data.groups.map((g) => (
                    <Card key={g.groupId} className="p-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{g.name}</p>
                        <p className="text-xs text-muted-foreground">{g.memberCount} members · {fmt(g.totalSpent, groupsOverview.data!.currency)}</p>
                      </div>
                      <Badge variant={g.yourBalance >= 0 ? 'default' : 'destructive'} className="text-xs">
                        {g.yourBalance >= 0 ? '+' : ''}{fmt(g.yourBalance, groupsOverview.data!.currency)}
                      </Badge>
                    </Card>
                  ))}
                </div>
              </ChartCard>
            )}

            {groupsOverview.data.settlementProgress.total > 0 && (
              <ChartCard title="Settlement Progress (All Groups)">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Debt</span>
                    <span className="font-medium">{fmt(groupsOverview.data.settlementProgress.total, groupsOverview.data.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-green-500">Settled</span>
                    <span className="font-medium">{fmt(groupsOverview.data.settlementProgress.settled, groupsOverview.data.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-amber-500">Outstanding</span>
                    <span className="font-medium">{fmt(groupsOverview.data.settlementProgress.outstanding, groupsOverview.data.currency)}</span>
                  </div>
                </div>
              </ChartCard>
            )}
          </div>
        ) : null
      )}
    </div>
  );
}
