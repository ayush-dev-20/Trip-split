import api from './api';
import type { Subscription, RazorpaySubscriptionOrder } from '@/types';

export const billingService = {
  createSubscription: (tier: 'PRO') =>
    api.post<{ success: boolean; data: RazorpaySubscriptionOrder }>('/billing/create-subscription', { tier }).then((r) => r.data.data),

  verifyPayment: (payload: {
    razorpay_subscription_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) =>
    api.post<{ success: boolean; data: Subscription }>('/billing/verify-payment', payload).then((r) => r.data.data),

  // "Cancel" — schedules cancellation at the end of the current billing
  // cycle; access continues until then. See server/billingController.downgrade.
  downgrade: () =>
    api.post<{ success: boolean; data: Subscription }>('/billing/downgrade').then((r) => r.data.data),

  getSubscription: () =>
    api.get<{ success: boolean; data: Subscription }>('/billing/subscription').then((r) => r.data.data),
};
