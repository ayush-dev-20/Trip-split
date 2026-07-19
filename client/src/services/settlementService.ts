import api from './api';
import type { Settlement, TripBalances, ScopeBalances, OverallBalances } from '@/types';

export const settlementService = {
  getOverallBalances: () =>
    api.get<{ success: boolean; data: OverallBalances }>('/settlements/overall-balances').then((r) => r.data.data),

  getBalances: (tripId: string) =>
    api.get<{ success: boolean; data: TripBalances }>(`/settlements/balances/${tripId}`).then((r) => r.data.data),

  getGroupBalances: (groupId: string) =>
    api.get<{ success: boolean; data: ScopeBalances }>(`/settlements/balances/group/${groupId}`).then((r) => r.data.data),

  getAll: (tripId: string) =>
    api
      .get<{ success: boolean; data: Settlement[]; pagination: unknown }>('/settlements', { params: { tripId } })
      .then((r) => r.data.data ?? []),

  getAllForGroup: (groupId: string) =>
    api
      .get<{ success: boolean; data: Settlement[]; pagination: unknown }>('/settlements', { params: { groupId } })
      .then((r) => r.data.data ?? []),

  create: (_tripId: string, data: { fromUserId: string; toUserId: string; amount: number; currency?: string; note?: string } & { tripId?: string; groupId?: string }) =>
    api.post<{ success: boolean; data: Settlement }>('/settlements', data).then((r) => r.data.data),

  settle: (_tripId: string, settlementId: string, amount?: number) =>
    api.put<{ success: boolean; data: Settlement }>(`/settlements/${settlementId}/settle`, amount ? { amount } : {}).then((r) => r.data.data),

  settlePlan: (scope: { tripId?: string; groupId?: string }) =>
    api.post<{ success: boolean; data: Settlement[] }>('/settlements/settle-plan', scope).then((r) => r.data.data),

  /** Cancels a PENDING settlement. Only the two involved parties can cancel; SETTLED/DISPUTED settlements cannot be deleted. */
  delete: (settlementId: string) =>
    api.delete<{ success: boolean; message: string }>(`/settlements/${settlementId}`).then((r) => r.data),
};
