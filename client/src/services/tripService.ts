import api from './api';
import type { Trip, TripStatus } from '@/types';

interface GetTripsParams {
  page?: number;
  limit?: number;
  status?: TripStatus;
  groupId?: string;
}

interface CreateTripPayload {
  name: string;
  description?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  budgetCurrency?: string;
  budget?: number;
  isPublic?: boolean;
  groupId?: string;
}

export const tripService = {
  getAll: (params?: GetTripsParams) =>
    api.get<{ success: boolean; data: Trip[]; pagination: unknown }>('/trips', { params }).then((r) => ({
      trips: r.data.data ?? [],
      meta: r.data.pagination,
    })),

  getById: (id: string) =>
    api.get<{ success: boolean; data: Trip }>(`/trips/${id}`).then((r) => r.data.data),

  getPublic: (id: string) =>
    api.get<{ success: boolean; data: Trip }>(`/trips/${id}/public`).then((r) => r.data.data),

  create: (data: CreateTripPayload) =>
    api.post<{ success: boolean; data: Trip }>('/trips', data).then((r) => r.data.data),

  update: (id: string, data: Partial<CreateTripPayload> & { status?: TripStatus }) =>
    api.put<{ success: boolean; data: Trip }>(`/trips/${id}`, data).then((r) => r.data.data),

  delete: (id: string) =>
    api.delete(`/trips/${id}`),

  addMember: (tripId: string, userId: string) =>
    api.post(`/trips/${tripId}/members`, { userId }),

  joinByCode: (code: string) =>
    api.post<{ success: boolean; data: Trip }>(`/trips/join/${code}`).then((r) => r.data.data),

  syncStatuses: () =>
    api.post<{ success: boolean; data: { updated: number } }>('/trips/sync-statuses').then((r) => r.data.data),
};
