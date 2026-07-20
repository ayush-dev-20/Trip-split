import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { personalExpenseService } from '@/services/personalExpenseService';
import type { CreatePersonalExpensePayload, PersonalAnalyticsPeriod } from '@/types';
import { getNextDueDate } from '@/lib/recurring';
import type { RecurringFrequency } from '@/types';
import { aiService } from '@/services/aiService';
import { useAnomalyStore } from '@/stores/anomalyStore';

export function usePersonalExpenses(params?: {
  startDate?: string;
  endDate?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['personal-expenses', params],
    queryFn: () => personalExpenseService.getAll(params),
    staleTime: 60_000,
  });
}

export function usePersonalExpense(id: string) {
  return useQuery({
    queryKey: ['personal-expenses', id],
    queryFn: () => personalExpenseService.getById(id),
    enabled: !!id,
  });
}

export function usePersonalExpensesCalendar(year: number, month: number) {
  return useQuery({
    queryKey: ['personal-expenses-calendar', year, month],
    queryFn: () => personalExpenseService.getCalendar(year, month),
    staleTime: 60_000,
  });
}

export function useRecurringExpenses() {
  return useQuery({
    queryKey: ['personal-expenses', 'recurring'],
    queryFn: async () => {
      const expenses = await personalExpenseService.getRecurring();
      return expenses.map((e) => ({
        ...e,
        nextDueDate: getNextDueDate(
          e.date,
          (e.recurringPattern ?? 'monthly') as RecurringFrequency,
        ),
      }));
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function usePersonalBudgetStatus() {
  return useQuery({
    queryKey: ['personal-expenses', 'budget-status'],
    queryFn: () => personalExpenseService.getBudgetStatus(),
    staleTime: 60_000,
  });
}

export function useCreatePersonalExpense() {
  const qc = useQueryClient();
  const setAnomaly = useAnomalyStore((s) => s.setAnomaly);
  return useMutation({
    mutationFn: (data: CreatePersonalExpensePayload) => personalExpenseService.create(data),
    onSuccess: (expense) => {
      qc.invalidateQueries({ queryKey: ['personal-expenses'] });
      qc.invalidateQueries({ queryKey: ['personal-expenses-calendar'] });
      qc.invalidateQueries({ queryKey: ['personal-analytics'] });
      qc.invalidateQueries({ queryKey: ['personal-expenses', 'budget-status'] });

      aiService
        .detectAnomaly({ title: expense.title, amount: expense.baseAmount, category: expense.category })
        .then((result) => {
          if (result.isAnomaly && result.reason) {
            setAnomaly({
              expenseId: expense.id,
              title: expense.title,
              amount: expense.amount,
              currency: expense.currency,
              reason: result.reason,
            });
          }
        })
        .catch(() => {}); // best-effort — never block or surface an error for this enrichment call
    },
  });
}

export function useUpdatePersonalExpense(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreatePersonalExpensePayload>) => personalExpenseService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personal-expenses'] });
      qc.invalidateQueries({ queryKey: ['personal-expenses-calendar'] });
      qc.invalidateQueries({ queryKey: ['personal-analytics'] });
      qc.invalidateQueries({ queryKey: ['personal-expenses', 'recurring'] });
      qc.invalidateQueries({ queryKey: ['personal-expenses', 'budget-status'] });
    },
  });
}

export function useDeletePersonalExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => personalExpenseService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personal-expenses'] });
      qc.invalidateQueries({ queryKey: ['personal-expenses-calendar'] });
      qc.invalidateQueries({ queryKey: ['personal-analytics'] });
      qc.invalidateQueries({ queryKey: ['personal-expenses', 'recurring'] });
      qc.invalidateQueries({ queryKey: ['personal-expenses', 'budget-status'] });
    },
  });
}

export function usePersonalAnalytics(
  params: {
    period?: PersonalAnalyticsPeriod;
    referenceDate?: string;
    startDate?: string;
    endDate?: string;
  },
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['personal-analytics', params],
    queryFn: () => personalExpenseService.getAnalytics(params),
    enabled,
    staleTime: 2 * 60_000,
  });
}
