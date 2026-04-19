import api from './api';
import type { Settlement, TripBalances, OverallBalances } from '@/types';

export const settlementService = {
  getOverallBalances: () =>
    api.get<{ success: boolean; data: OverallBalances }>('/settlements/overall-balances').then((r) => r.data.data),

  getBalances: (tripId: string) =>
    api.get<{ success: boolean; data: TripBalances }>(`/settlements/balances/${tripId}`).then((r) => r.data.data),

  getAll: (tripId: string) =>
    api
      .get<{ success: boolean; data: Settlement[]; pagination: unknown }>('/settlements', { params: { tripId } })
      .then((r) => r.data.data ?? []),

  create: (_tripId: string, data: { fromUserId: string; toUserId: string; amount: number; currency?: string; note?: string } & { tripId?: string }) =>
    api.post<{ success: boolean; data: Settlement }>('/settlements', data).then((r) => r.data.data),

  settle: (_tripId: string, settlementId: string) =>
    api.put<{ success: boolean; data: Settlement }>(`/settlements/${settlementId}/settle`).then((r) => r.data.data),
};
