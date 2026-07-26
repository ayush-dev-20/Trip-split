import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { noteService } from '@/services/noteService';
import type { Note, NoteScope } from '@/types';

function scopeKey(scope: NoteScope): string {
  if (scope.type === 'trip') return `trip:${scope.tripId}`;
  if (scope.type === 'group') return `group:${scope.groupId}`;
  return 'personal';
}

const key = (scope: NoteScope) => ['notes', scopeKey(scope)];

export function useNotes(scope: NoteScope) {
  return useQuery({
    queryKey: key(scope),
    queryFn: () => noteService.list(scope),
  });
}

export function useCreateNote(scope: NoteScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { title: string; content?: string }) => noteService.create(scope, payload),
    onSuccess: (note) => {
      qc.setQueryData<Note[]>(key(scope), (prev = []) => [note, ...prev]);
    },
  });
}

export function useUpdateNote(scope: NoteScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, ...payload }: { noteId: string; title?: string; content?: string }) =>
      noteService.update(scope, noteId, payload),
    onSuccess: (updated) => {
      qc.setQueryData<Note[]>(key(scope), (prev = []) =>
        prev.map((n) => (n.id === updated.id ? updated : n))
      );
    },
  });
}

export function useTogglePin(scope: NoteScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => noteService.togglePin(scope, noteId),
    onSuccess: (updated) => {
      qc.setQueryData<Note[]>(key(scope), (prev = []) => {
        const list = prev.map((n) => (n.id === updated.id ? updated : n));
        return [...list].sort((a, b) => {
          if (a.isPinned === b.isPinned) return 0;
          return a.isPinned ? -1 : 1;
        });
      });
    },
  });
}

export function useDeleteNote(scope: NoteScope) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => noteService.delete(scope, noteId),
    onSuccess: (_, noteId) => {
      qc.setQueryData<Note[]>(key(scope), (prev = []) => prev.filter((n) => n.id !== noteId));
    },
  });
}
