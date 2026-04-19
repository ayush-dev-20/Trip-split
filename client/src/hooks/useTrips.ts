import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tripService } from '@/services/tripService';
import type { TripStatus } from '@/types';

export function useTrips(params?: { page?: number; status?: TripStatus; groupId?: string }) {
  return useQuery({
    queryKey: ['trips', params],
    queryFn: () => tripService.getAll(params),
  });
}

export function useTrip(id: string) {
  return useQuery({
    queryKey: ['trips', id],
    queryFn: () => tripService.getById(id),
    enabled: !!id,
  });
}

export function useCreateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tripService.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trips'] }),
  });
}

export function useUpdateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      tripService.update(id, data as Parameters<typeof tripService.update>[1]),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['trips'] });
      qc.invalidateQueries({ queryKey: ['trips', vars.id] });
    },
  });
}

export function useDeleteTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tripService.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trips'] }),
  });
}

export function useJoinTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tripService.joinByCode,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trips'] }),
  });
}

export function useSyncTripStatuses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: tripService.syncStatuses,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trips'] }),
  });
}
