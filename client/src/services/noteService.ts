import api from './api';
import type { TripNote } from '@/types';

export const noteService = {
  list: async (tripId: string): Promise<TripNote[]> => {
    const { data } = await api.get(`/trips/${tripId}/notes`);
    return data.data;
  },

  create: async (tripId: string, payload: { title: string; content?: string }): Promise<TripNote> => {
    const { data } = await api.post(`/trips/${tripId}/notes`, payload);
    return data.data;
  },

  update: async (
    tripId: string,
    noteId: string,
    payload: { title?: string; content?: string }
  ): Promise<TripNote> => {
    const { data } = await api.patch(`/trips/${tripId}/notes/${noteId}`, payload);
    return data.data;
  },

  togglePin: async (tripId: string, noteId: string): Promise<TripNote> => {
    const { data } = await api.patch(`/trips/${tripId}/notes/${noteId}/pin`);
    return data.data;
  },

  delete: async (tripId: string, noteId: string): Promise<void> => {
    await api.delete(`/trips/${tripId}/notes/${noteId}`);
  },
};
