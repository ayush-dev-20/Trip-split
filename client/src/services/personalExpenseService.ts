import api from './api';
import type {
  PersonalExpense,
  PersonalExpenseCalendarDay,
  PersonalAnalytics,
  PersonalAnalyticsPeriod,
  CreatePersonalExpensePayload,
} from '@/types';

export const personalExpenseService = {
  getAll: (params?: {
    startDate?: string;
    endDate?: string;
    category?: string;
    page?: number;
    limit?: number;
  }) =>
    api
      .get<{ success: boolean; data: PersonalExpense[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
        '/personal-expenses',
        { params }
      )
      .then((r) => ({ expenses: r.data.data ?? [], pagination: r.data.pagination })),

  getById: (id: string) =>
    api
      .get<{ success: boolean; data: PersonalExpense }>(`/personal-expenses/${id}`)
      .then((r) => r.data.data),

  getCalendar: (year: number, month: number) =>
    api
      .get<{ success: boolean; data: PersonalExpenseCalendarDay[] }>('/personal-expenses/calendar', {
        params: { year, month },
      })
      .then((r) => r.data.data ?? []),

  create: (data: CreatePersonalExpensePayload) =>
    api
      .post<{ success: boolean; data: PersonalExpense }>('/personal-expenses', data)
      .then((r) => r.data.data),

  update: (id: string, data: Partial<CreatePersonalExpensePayload>) =>
    api
      .put<{ success: boolean; data: PersonalExpense }>(`/personal-expenses/${id}`, data)
      .then((r) => r.data.data),

  delete: (id: string) => api.delete(`/personal-expenses/${id}`),

  getAnalytics: (period: PersonalAnalyticsPeriod, referenceDate?: string) =>
    api
      .get<{ success: boolean; data: PersonalAnalytics }>('/analytics/personal', {
        params: { period, ...(referenceDate && { referenceDate }) },
      })
      .then((r) => r.data.data),
};
