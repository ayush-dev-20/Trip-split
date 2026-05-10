import { useParams, Link } from 'react-router';
import { useExpenses } from '@/hooks/useExpenses';
import { useTrip } from '@/hooks/useTrips';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import { Receipt, Plus, Search } from 'lucide-react';
import { useState, useMemo } from 'react';
import type { ExpenseCategory } from '@/types';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { CATEGORY_STYLES, getCategoryStyle } from '@/lib/categoryStyle';
import { formatMoney, formatRelativeDay } from '@/lib/format';
import { cn } from '@/lib/utils';

const CATEGORIES: ExpenseCategory[] = [
  'FOOD', 'TRANSPORT', 'ACCOMMODATION', 'ACTIVITIES', 'SHOPPING',
  'HEALTH', 'COMMUNICATION', 'ENTERTAINMENT', 'FEES', 'MISCELLANEOUS',
];

export default function ExpensesPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const { data: trip } = useTrip(tripId!);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ExpenseCategory | ''>('');
  const { data, isLoading } = useExpenses(tripId!, category ? { category } : undefined);

  const filtered = useMemo(() => (data?.expenses ?? []).filter((e) =>
    e.title.toLowerCase().includes(search.toLowerCase())
  ), [data, search]);

  // Group by date — like a banking app
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach((e) => {
      const key = formatRelativeDay(e.date);
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const total = filtered.reduce((sum, e) => sum + (e.convertedAmount ?? e.amount), 0);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Expenses"
        description={trip?.name}
        back={`/trips/${tripId}`}
        actions={
          <Button asChild className="hidden sm:inline-flex">
            <Link to={`/trips/${tripId}/expenses/new`}>
              <Plus className="h-4 w-4" /> Add Expense
            </Link>
          </Button>
        }
      />

      {/* Total summary strip */}
      {filtered.length > 0 && trip && (
        <Card className="bg-gradient-to-br from-primary/5 to-info/5 border-primary/10">
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                {filtered.length} {filtered.length === 1 ? 'expense' : 'expenses'} total
              </p>
              <p className="text-2xl font-bold tracking-tight tabular-nums mt-0.5">
                {formatMoney(total, trip.budgetCurrency)}
              </p>
            </div>
            {category && (
              <div className={cn(
                'flex items-center justify-center h-12 w-12 rounded-xl',
                getCategoryStyle(category).bg
              )}>
                {(() => {
                  const Icon = getCategoryStyle(category).icon;
                  return <Icon className={cn('h-6 w-6', getCategoryStyle(category).fg)} />;
                })()}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search expenses..."
            className="pl-9 h-10"
          />
        </div>
        <Select
          value={category || '__all__'}
          onValueChange={(v) => setCategory(v === '__all__' ? '' : v as ExpenseCategory)}
        >
          <SelectTrigger className="w-full sm:w-[200px] h-10">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{CATEGORY_STYLES[c].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Expense list — grouped by day */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-7 w-7" />}
          title={search || category ? 'No matches found' : 'No expenses yet'}
          description={search || category ? 'Try adjusting your filters.' : 'Add your first expense to start tracking.'}
          action={
            !search && !category && (
              <Button asChild>
                <Link to={`/trips/${tripId}/expenses/new`}>
                  <Plus className="h-4 w-4" /> Add Expense
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-5">
          {grouped.map(([day, items]) => (
            <div key={day}>
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{day}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatMoney(
                    items.reduce((s, e) => s + (e.convertedAmount ?? e.amount), 0),
                    trip?.budgetCurrency ?? items[0]?.currency ?? 'USD'
                  )}
                </p>
              </div>
              <Card>
                <ul className="divide-y">
                  {items.map((expense, i) => {
                    const cat = getCategoryStyle(expense.category);
                    const Icon = cat.icon;
                    return (
                      <motion.li
                        key={expense.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.02, 0.2) }}
                      >
                        <Link
                          to={`/trips/${tripId}/expenses/${expense.id}`}
                          className="flex items-center gap-3 sm:gap-4 px-4 py-3 hover:bg-accent/50 transition-colors"
                        >
                          <div className={cn('flex items-center justify-center h-10 w-10 rounded-xl shrink-0', cat.bg)}>
                            <Icon className={cn('h-5 w-5', cat.fg)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{expense.title}</p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {expense.paidBy?.name} paid · {cat.label}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold tabular-nums">
                              {formatMoney(expense.amount, expense.currency)}
                            </p>
                            {expense.convertedAmount && expense.convertedAmount !== expense.amount && trip && (
                              <p className="text-[11px] text-muted-foreground tabular-nums">
                                ≈ {formatMoney(expense.convertedAmount, trip.budgetCurrency)}
                              </p>
                            )}
                          </div>
                        </Link>
                      </motion.li>
                    );
                  })}
                </ul>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Mobile FAB */}
      <Button
        asChild
        size="lg"
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg sm:hidden z-30"
      >
        <Link to={`/trips/${tripId}/expenses/new`} aria-label="Add Expense">
          <Plus className="h-6 w-6" />
        </Link>
      </Button>
    </div>
  );
}
