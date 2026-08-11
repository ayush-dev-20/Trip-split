import api from './api';
import type {
  PersonalExpense,
  PersonalExpenseCalendarDay,
  PersonalAnalytics,
  PersonalAnalyticsPeriod,
  PersonalBudgetStatus,
  CreatePersonalExpensePayload,
} from '@/types';

export interface ExportParams {
  category?: string;
  startDate?: string;
  endDate?: string;
}

/** Drops undefined values and returns a leading-"?" query string (or ''). */
function buildQuery(params?: object) {
  const qs = new URLSearchParams(
    Object.entries(params ?? {}).filter((entry): entry is [string, string] => entry[1] !== undefined)
  ).toString();
  return qs ? `?${qs}` : '';
}

export const personalExpenseService = {
  getAll: (params?: {
    startDate?: string;
    endDate?: string;
    category?: string;
    search?: string;
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

  getRecurring: () =>
    api
      .get<{ success: boolean; data: PersonalExpense[] }>('/personal-expenses/recurring')
      .then((r) => r.data.data ?? []),

  getBudgetStatus: () =>
    api
      .get<{ success: boolean; data: PersonalBudgetStatus }>('/personal-expenses/budget-status')
      .then((r) => r.data.data),

  exportCSV: (params?: ExportParams) => {
    window.open(`/api/personal-expenses/export/csv${buildQuery(params)}`, '_blank');
  },

  exportPDF: (params?: ExportParams) => {
    window.open(`/api/personal-expenses/export/pdf${buildQuery(params)}`, '_blank');
  },

  /**
   * Analytics report (summary, category breakdown, biggest expenses) as a PDF.
   * Accepts the same window params as getAnalytics.
   */
  exportAnalyticsPDF: (params?: {
    period?: PersonalAnalyticsPeriod;
    startDate?: string;
    endDate?: string;
  }) => {
    window.open(`/api/analytics/personal/export/pdf${buildQuery(params)}`, '_blank');
  },

  // Pass either { period, referenceDate? } or { startDate, endDate } (custom
  // range takes priority server-side if both happen to be present).
  getAnalytics: (params: {
    period?: PersonalAnalyticsPeriod;
    referenceDate?: string;
    startDate?: string;
    endDate?: string;
  }) =>
    api
      .get<{ success: boolean; data: PersonalAnalytics }>('/analytics/personal', { params })
      .then((r) => r.data.data),
};
