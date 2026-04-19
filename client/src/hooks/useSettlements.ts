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

export function useSettlements(tripId: string) {
  return useQuery({
    queryKey: ['settlements', tripId],
    queryFn: () => settlementService.getAll(tripId),
    enabled: !!tripId,
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
    mutationFn: (settlementId: string) => settlementService.settle(tripId, settlementId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settlements', tripId] });
      qc.invalidateQueries({ queryKey: ['settlements', tripId, 'balances'] });
      qc.invalidateQueries({ queryKey: ['analytics', tripId] });
    },
  });
}
