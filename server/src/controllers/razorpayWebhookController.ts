import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import * as razorpayService from '../services/razorpayService';
import { reconcileFromRazorpay, notifyBillingEvent } from './billingController';

interface RazorpaySubscriptionEntity {
  id: string;
  status: string;
  current_start?: number | null;
  current_end?: number | null;
  notes?: { userId?: string; tier?: string };
}

interface RazorpayWebhookBody {
  event: string;
  payload: {
    subscription?: { entity: RazorpaySubscriptionEntity };
  };
}

/**
 * POST /api/webhooks/razorpay
 * Syncs Razorpay subscription lifecycle events (renewals, failures,
 * cancellations) to the local DB. Requires raw body — mounted BEFORE the
 * JSON parser, same as the Clerk webhook.
 *
 * This is the load-bearing piece for recurring billing: everything that
 * happens AFTER the first payment (auto-renewals, failed auto-debits,
 * a cancellation actually taking effect at period end) happens on Razorpay's
 * own schedule, server-to-server — without this handler, none of it would
 * ever reach our database.
 */
export const handleRazorpayWebhook = async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['x-razorpay-signature'] as string | undefined;

  if (!signature) {
    res.status(400).json({ error: 'Missing X-Razorpay-Signature header' });
    return;
  }

  const rawBody = req.body as Buffer;
  if (!Buffer.isBuffer(rawBody)) {
    res.status(400).json({ error: 'Raw body required' });
    return;
  }

  let isValid: boolean;
  try {
    isValid = razorpayService.verifyWebhookSignature(rawBody.toString(), signature);
  } catch (err) {
    logger.error('Webhook', 'Razorpay webhook signature check errored', { error: String(err) });
    res.status(500).json({ error: 'Verification failed' });
    return;
  }

  if (!isValid) {
    logger.warn('Webhook', 'Razorpay webhook signature mismatch — rejecting');
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  let body: RazorpayWebhookBody;
  try {
    body = JSON.parse(rawBody.toString());
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const subscriptionEntity = body.payload.subscription?.entity;

  // Always 200 quickly once verified/parsed — Razorpay retries on non-200 or
  // timeout, and events we don't act on below are still fine to acknowledge.
  res.json({ received: true });

  if (!subscriptionEntity) {
    logger.debug('Webhook', `Razorpay event ${body.event} has no subscription payload — ignoring`);
    return;
  }

  logger.info('Webhook', `Razorpay event: ${body.event}`, { subscriptionId: subscriptionEntity.id });

  try {
    await processSubscriptionEvent(body.event, subscriptionEntity);
  } catch (err) {
    // The response is already sent — log loudly so this shows up in
    // monitoring, since Razorpay won't retry a webhook we already 200'd.
    logger.error('Webhook', `Failed to process Razorpay event ${body.event}`, {
      error: String(err),
      subscriptionId: subscriptionEntity.id,
    });
  }
};

async function processSubscriptionEvent(event: string, entity: RazorpaySubscriptionEntity): Promise<void> {
  const userId = entity.notes?.userId;
  if (!userId) {
    logger.warn('Webhook', `Razorpay subscription ${entity.id} has no userId in notes — cannot reconcile`);
    return;
  }

  // Only these events change subscription state; the rest (authenticated,
  // activated, updated, paused, resumed) are informational for now.
  const relevantEvents = ['subscription.charged', 'subscription.pending', 'subscription.halted', 'subscription.cancelled', 'subscription.completed'];
  if (!relevantEvents.includes(event)) return;

  // Guard against a stale/replayed webhook for an OLD subscription id after
  // the user has since re-subscribed (a fresh razorpaySubscriptionId).
  const local = await prisma.subscription.findUnique({ where: { userId } });
  if (local?.razorpaySubscriptionId && local.razorpaySubscriptionId !== entity.id) {
    logger.warn('Webhook', `Ignoring event for stale subscription ${entity.id} — user now on ${local.razorpaySubscriptionId}`);
    return;
  }

  await reconcileFromRazorpay(userId, entity);

  switch (event) {
    case 'subscription.charged':
      await notifyBillingEvent(userId, 'TripSplit Pro renewed', 'Your monthly payment was successful — your Pro plan is active.');
      break;
    case 'subscription.pending':
      await notifyBillingEvent(userId, 'Payment issue with TripSplit Pro', 'We could not process your renewal payment. We will retry automatically — please check your payment method.');
      break;
    case 'subscription.halted':
      await notifyBillingEvent(userId, 'TripSplit Pro paused', 'We were unable to renew your subscription after several attempts, so your account has moved to the Free plan. Resubscribe anytime from Billing.');
      break;
    case 'subscription.cancelled':
    case 'subscription.completed':
      await notifyBillingEvent(userId, 'TripSplit Pro ended', 'Your Pro subscription has ended and your account is now on the Free plan.');
      break;
  }
}
