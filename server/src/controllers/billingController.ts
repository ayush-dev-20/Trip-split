import { Request, Response } from 'express';
import { asyncHandler, AppError } from '../utils';
import { toCents } from '../utils/helpers';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { SUBSCRIPTION_PRICES } from '../config/plans';
import * as razorpayService from '../services/razorpayService';
import type { SubscriptionTier } from '@prisma/client';

/**
 * Directly sets a user's subscription tier. Internal only — not exposed as a
 * route. Called from `downgrade` (free, no payment needed) and from
 * `verifyPayment` (only after a Razorpay signature has checked out).
 */
async function applyTier(userId: string, tier: SubscriptionTier, status: 'ACTIVE' = 'ACTIVE') {
  return prisma.subscription.upsert({
    where: { userId },
    create: { userId, tier, status },
    update: { tier, status, cancelAtPeriodEnd: false },
  });
}

/**
 * POST /api/billing/downgrade
 * Downgrade a user back to FREE tier. No payment involved, so this stays a
 * plain, unguarded action.
 */
export const downgrade = asyncHandler(async (req: Request, res: Response) => {
  const subscription = await applyTier(req.user!.id, 'FREE');

  logger.info('Billing', `User ${req.user!.id} downgraded to FREE`);

  res.json({ success: true, data: subscription });
});

/**
 * GET /api/billing/subscription
 */
export const getSubscription = asyncHandler(async (req: Request, res: Response) => {
  const subscription = await prisma.subscription.findUnique({
    where: { userId: req.user!.id },
  });

  res.json({
    success: true,
    data: subscription || {
      tier: 'FREE',
      status: 'ACTIVE',
    },
  });
});

/**
 * POST /api/billing/create-order
 * Body: { tier: 'PRO' }
 * Creates a Razorpay order for the Standard Checkout modal. The amount is
 * always looked up server-side from SUBSCRIPTION_PRICES — never trust a
 * client-supplied amount for what determines a paid upgrade.
 */
export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const { tier } = req.body as { tier: 'PRO' };
  const userId = req.user!.id;

  const price = SUBSCRIPTION_PRICES[tier];
  if (!price) throw AppError.badRequest('Unknown plan');

  const amountInPaise = toCents(price.monthly);
  const receipt = `pro-${userId}-${Date.now()}`;

  let order;
  try {
    order = await razorpayService.createOrder({
      amountInPaise,
      currency: price.currency,
      receipt,
      notes: { userId, tier },
    });
  } catch (err) {
    logger.error('Billing', 'Razorpay order creation failed', { error: String(err) });
    throw AppError.internal('Unable to start checkout right now. Please try again.');
  }

  res.json({
    success: true,
    data: {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    },
  });
});

/**
 * POST /api/billing/verify-payment
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Verifies the Standard Checkout signature, then re-fetches the order from
 * Razorpay (not the client) to read the trusted tier/userId it was created
 * for, and only then upgrades the subscription.
 */
export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body as {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  };
  const userId = req.user!.id;

  let isValid: boolean;
  try {
    isValid = razorpayService.verifySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });
  } catch (err) {
    logger.error('Billing', 'Signature verification errored', { error: String(err) });
    throw AppError.internal('Unable to verify payment right now.');
  }

  if (!isValid) {
    logger.warn('Billing', `Signature mismatch for order ${razorpay_order_id} (user ${userId})`);
    throw AppError.badRequest('Payment verification failed', 'SIGNATURE_MISMATCH');
  }

  const order = await razorpayService.fetchOrder(razorpay_order_id);
  const notes = order.notes as { userId?: string; tier?: string } | undefined;

  // The signature only proves the payment matches this order — it says
  // nothing about who the order belongs to, so that still has to be checked
  // against the authenticated user before anything is granted.
  if (!notes?.userId || notes.userId !== userId || notes.tier !== 'PRO') {
    logger.warn('Billing', `Order ${razorpay_order_id} notes do not match requesting user ${userId}`);
    throw AppError.badRequest('This order does not belong to your account', 'ORDER_MISMATCH');
  }

  const subscription = await applyTier(userId, 'PRO');

  logger.info('Billing', `User ${userId} upgraded to PRO via Razorpay payment ${razorpay_payment_id}`);

  res.json({ success: true, data: subscription });
});
