import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settlementService } from '@/services/settlementService';

export function useOverallBalances() {
  return useQuery({
    queryKey: ['settlements', 'overall-balances'],
    queryFn: () => settlementService.getOverallBalances(),
    staleTime: 1000 * 60 * 2, // 2 min
  });
}

export function useBalances(tripId: string) {
  return useQuery({
    queryKey: ['settlements', tripId, 'balances'],
    queryFn: () => settlementService.getBalances(tripId),
    enabled: !!tripId,
  });
}

export function useGroupBalances(groupId: string) {
  return useQuery({
    queryKey: ['settlements', 'group', groupId, 'balances'],
    queryFn: () => settlementService.getGroupBalances(groupId),
    enabled: !!groupId,
  });
}

export function useSettlements(tripId: string) {
  return useQuery({
    queryKey: ['settlements', tripId],
    queryFn: () => settlementService.getAll(tripId),
    enabled: !!tripId,
  });
}

export function useGroupSettlements(groupId: string) {
  return useQuery({
    queryKey: ['settlements', 'group', groupId],
    queryFn: () => settlementService.getAllForGroup(groupId),
    enabled: !!groupId,
  });
}

export function useCreateSettlement(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { fromUserId: string; toUserId: string; amount: number; currency?: string; note?: string }) =>
      settlementService.create(tripId, { ...data, tripId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlements', tripId] });
      qc.invalidateQueries({ queryKey: ['settlements', tripId, 'balances'] });
      qc.invalidateQueries({ queryKey: ['analytics', tripId] });
    },
  });
}

export function useSettleDebt(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { settlementId: string; amount?: number }) =>
      settlementService.settle(tripId, vars.settlementId, vars.amount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlements', tripId] });
      qc.invalidateQueries({ queryKey: ['settlements', tripId, 'balances'] });
      qc.invalidateQueries({ queryKey: ['analytics', tripId] });
    },
  });
}

export function useCreateGroupSettlement(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { fromUserId: string; toUserId: string; amount: number; currency?: string; note?: string }) =>
      settlementService.create(groupId, { ...data, groupId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlements', 'group', groupId] });
      qc.invalidateQueries({ queryKey: ['settlements', 'group', groupId, 'balances'] });
    },
  });
}

export function useSettleGroupDebt(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { settlementId: string; amount?: number }) =>
      settlementService.settle(groupId, vars.settlementId, vars.amount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlements', 'group', groupId] });
      qc.invalidateQueries({ queryKey: ['settlements', 'group', groupId, 'balances'] });
    },
  });
}

export function useSettlePlan(scope: { tripId?: string; groupId?: string }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => settlementService.settlePlan(scope),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settlements'] }),
  });
}

export function useDeleteSettlement(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settlementId: string) => settlementService.delete(settlementId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlements', tripId] });
      qc.invalidateQueries({ queryKey: ['settlements', tripId, 'balances'] });
    },
  });
}

export function useDeleteGroupSettlement(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settlementId: string) => settlementService.delete(settlementId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlements', 'group', groupId] });
      qc.invalidateQueries({ queryKey: ['settlements', 'group', groupId, 'balances'] });
    },
  });
}
