import api from './api';
import type { TripAnalytics, YearInReview, CategoryTrend, MyExpensesSummary } from '@/types';

export const analyticsService = {
  getTripAnalytics: (tripId: string) =>
    api.get<{ success: boolean; data: TripAnalytics }>(`/analytics/trip/${tripId}`).then((r) => r.data.data),

  compareTrips: (tripIds: string[]) =>
    api.get<{ success: boolean; data: unknown }>('/analytics/compare', { params: { tripIds } }).then((r) => r.data.data),

  yearInReview: (year?: number) =>
    api.get<{ success: boolean; data: YearInReview }>('/analytics/year-in-review', { params: { year } }).then((r) => r.data.data),

  categoryTrends: (months?: number) =>
    api.get<{ success: boolean; data: CategoryTrend[] }>('/analytics/category-trends', { params: { months } }).then((r) => r.data.data ?? []),

  getMyExpenses: (year?: number, tripId?: string) =>
    api.get<{ success: boolean; data: MyExpensesSummary }>('/analytics/my-expenses', { params: { year, tripId } }).then((r) => r.data.data),
};
