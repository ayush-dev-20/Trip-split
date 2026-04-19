import api from './api';
import type { Notification } from '@/types';

export const notificationService = {
  getAll: (page?: number) =>
    api.get<{ success: boolean; data: Notification[]; unreadCount: number; pagination: unknown }>('/notifications', { params: { page } }).then((r) => ({
      notifications: r.data.data ?? [],
      unreadCount: r.data.unreadCount,
      meta: r.data.pagination,
    })),

  markAsRead: (id: string) =>
    api.put(`/notifications/${id}/read`),

  markAllAsRead: () =>
    api.put('/notifications/read-all'),

  getActivityFeed: (tripId: string) =>
    api.get<{ success: boolean; data: unknown[]; pagination: unknown }>(`/notifications/activity/${tripId}`).then((r) => r.data.data ?? []),
};
