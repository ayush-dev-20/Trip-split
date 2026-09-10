import Razorpay from 'razorpay';
import type { Subscriptions } from 'razorpay/dist/types/subscriptions';
// `validatePaymentVerification` is only exported from the utils module —
// unlike `validateWebhookSignature`, it is NOT a static on the Razorpay class.
import { validatePaymentVerification } from 'razorpay/dist/utils/razorpay-utils';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Razorpay Service — Recurring Subscriptions (Standard Checkout)
 *
 * Used to collect and renew payment for the PRO subscription via Razorpay's
 * Subscriptions API (a Plan + recurring mandate), not the one-off Orders API.
 * Lazily initialised (same pattern as aiService's Gemini client) so a missing
 * key never crashes boot, only the first call.
 */

let client: Razorpay | null = null;

function getClient(): Razorpay {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured.');
  }
  if (!client) {
    client = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }
  return client;
}

export interface RazorpaySubscriptionNotes {
  userId: string;
  tier: string;
}

/**
 * Creates a Razorpay Subscription for the Standard Checkout modal.
 * `total_count: 120` = auto-renew monthly for 10 years before Razorpay
 * requires a fresh subscription — effectively "indefinite" without literally
 * being unbounded (the API requires a finite count).
 */
export async function createSubscription(notes: RazorpaySubscriptionNotes): Promise<Subscriptions.RazorpaySubscription> {
  if (!env.RAZORPAY_PLAN_ID) {
    throw new Error('RAZORPAY_PLAN_ID is not configured.');
  }

  try {
    // Same overload-resolution quirk as the old Orders API — cast through
    // `unknown` rather than fight the SDK's Promise/callback intersection type.
    const subscription = (await getClient().subscriptions.create({
      plan_id: env.RAZORPAY_PLAN_ID,
      total_count: 120,
      customer_notify: 1,
      notes: notes as unknown as Record<string, string>,
    })) as unknown as Subscriptions.RazorpaySubscription;
    return subscription;
  } catch (err) {
    logger.error('RazorpayService', 'Subscription creation failed', { error: String(err) });
    throw err;
  }
}

/** Fetches a subscription back from Razorpay — the trusted source for status/notes/period. */
export async function fetchSubscription(subscriptionId: string): Promise<Subscriptions.RazorpaySubscription> {
  return (await getClient().subscriptions.fetch(subscriptionId)) as unknown as Subscriptions.RazorpaySubscription;
}

/**
 * Cancels a subscription. `cancelAtCycleEnd: true` lets the current paid
 * period run out (no further charges, access kept until period end) —
 * `false` cancels immediately. We always pass `true` from the app's
 * "Downgrade"/"Cancel" action; the tier itself only flips to FREE once the
 * `subscription.cancelled` webhook confirms the period has actually ended.
 */
export async function cancelSubscription(
  subscriptionId: string,
  cancelAtCycleEnd: boolean
): Promise<Subscriptions.RazorpaySubscription> {
  return (await getClient().subscriptions.cancel(
    subscriptionId,
    cancelAtCycleEnd
  )) as unknown as Subscriptions.RazorpaySubscription;
}

/**
 * Verifies the Standard Checkout success signature for a SUBSCRIPTION
 * payment. Payload order matters and differs from the one-off Orders flow:
 * HMAC-SHA256(payment_id + "|" + subscription_id, KEY_SECRET) — this mirrors
 * the SDK's own `validatePaymentVerification` helper exactly (verified
 * against its source), used directly here instead of hand-rolling it.
 */
export function verifySubscriptionPaymentSignature(params: {
  paymentId: string;
  subscriptionId: string;
  signature: string;
}): boolean {
  if (!env.RAZORPAY_KEY_SECRET) {
    throw new Error('RAZORPAY_KEY_SECRET is not configured.');
  }
  return validatePaymentVerification(
    { payment_id: params.paymentId, subscription_id: params.subscriptionId },
    params.signature,
    env.RAZORPAY_KEY_SECRET
  );
}

/**
 * Verifies an incoming webhook's `X-Razorpay-Signature` header against the
 * raw request body, using the separate webhook secret configured when the
 * webhook was registered in the Dashboard (not KEY_SECRET).
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!env.RAZORPAY_WEBHOOK_SECRET) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured.');
  }
  return Razorpay.validateWebhookSignature(rawBody, signature, env.RAZORPAY_WEBHOOK_SECRET);
}
