import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { packingItemService } from '@/services/packingItemService';
import type { PackingItem } from '@/types';

const key = (tripId: string) => ['packing-items', tripId];

export function usePackingItems(tripId: string) {
  return useQuery({
    queryKey: key(tripId),
    queryFn: () => packingItemService.list(tripId),
    enabled: !!tripId,
  });
}

export function useGeneratePackingItems(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => packingItemService.generate(tripId),
    onSuccess: (items) => {
      qc.setQueryData<PackingItem[]>(key(tripId), items);
    },
  });
}

export function useAddPackingItem(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; category?: string }) => packingItemService.create(tripId, data),
    onSuccess: (item) => {
      qc.setQueryData<PackingItem[]>(key(tripId), (prev = []) => [...prev, item]);
    },
  });
}

/**
 * Toggling a checkbox has to feel instant, so the cache is updated up front and
 * rolled back if the request fails.
 */
export function useTogglePackingItem(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isPacked }: { id: string; isPacked: boolean }) =>
      packingItemService.update(tripId, id, { isPacked }),
    onMutate: async ({ id, isPacked }) => {
      await qc.cancelQueries({ queryKey: key(tripId) });
      const previous = qc.getQueryData<PackingItem[]>(key(tripId));
      qc.setQueryData<PackingItem[]>(key(tripId), (prev = []) =>
        prev.map((i) => (i.id === id ? { ...i, isPacked } : i))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(key(tripId), context.previous);
    },
  });
}

/** Renames an item (or moves it to another category). */
export function useUpdatePackingItem(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; category?: string }) =>
      packingItemService.update(tripId, id, data),
    onSuccess: (updated) => {
      qc.setQueryData<PackingItem[]>(key(tripId), (prev = []) =>
        prev.map((i) => (i.id === updated.id ? updated : i))
      );
    },
  });
}

export function useDeletePackingItem(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => packingItemService.delete(tripId, id),
    onSuccess: (_, id) => {
      qc.setQueryData<PackingItem[]>(key(tripId), (prev = []) => prev.filter((i) => i.id !== id));
    },
  });
}

export function useClearPackingItems(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => packingItemService.deleteAll(tripId),
    onSuccess: () => {
      qc.setQueryData<PackingItem[]>(key(tripId), []);
    },
  });
}
