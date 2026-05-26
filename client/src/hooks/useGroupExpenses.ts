import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { groupExpenseService } from '@/services/groupExpenseService';
import { useSocketEvent } from '@/contexts/SocketContext';
import type { CreateGroupExpensePayload, GroupAnalyticsPeriod } from '@/types';

// ── Queries ───────────────────────────────────────────────────────────────────

export function useGroupExpenses(
  groupId: string,
  params?: { startDate?: string; endDate?: string; category?: string; page?: number; limit?: number },
) {
  return useQuery({
    queryKey: ['group-expenses', groupId, params],
    queryFn: () => groupExpenseService.getAll(groupId, params),
    enabled: !!groupId,
    staleTime: 60_000,
  });
}

export function useGroupExpense(groupId: string, id: string) {
  return useQuery({
    queryKey: ['group-expenses', groupId, id],
    queryFn: () => groupExpenseService.getById(groupId, id),
    enabled: !!groupId && !!id,
  });
}

export function useGroupExpensesCalendar(groupId: string, year: number, month: number) {
  return useQuery({
    queryKey: ['group-expenses-calendar', groupId, year, month],
    queryFn: () => groupExpenseService.getCalendar(groupId, year, month),
    enabled: !!groupId,
    staleTime: 60_000,
  });
}

export function useGroupAnalytics(groupId: string, period: GroupAnalyticsPeriod, referenceDate?: string) {
  return useQuery({
    queryKey: ['group-analytics', groupId, period, referenceDate],
    queryFn: () => groupExpenseService.getAnalytics(groupId, period, referenceDate),
    enabled: !!groupId,
    staleTime: 2 * 60_000,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateGroupExpense(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGroupExpensePayload) => groupExpenseService.create(groupId, data),
    onSuccess: () => invalidateAll(qc, groupId),
  });
}

export function useUpdateGroupExpense(groupId: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateGroupExpensePayload>) =>
      groupExpenseService.update(groupId, id, data),
    onSuccess: () => invalidateAll(qc, groupId),
  });
}

export function useDeleteGroupExpense(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => groupExpenseService.delete(groupId, id),
    onSuccess: () => invalidateAll(qc, groupId),
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>, groupId: string) {
  qc.invalidateQueries({ queryKey: ['group-expenses', groupId] });
  qc.invalidateQueries({ queryKey: ['group-expenses-calendar', groupId] });
  qc.invalidateQueries({ queryKey: ['group-analytics', groupId] });
}

// ── Real-time socket invalidation ─────────────────────────────────────────────

/** Call this hook inside the component that renders the group expense view.
 *  It invalidates all group-expense queries whenever another member mutates. */
export function useGroupExpenseSocket(groupId: string) {
  const qc = useQueryClient();

  useSocketEvent('group-expense:created', (data: { groupId: string }) => {
    if (data.groupId === groupId) invalidateAll(qc, groupId);
  });

  useSocketEvent('group-expense:updated', (data: { groupId: string }) => {
    if (data.groupId === groupId) invalidateAll(qc, groupId);
  });

  useSocketEvent('group-expense:deleted', (data: { groupId: string }) => {
    if (data.groupId === groupId) invalidateAll(qc, groupId);
  });

  // Stable effect: dependencies don't change after mount
  useEffect(() => {
    // No cleanup needed — useSocketEvent handles its own unsubscription
  }, [groupId]);
}
