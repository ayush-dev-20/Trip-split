import api from './api';
import type { Checkpoint } from '@/types';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export const checkpointService = {
  getCheckpoints: (tripId: string) =>
    api.get<ApiResponse<Checkpoint[]>>(`/trips/${tripId}/checkpoints`).then((r) => r.data.data),

  createCheckpoint: (tripId: string, data: { title: string; description?: string; category?: string; estimatedCost?: number; day?: number; sortOrder?: number }) =>
    api.post<ApiResponse<Checkpoint>>(`/trips/${tripId}/checkpoints`, data).then((r) => r.data.data),

  createBulk: (tripId: string, checkpoints: Array<{ title: string; description?: string; category?: string; estimatedCost?: number; day?: number; sortOrder?: number }>) =>
    api.post<ApiResponse<Checkpoint[]>>(`/trips/${tripId}/checkpoints/bulk`, { checkpoints }).then((r) => r.data.data),

  updateCheckpoint: (tripId: string, id: string, data: Partial<Pick<Checkpoint, 'title' | 'description' | 'category' | 'estimatedCost' | 'day' | 'sortOrder' | 'isVisited'>>) =>
    api.patch<ApiResponse<Checkpoint>>(`/trips/${tripId}/checkpoints/${id}`, data).then((r) => r.data.data),

  deleteCheckpoint: (tripId: string, id: string) =>
    api.delete<ApiResponse<void>>(`/trips/${tripId}/checkpoints/${id}`).then((r) => r.data),

  deleteAll: (tripId: string) =>
    api.delete<ApiResponse<void>>(`/trips/${tripId}/checkpoints`).then((r) => r.data),

  deleteByDay: (tripId: string, day: number) =>
    api.delete<ApiResponse<void>>(`/trips/${tripId}/checkpoints/day/${day}`).then((r) => r.data),

  reorder: (tripId: string, order: Array<{ id: string; sortOrder: number }>) =>
    api.put<ApiResponse<Checkpoint[]>>(`/trips/${tripId}/checkpoints/reorder`, { order }).then((r) => r.data.data),
};
