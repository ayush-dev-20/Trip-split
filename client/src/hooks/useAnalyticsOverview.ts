import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '@/services/analyticsService';

export function useTripsOverview(params: { startDate?: string; endDate?: string }, enabled: boolean) {
  return useQuery({
    queryKey: ['trips-overview', params],
    queryFn: () => analyticsService.getTripsOverview(params),
    enabled,
    staleTime: 2 * 60_000,
  });
}

export function useGroupsOverview(params: { startDate?: string; endDate?: string }, enabled: boolean) {
  return useQuery({
    queryKey: ['groups-overview', params],
    queryFn: () => analyticsService.getGroupsOverview(params),
    enabled,
    staleTime: 2 * 60_000,
  });
}
