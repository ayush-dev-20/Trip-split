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

/**
 * Downloads a file through the API client and saves it via a temporary anchor.
 *
 * Deliberately not window.open(): the response is Content-Disposition:
 * attachment, so the browser downloads it and leaves the freshly-opened tab
 * blank — and in an installed PWA that's a stranded empty window. Going
 * through axios also means the Clerk auth header is attached, rather than
 * relying on the session cookie riding along with a raw navigation.
 */
async function downloadFile(path: string, params: object | undefined, fallbackName: string) {
  // axios omits undefined params, so filters that aren't set simply drop out.
  const res = await api.get(path, { params, responseType: 'blob' });

  const disposition = res.headers['content-disposition'] as string | undefined;
  const filename = disposition?.match(/filename="?([^";]+)"?/)?.[1] ?? fallbackName;

  const blobUrl = URL.createObjectURL(res.data as Blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(blobUrl);
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

  exportCSV: (params?: ExportParams) =>
    downloadFile('/personal-expenses/export/csv', params, 'personal_expenses.csv'),

  exportPDF: (params?: ExportParams) =>
    downloadFile('/personal-expenses/export/pdf', params, 'personal_expenses.pdf'),

  /**
   * Analytics report (summary, category breakdown, biggest expenses) as a PDF.
   * Accepts the same window params as getAnalytics.
   */
  exportAnalyticsPDF: (params?: {
    period?: PersonalAnalyticsPeriod;
    startDate?: string;
    endDate?: string;
  }) =>
    downloadFile('/analytics/personal/export/pdf', params, 'personal_analytics.pdf'),

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
