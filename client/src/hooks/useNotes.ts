import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { noteService } from '@/services/noteService';
import type { TripNote } from '@/types';

const key = (tripId: string) => ['notes', tripId];

export function useNotes(tripId: string) {
  return useQuery({
    queryKey: key(tripId),
    queryFn: () => noteService.list(tripId),
    enabled: !!tripId,
  });
}

export function useCreateNote(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { title: string; content?: string }) =>
      noteService.create(tripId, payload),
    onSuccess: (note) => {
      qc.setQueryData<TripNote[]>(key(tripId), (prev = []) => [note, ...prev]);
    },
  });
}

export function useUpdateNote(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, ...payload }: { noteId: string; title?: string; content?: string }) =>
      noteService.update(tripId, noteId, payload),
    onSuccess: (updated) => {
      qc.setQueryData<TripNote[]>(key(tripId), (prev = []) =>
        prev.map((n) => (n.id === updated.id ? updated : n))
      );
    },
  });
}

export function useTogglePin(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => noteService.togglePin(tripId, noteId),
    onSuccess: (updated) => {
      qc.setQueryData<TripNote[]>(key(tripId), (prev = []) => {
        const list = prev.map((n) => (n.id === updated.id ? updated : n));
        return [...list].sort((a, b) => {
          if (a.isPinned === b.isPinned) return 0;
          return a.isPinned ? -1 : 1;
        });
      });
    },
  });
}

export function useDeleteNote(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => noteService.delete(tripId, noteId),
    onSuccess: (_, noteId) => {
      qc.setQueryData<TripNote[]>(key(tripId), (prev = []) =>
        prev.filter((n) => n.id !== noteId)
      );
    },
  });
}
