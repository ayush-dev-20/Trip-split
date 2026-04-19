import api from './api';
import type { Subscription } from '@/types';

export const billingService = {
  upgrade: (tier: 'PRO' | 'TEAM') =>
    api.post<{ success: boolean; data: Subscription }>('/billing/upgrade', { tier }).then((r) => r.data.data),

  downgrade: () =>
    api.post<{ success: boolean; data: Subscription }>('/billing/downgrade').then((r) => r.data.data),

  getSubscription: () =>
    api.get<{ success: boolean; data: Subscription }>('/billing/subscription').then((r) => r.data.data),
};
