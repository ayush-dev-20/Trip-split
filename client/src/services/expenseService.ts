import api from './api';
import type { Expense, ExpenseCategory, SplitType } from '@/types';

interface GetExpensesParams {
  page?: number;
  limit?: number;
  category?: ExpenseCategory;
  paidById?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface SplitItem {
  userId: string;
  amount?: number;
  percentage?: number;
  shares?: number;
}

export interface CreateExpensePayload {
  title: string;
  amount: number;
  currency?: string;
  category: ExpenseCategory;
  description?: string;
  /** Full ISO datetime string — server uses z.string().datetime() */
  date: string;
  splitType: SplitType;
  splits?: SplitItem[];
  /** Required by server */
  tripId: string;
  /** Required by server — the user who paid */
  paidById: string;
}

export const expenseService = {
  getAll: (tripId: string, params?: GetExpensesParams) =>
    api
      .get<{ success: boolean; data: Expense[]; pagination: unknown }>('/expenses', {
        params: { tripId, ...params },
      })
      .then((r) => ({
        expenses: r.data.data ?? [],
        meta: r.data.pagination,
      })),

  getById: (_tripId: string, expenseId: string) =>
    api.get<{ success: boolean; data: Expense }>(`/expenses/${expenseId}`).then((r) => r.data.data),

  create: (_tripId: string, data: CreateExpensePayload) =>
    api.post<{ success: boolean; data: Expense }>('/expenses', data).then((r) => r.data.data),

  update: (_tripId: string, expenseId: string, data: Partial<Omit<CreateExpensePayload, 'tripId' | 'paidById'>>) =>
    api.put<{ success: boolean; data: Expense }>(`/expenses/${expenseId}`, data).then((r) => r.data.data),

  delete: (_tripId: string, expenseId: string) =>
    api.delete(`/expenses/${expenseId}`),

  addComment: (_tripId: string, expenseId: string, content: string) =>
    api.post(`/expenses/${expenseId}/comments`, { content }),

  addReaction: (_tripId: string, expenseId: string, emoji: string) =>
    api.post(`/expenses/${expenseId}/reactions`, { emoji }),
};

