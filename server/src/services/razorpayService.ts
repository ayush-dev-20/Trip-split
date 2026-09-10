import Razorpay from 'razorpay';
import type { Orders } from 'razorpay/dist/types/orders';
import crypto from 'crypto';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Razorpay Service
 *
 * Standard (Web) Checkout integration — used to collect payment for the PRO
 * subscription upgrade. Lazily initialised (same pattern as aiService's
 * Gemini client) so a missing key never crashes boot, only the first call.
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

export interface RazorpayOrderNotes {
  userId: string;
  tier: string;
}

/**
 * Creates a Razorpay order for the Standard Checkout modal.
 * `amountInPaise` must already be the smallest currency unit (₹1 = 100 paise) —
 * callers should derive it server-side (e.g. from SUBSCRIPTION_PRICES), never
 * from client input, so a tampered request can't buy PRO for less.
 */
export async function createOrder(params: {
  amountInPaise: number;
  currency: string;
  receipt: string;
  notes: RazorpayOrderNotes;
}): Promise<Orders.RazorpayOrder> {
  if (params.amountInPaise < 100) {
    throw new Error('Amount must be at least 100 paise (₹1).');
  }

  try {
    // The SDK's overloaded (Promise | callback) create() signature resolves
    // to `Promise<RazorpayOrder> & void` under this project's tsconfig when
    // called without a callback — cast through `unknown` rather than fight it.
    const order = (await getClient().orders.create({
      amount: params.amountInPaise,
      currency: params.currency.toUpperCase(),
      receipt: params.receipt,
      notes: params.notes as unknown as Record<string, string>,
    })) as unknown as Orders.RazorpayOrder;
    return order;
  } catch (err) {
    logger.error('RazorpayService', 'Order creation failed', { error: String(err) });
    throw err;
  }
}

/** Fetches an order back from Razorpay — used post-verification to read its trusted `notes`. */
export async function fetchOrder(orderId: string): Promise<Orders.RazorpayOrder> {
  return (await getClient().orders.fetch(orderId)) as unknown as Orders.RazorpayOrder;
}

/**
 * Verifies the Standard Checkout success signature:
 * HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET) must equal the signature
 * Razorpay's modal handed back to the client.
 */
export function verifySignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (!env.RAZORPAY_KEY_SECRET) {
    throw new Error('RAZORPAY_KEY_SECRET is not configured.');
  }
  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest('hex');

  // Constant-time compare — both buffers must be equal length or timingSafeEqual throws.
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(params.signature);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
