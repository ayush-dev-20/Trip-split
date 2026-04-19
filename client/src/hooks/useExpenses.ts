import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expenseService } from '@/services/expenseService';
import { analyticsService } from '@/services/analyticsService';
import type { ExpenseCategory } from '@/types';

export function useExpenses(
  tripId: string,
  params?: { page?: number; category?: ExpenseCategory; paidById?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }
) {
  return useQuery({
    queryKey: ['expenses', tripId, params],
    queryFn: () => expenseService.getAll(tripId, params),
    enabled: !!tripId,
  });
}

export function useExpense(tripId: string, expenseId: string) {
  return useQuery({
    queryKey: ['expenses', tripId, expenseId],
    queryFn: () => expenseService.getById(tripId, expenseId),
    enabled: !!tripId && !!expenseId,
  });
}

export function useCreateExpense(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof expenseService.create>[1]) =>
      expenseService.create(tripId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', tripId] });
      qc.invalidateQueries({ queryKey: ['trips', tripId] });
      qc.invalidateQueries({ queryKey: ['settlements', tripId] });
    },
  });
}

export function useUpdateExpense(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, ...data }: { expenseId: string } & Record<string, unknown>) =>
      expenseService.update(tripId, expenseId, data as Parameters<typeof expenseService.update>[2]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', tripId] });
      qc.invalidateQueries({ queryKey: ['trips', tripId] });
      qc.invalidateQueries({ queryKey: ['settlements', tripId] });
    },
  });
}

export function useDeleteExpense(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) => expenseService.delete(tripId, expenseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', tripId] });
      qc.invalidateQueries({ queryKey: ['trips', tripId] });
      qc.invalidateQueries({ queryKey: ['settlements', tripId] });
    },
  });
}

export function useAddComment(tripId: string, expenseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => expenseService.addComment(tripId, expenseId, content),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses', tripId, expenseId] }),
  });
}

export function useAddReaction(tripId: string, expenseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (emoji: string) => expenseService.addReaction(tripId, expenseId, emoji),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses', tripId, expenseId] }),
  });
}

/**
 * Fetches the current user's personal expense breakdown — each expense they
 * participate in (their split share), plus a totalSpent grand total.
 * Uses GET /api/analytics/my-expenses
 */
export function useMyExpenses(year?: number, tripId?: string) {
  return useQuery({
    queryKey: ['my-expenses', year, tripId],
    queryFn: () => analyticsService.getMyExpenses(year, tripId),
    staleTime: 2 * 60 * 1000,
  });
}
