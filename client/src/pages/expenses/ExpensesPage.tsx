import { useParams, Link } from 'react-router';
import { useExpenses } from '@/hooks/useExpenses';
import { useTrip } from '@/hooks/useTrips';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import { Receipt, Plus, ArrowLeft, Search } from 'lucide-react';
import { useState } from 'react';
import type { ExpenseCategory } from '@/types';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const CATEGORIES: ExpenseCategory[] = [
  'FOOD', 'TRANSPORT', 'ACCOMMODATION', 'ACTIVITIES', 'SHOPPING',
  'HEALTH', 'COMMUNICATION', 'ENTERTAINMENT', 'FEES', 'MISCELLANEOUS',
];

const categoryEmoji: Record<string, string> = {
  FOOD: '🍕', TRANSPORT: '🚗', ACCOMMODATION: '🏨', ACTIVITIES: '🎯',
  SHOPPING: '🛍️', HEALTH: '💊', COMMUNICATION: '📱', ENTERTAINMENT: '🎬',
  FEES: '💰', MISCELLANEOUS: '📦',
};

export default function ExpensesPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const { data: trip } = useTrip(tripId!);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ExpenseCategory | ''>('');
  const { data, isLoading } = useExpenses(tripId!, category ? { category } : undefined);

  if (isLoading) return <PageLoader />;

  const expenses = (data?.expenses ?? []).filter((e) =>
    e.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/trips/${tripId}`}><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Expenses</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{trip?.name}</p>
          </div>
        </div>
        <Button asChild>
          <Link to={`/trips/${tripId}/expenses/new`}><Plus className="h-4 w-4 mr-2" /> Add Expense</Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search expenses..." className="pl-10" />
        </div>
        <Select
          value={category || '__all__'}
          onValueChange={(v) => setCategory(v === '__all__' ? '' : v as ExpenseCategory)}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{categoryEmoji[c]} {c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Expense List */}
      {expenses.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-8 w-8" />}
          title="No expenses found"
          description={search || category ? 'Try adjusting your filters' : 'Add your first expense to start tracking'}
          action={
            !search && !category && (
              <Button asChild><Link to={`/trips/${tripId}/expenses/new`}><Plus className="h-4 w-4 mr-2" /> Add Expense</Link></Button>
            )
          }
        />
      ) : (
        <div className="space-y-2">
          {expenses.map((expense, i) => (
            <motion.div key={expense.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
              <Link to={`/trips/${tripId}/expenses/${expense.id}`}>
                <Card className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-muted text-lg shrink-0">
                      {categoryEmoji[expense.category] ?? '📦'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{expense.title}</p>
                        <Badge variant="secondary" className="text-[10px] shrink-0">{expense.splitType}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Paid by {expense.paidBy?.name} · {new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">
                        {expense.currency} {expense.amount.toFixed(2)}
                      </p>
                      {expense.convertedAmount && expense.convertedAmount !== expense.amount && (
                        <p className="text-xs text-muted-foreground">
                          ≈ {trip?.budgetCurrency} {expense.convertedAmount.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
