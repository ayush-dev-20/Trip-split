import api from './api';
import type { TripAnalytics, YearInReview, CategoryTrend, MyExpensesSummary, TripsOverview, GroupsOverview } from '@/types';

export const analyticsService = {
  getTripAnalytics: (tripId: string, dateRange?: { startDate?: string; endDate?: string }) =>
    api
      .get<{ success: boolean; data: TripAnalytics }>(`/analytics/trip/${tripId}`, { params: dateRange })
      .then((r) => r.data.data),

  compareTrips: (tripIds: string[]) =>
    api.get<{ success: boolean; data: unknown }>('/analytics/compare', { params: { tripIds } }).then((r) => r.data.data),

  yearInReview: (year?: number) =>
    api.get<{ success: boolean; data: YearInReview }>('/analytics/year-in-review', { params: { year } }).then((r) => r.data.data),

  categoryTrends: (months?: number) =>
    api.get<{ success: boolean; data: CategoryTrend[] }>('/analytics/category-trends', { params: { months } }).then((r) => r.data.data ?? []),

  getMyExpenses: (year?: number, tripId?: string) =>
    api.get<{ success: boolean; data: MyExpensesSummary }>('/analytics/my-expenses', { params: { year, tripId } }).then((r) => r.data.data),

  getTripsOverview: (params?: { startDate?: string; endDate?: string }) =>
    api
      .get<{ success: boolean; data: TripsOverview }>('/analytics/trips-overview', { params })
      .then((r) => r.data.data),

  getGroupsOverview: (params?: { startDate?: string; endDate?: string }) =>
    api
      .get<{ success: boolean; data: GroupsOverview }>('/analytics/groups-overview', { params })
      .then((r) => r.data.data),
};
