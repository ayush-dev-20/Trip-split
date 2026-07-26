import api from './api';
import type { Note, NoteScope } from '@/types';

function notesUrl(scope: NoteScope): string {
  if (scope.type === 'trip') return `/trips/${scope.tripId}/notes`;
  if (scope.type === 'group') return `/groups/${scope.groupId}/notes`;
  return '/personal/notes';
}

export const noteService = {
  list: async (scope: NoteScope): Promise<Note[]> => {
    const { data } = await api.get(notesUrl(scope));
    return data.data;
  },

  create: async (scope: NoteScope, payload: { title: string; content?: string }): Promise<Note> => {
    const { data } = await api.post(notesUrl(scope), payload);
    return data.data;
  },

  update: async (
    scope: NoteScope,
    noteId: string,
    payload: { title?: string; content?: string }
  ): Promise<Note> => {
    const { data } = await api.patch(`${notesUrl(scope)}/${noteId}`, payload);
    return data.data;
  },

  togglePin: async (scope: NoteScope, noteId: string): Promise<Note> => {
    const { data } = await api.patch(`${notesUrl(scope)}/${noteId}/pin`);
    return data.data;
  },

  delete: async (scope: NoteScope, noteId: string): Promise<void> => {
    await api.delete(`${notesUrl(scope)}/${noteId}`);
  },
};
