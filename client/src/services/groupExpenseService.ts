import api from './api';
import type {
  GroupExpense,
  GroupExpenseCalendarDay,
  GroupAnalytics,
  GroupAnalyticsPeriod,
  CreateGroupExpensePayload,
} from '@/types';

interface GetAllParams {
  startDate?: string;
  endDate?: string;
  category?: string;
  page?: number;
  limit?: number;
}

interface PaginatedExpenses {
  expenses: GroupExpense[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const groupExpenseService = {
  getAll: (groupId: string, params?: GetAllParams) =>
    api
      .get<{ success: true; data: GroupExpense[]; pagination: PaginatedExpenses['pagination'] }>(
        `/groups/${groupId}/expenses`,
        { params },
      )
      .then((r) => ({ expenses: r.data.data ?? [], pagination: r.data.pagination })),

  getById: (groupId: string, id: string) =>
    api
      .get<{ success: true; data: GroupExpense }>(`/groups/${groupId}/expenses/${id}`)
      .then((r) => r.data.data),

  getCalendar: (groupId: string, year: number, month: number) =>
    api
      .get<{ success: true; data: GroupExpenseCalendarDay[] }>(
        `/groups/${groupId}/expenses/calendar`,
        { params: { year, month } },
      )
      .then((r) => r.data.data ?? []),

  create: (groupId: string, data: CreateGroupExpensePayload) =>
    api
      .post<{ success: true; data: GroupExpense }>(`/groups/${groupId}/expenses`, data)
      .then((r) => r.data.data),

  update: (groupId: string, id: string, data: Partial<CreateGroupExpensePayload>) =>
    api
      .put<{ success: true; data: GroupExpense }>(`/groups/${groupId}/expenses/${id}`, data)
      .then((r) => r.data.data),

  delete: (groupId: string, id: string) =>
    api.delete(`/groups/${groupId}/expenses/${id}`),

  getAnalytics: (groupId: string, period: GroupAnalyticsPeriod, referenceDate?: string) =>
    api
      .get<{ success: true; data: GroupAnalytics }>('/analytics/group/' + groupId, {
        params: { period, ...(referenceDate && { referenceDate }) },
      })
      .then((r) => r.data.data),
};
