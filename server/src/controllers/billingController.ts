import { Request, Response } from 'express';
import { asyncHandler, AppError } from '../utils';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { SUBSCRIPTION_PRICES } from '../config/plans';
import * as razorpayService from '../services/razorpayService';
import { createNotification } from '../services/notificationService';
import type { SubscriptionTier, SubscriptionStatus } from '@prisma/client';

/**
 * Directly sets a user's subscription tier/status. Internal only — not
 * exposed as a route. Called from `verifyPayment` (only after a Razorpay
 * signature has checked out) and from the Razorpay webhook handler.
 */
async function applySubscriptionState(
  userId: string,
  data: {
    tier: SubscriptionTier;
    status: SubscriptionStatus;
    currentPeriodStart?: Date | null;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
    razorpaySubscriptionId?: string | null;
  }
) {
  return prisma.subscription.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

/**
 * POST /api/billing/downgrade
 * "Cancel" — if the user has an active Razorpay subscription, this cancels
 * it AT THE END of the current billing cycle (no further charges, access
 * kept until then), rather than an instant hard cutoff. The tier itself only
 * flips to FREE once the `subscription.cancelled` webhook confirms the
 * period has actually ended (see razorpayWebhookController).
 */
export const downgrade = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const existing = await prisma.subscription.findUnique({ where: { userId } });

  if (existing?.razorpaySubscriptionId && existing.status !== 'CANCELED') {
    try {
      await razorpayService.cancelSubscription(existing.razorpaySubscriptionId, true);
    } catch (err) {
      logger.error('Billing', 'Razorpay cancellation failed', { error: String(err), userId });
      throw AppError.internal('Unable to cancel right now. Please try again.');
    }

    const subscription = await prisma.subscription.update({
      where: { userId },
      data: { cancelAtPeriodEnd: true },
    });

    logger.info('Billing', `User ${userId} scheduled cancellation at period end`);
    res.json({ success: true, data: subscription });
    return;
  }

  // No active Razorpay subscription to cancel (e.g. already FREE) — just
  // ensure the row reflects FREE directly.
  const subscription = await applySubscriptionState(userId, { tier: 'FREE', status: 'ACTIVE' });
  logger.info('Billing', `User ${userId} downgraded to FREE`);
  res.json({ success: true, data: subscription });
});

/**
 * GET /api/billing/subscription
 * Reconciliation safety net: if our row still says ACTIVE but its
 * currentPeriodEnd has already passed (a webhook was missed), re-fetch the
 * subscription from Razorpay right here and reconcile before responding —
 * cheap insurance without needing a cron/scheduler.
 */
export const getSubscription = asyncHandler(async (req: Request, res: Response) => {
  let subscription = await prisma.subscription.findUnique({
    where: { userId: req.user!.id },
  });

  const isStale =
    subscription?.status === 'ACTIVE' &&
    subscription.currentPeriodEnd != null &&
    subscription.currentPeriodEnd.getTime() < Date.now();

  if (isStale && subscription!.razorpaySubscriptionId) {
    try {
      const remote = await razorpayService.fetchSubscription(subscription!.razorpaySubscriptionId);
      subscription = await reconcileFromRazorpay(req.user!.id, remote);
    } catch (err) {
      // Reconciliation is best-effort — don't fail the whole request over it.
      logger.warn('Billing', 'Reconciliation fetch failed', { error: String(err), userId: req.user!.id });
    }
  }

  res.json({
    success: true,
    data: subscription || {
      tier: 'FREE',
      status: 'ACTIVE',
    },
  });
});

/**
 * POST /api/billing/create-subscription
 * Body: { tier: 'PRO' }
 * Creates a Razorpay Subscription for the Standard Checkout modal. The plan
 * is always the server-configured RAZORPAY_PLAN_ID — never trust a client
 * for what determines a paid upgrade's price.
 */
export const createSubscription = asyncHandler(async (req: Request, res: Response) => {
  const { tier } = req.body as { tier: 'PRO' };
  const userId = req.user!.id;

  if (!SUBSCRIPTION_PRICES[tier]) throw AppError.badRequest('Unknown plan');

  let subscription;
  try {
    subscription = await razorpayService.createSubscription({ userId, tier });
  } catch (err) {
    logger.error('Billing', 'Razorpay subscription creation failed', { error: String(err) });
    throw AppError.internal('Unable to start checkout right now. Please try again.');
  }

  // Record the pending subscription id immediately so a webhook that fires
  // before verifyPayment returns (rare, but possible) can still find this
  // user's row by razorpaySubscriptionId.
  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, tier: 'FREE', status: 'ACTIVE', razorpaySubscriptionId: subscription.id },
    update: { razorpaySubscriptionId: subscription.id },
  });

  res.json({
    success: true,
    data: { subscriptionId: subscription.id },
  });
});

/**
 * POST /api/billing/verify-payment
 * Body: { razorpay_subscription_id, razorpay_payment_id, razorpay_signature }
 * Verifies the Standard Checkout signature for the first (authorising)
 * payment, then re-fetches the subscription from Razorpay (not the client)
 * to read its trusted tier/userId notes, and only then upgrades the tier.
 */
export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const { razorpay_subscription_id, razorpay_payment_id, razorpay_signature } = req.body as {
    razorpay_subscription_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  };
  const userId = req.user!.id;

  let isValid: boolean;
  try {
    isValid = razorpayService.verifySubscriptionPaymentSignature({
      subscriptionId: razorpay_subscription_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });
  } catch (err) {
    logger.error('Billing', 'Signature verification errored', { error: String(err) });
    throw AppError.internal('Unable to verify payment right now.');
  }

  if (!isValid) {
    logger.warn('Billing', `Signature mismatch for subscription ${razorpay_subscription_id} (user ${userId})`);
    throw AppError.badRequest('Payment verification failed', 'SIGNATURE_MISMATCH');
  }

  const remote = await razorpayService.fetchSubscription(razorpay_subscription_id);
  const notes = remote.notes as { userId?: string; tier?: string } | undefined;

  // The signature only proves the payment matches this subscription — it
  // says nothing about who it belongs to, so that still has to be checked
  // against the authenticated user before anything is granted.
  if (!notes?.userId || notes.userId !== userId || notes.tier !== 'PRO') {
    logger.warn('Billing', `Subscription ${razorpay_subscription_id} notes do not match requesting user ${userId}`);
    throw AppError.badRequest('This subscription does not belong to your account', 'ORDER_MISMATCH');
  }

  const subscription = await reconcileFromRazorpay(userId, remote);

  logger.info('Billing', `User ${userId} upgraded to PRO via Razorpay payment ${razorpay_payment_id}`);

  res.json({ success: true, data: subscription });
});

/**
 * Shared helper — maps a Razorpay subscription entity's status/period onto
 * our local Subscription row. Used by verifyPayment (first payment), the
 * webhook handler (every later renewal/failure), and the reconciliation
 * safety net in getSubscription.
 */
export async function reconcileFromRazorpay(
  userId: string,
  remote: { id: string; status: string; current_start?: number | null; current_end?: number | null }
) {
  const { tier, status, cancelAtPeriodEnd } = mapRazorpayStatus(remote.status);

  return applySubscriptionState(userId, {
    tier,
    status,
    currentPeriodStart: remote.current_start ? new Date(remote.current_start * 1000) : null,
    currentPeriodEnd: remote.current_end ? new Date(remote.current_end * 1000) : null,
    cancelAtPeriodEnd,
    razorpaySubscriptionId: remote.id,
  });
}

/**
 * Policy: how a Razorpay subscription status maps to our tier/status.
 *
 * - authenticated/active/charged (Razorpay reports these as 'active' once
 *   charged) → PRO, ACTIVE.
 * - pending → mid-retry after a failed auto-debit; Razorpay is still trying,
 *   so PRO access is kept but status shows PAST_DUE as a heads-up.
 * - halted → Razorpay has exhausted its own retry attempts and will not try
 *   again on its own. Rather than leave someone on PRO indefinitely with no
 *   further automatic resolution, this downgrades to FREE immediately.
 * - cancelled/completed/expired → the recurring relationship has genuinely
 *   ended (either the user cancelled and the paid period ran out, or the
 *   120-cycle cap was reached) → FREE, CANCELED.
 */
function mapRazorpayStatus(razorpayStatus: string): {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
} {
  switch (razorpayStatus) {
    case 'authenticated':
    case 'active':
      return { tier: 'PRO', status: 'ACTIVE', cancelAtPeriodEnd: false };
    case 'pending':
      return { tier: 'PRO', status: 'PAST_DUE', cancelAtPeriodEnd: false };
    case 'halted':
      return { tier: 'FREE', status: 'PAST_DUE', cancelAtPeriodEnd: false };
    case 'cancelled':
    case 'completed':
    case 'expired':
      return { tier: 'FREE', status: 'CANCELED', cancelAtPeriodEnd: false };
    default:
      return { tier: 'FREE', status: 'ACTIVE', cancelAtPeriodEnd: false };
  }
}

/**
 * Fires an in-app PAYMENT_REMINDER notification — reused for both "renewed
 * successfully" receipts and "payment issue" warnings from the webhook.
 */
export async function notifyBillingEvent(userId: string, title: string, message: string) {
  await createNotification({ userId, type: 'PAYMENT_REMINDER', title, message });
}
