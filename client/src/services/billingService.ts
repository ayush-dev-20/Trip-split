import api from './api';
import type { Subscription, RazorpayOrder } from '@/types';

export const billingService = {
  createOrder: (tier: 'PRO') =>
    api.post<{ success: boolean; data: RazorpayOrder }>('/billing/create-order', { tier }).then((r) => r.data.data),

  verifyPayment: (payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) =>
    api.post<{ success: boolean; data: Subscription }>('/billing/verify-payment', payload).then((r) => r.data.data),

  downgrade: () =>
    api.post<{ success: boolean; data: Subscription }>('/billing/downgrade').then((r) => r.data.data),

  getSubscription: () =>
    api.get<{ success: boolean; data: Subscription }>('/billing/subscription').then((r) => r.data.data),
};
