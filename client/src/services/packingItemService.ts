import api from './api';
import type { PackingItem } from '@/types';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export const packingItemService = {
  list: (tripId: string) =>
    api.get<ApiResponse<PackingItem[]>>(`/trips/${tripId}/packing-items`).then((r) => r.data.data),

  create: (tripId: string, data: { name: string; category?: string }) =>
    api.post<ApiResponse<PackingItem>>(`/trips/${tripId}/packing-items`, data).then((r) => r.data.data),

  /** Generates an AI list from the trip's own data. Existing items are preserved. */
  generate: (tripId: string) =>
    api.post<ApiResponse<PackingItem[]>>(`/trips/${tripId}/packing-items/generate`).then((r) => r.data.data),

  update: (tripId: string, id: string, data: Partial<Pick<PackingItem, 'name' | 'category' | 'isPacked' | 'sortOrder'>>) =>
    api.patch<ApiResponse<PackingItem>>(`/trips/${tripId}/packing-items/${id}`, data).then((r) => r.data.data),

  delete: (tripId: string, id: string) =>
    api.delete<ApiResponse<void>>(`/trips/${tripId}/packing-items/${id}`).then((r) => r.data),

  deleteAll: (tripId: string) =>
    api.delete<ApiResponse<void>>(`/trips/${tripId}/packing-items`).then((r) => r.data),
};
