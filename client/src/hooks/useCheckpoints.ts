import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { checkpointService } from '@/services/checkpointService';

export function useCheckpoints(tripId: string) {
  return useQuery({
    queryKey: ['checkpoints', tripId],
    queryFn: () => checkpointService.getCheckpoints(tripId),
    enabled: !!tripId,
  });
}

export function useCreateCheckpoint(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof checkpointService.createCheckpoint>[1]) =>
      checkpointService.createCheckpoint(tripId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checkpoints', tripId] }),
  });
}

export function useCreateCheckpointsBulk(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (checkpoints: Parameters<typeof checkpointService.createBulk>[1]) =>
      checkpointService.createBulk(tripId, checkpoints),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checkpoints', tripId] }),
  });
}

export function useUpdateCheckpoint(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof checkpointService.updateCheckpoint>[2] }) =>
      checkpointService.updateCheckpoint(tripId, id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checkpoints', tripId] }),
  });
}

export function useDeleteCheckpoint(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => checkpointService.deleteCheckpoint(tripId, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checkpoints', tripId] }),
  });
}

export function useDeleteAllCheckpoints(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => checkpointService.deleteAll(tripId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checkpoints', tripId] }),
  });
}

export function useDeleteDayCheckpoints(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (day: number) => checkpointService.deleteByDay(tripId, day),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checkpoints', tripId] }),
  });
}
