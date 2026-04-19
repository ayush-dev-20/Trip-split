import api from './api';
import type { Group } from '@/types';

export const groupService = {
  getAll: () =>
    api.get<{ success: boolean; data: Group[] }>('/groups').then((r) => r.data.data ?? []),

  getById: (id: string) =>
    api.get<{ success: boolean; data: Group }>(`/groups/${id}`).then((r) => r.data.data),

  create: (data: { name: string; description?: string }) =>
    api.post<{ success: boolean; data: Group }>('/groups', data).then((r) => r.data.data),

  update: (id: string, data: { name?: string; description?: string }) =>
    api.put<{ success: boolean; data: Group }>(`/groups/${id}`, data).then((r) => r.data.data),

  delete: (id: string) =>
    api.delete(`/groups/${id}`),

  invite: (id: string, email: string) =>
    api.post(`/groups/${id}/invite`, { email }),

  joinByCode: (code: string) =>
    api.post<{ success: boolean; data: Group }>(`/groups/join/${code}`).then((r) => r.data.data),

  removeMember: (groupId: string, memberId: string) =>
    api.delete(`/groups/${groupId}/members/${memberId}`),
};
