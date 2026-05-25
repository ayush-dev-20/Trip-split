import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { personalExpenseService } from '@/services/personalExpenseService';
import type { CreatePersonalExpensePayload, PersonalAnalyticsPeriod } from '@/types';

export function usePersonalExpenses(params?: {
  startDate?: string;
  endDate?: string;
  category?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['personal-expenses', params],
    queryFn: () => personalExpenseService.getAll(params),
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

export function useCreatePersonalExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePersonalExpensePayload) => personalExpenseService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['personal-expenses'] });
      qc.invalidateQueries({ queryKey: ['personal-expenses-calendar'] });
      qc.invalidateQueries({ queryKey: ['personal-analytics'] });
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
    },
  });
}

export function usePersonalAnalytics(period: PersonalAnalyticsPeriod, referenceDate?: string) {
  return useQuery({
    queryKey: ['personal-analytics', period, referenceDate],
    queryFn: () => personalExpenseService.getAnalytics(period, referenceDate),
    staleTime: 2 * 60_000,
  });
}
