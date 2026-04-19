import api from './api';
import type { ChatMessage, Poll, TripNote, TripFeedPost } from '@/types';

export const socialService = {
  // Chat
  getMessages: (tripId: string) =>
    api.get<{ success: boolean; data: ChatMessage[]; pagination: unknown }>(`/social/trips/${tripId}/chat`).then((r) => r.data.data ?? []),

  sendMessage: (tripId: string, content: string, replyToId?: string) =>
    api.post<{ success: boolean; data: ChatMessage }>(`/social/trips/${tripId}/chat`, { content, replyToId }).then((r) => r.data.data),

  // Polls
  getPolls: (tripId: string) =>
    api.get<{ success: boolean; data: Poll[] }>(`/social/trips/${tripId}/polls`).then((r) => r.data.data ?? []),

  createPoll: (tripId: string, question: string, options: string[]) =>
    api.post<{ success: boolean; data: Poll }>(`/social/trips/${tripId}/polls`, { question, options }).then((r) => r.data.data),

  votePoll: (_tripId: string, pollId: string, optionId: string) =>
    api.post(`/social/polls/${pollId}/vote/${optionId}`),

  closePoll: (_tripId: string, pollId: string) =>
    api.put(`/social/polls/${pollId}/close`),

  // Notes
  getNotes: (tripId: string) =>
    api.get<{ success: boolean; data: TripNote[] }>(`/social/trips/${tripId}/notes`).then((r) => r.data.data ?? []),

  createNote: (tripId: string, data: { title: string; content: string }) =>
    api.post<{ success: boolean; data: TripNote }>(`/social/trips/${tripId}/notes`, data).then((r) => r.data.data),

  updateNote: (tripId: string, noteId: string, data: { title?: string; content?: string; isPinned?: boolean }) =>
    api.put<{ success: boolean; data: TripNote }>(`/social/trips/${tripId}/notes/${noteId}`, data).then((r) => r.data.data),

  deleteNote: (tripId: string, noteId: string) =>
    api.delete(`/social/trips/${tripId}/notes/${noteId}`),

  // Feed
  getFeed: (tripId: string) =>
    api.get<{ success: boolean; data: TripFeedPost[]; pagination: unknown }>(`/social/trips/${tripId}/feed`).then((r) => r.data.data ?? []),

  createPost: (tripId: string, content: string, imageUrl?: string) =>
    api.post<{ success: boolean; data: TripFeedPost }>(`/social/trips/${tripId}/feed`, { content, imageUrl }).then((r) => r.data.data),

  deletePost: (tripId: string, postId: string) =>
    api.delete(`/social/trips/${tripId}/feed/${postId}`),
};
