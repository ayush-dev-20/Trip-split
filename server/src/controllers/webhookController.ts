import { Request, Response } from 'express';
import { Webhook } from 'svix';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * POST /api/webhooks/clerk
 * Syncs Clerk user lifecycle events to the local DB.
 * Requires raw body — mounted BEFORE the JSON parser middleware.
 */
export const handleClerkWebhook = async (req: Request, res: Response): Promise<void> => {
  const secret = env.CLERK_WEBHOOK_SECRET;

  if (!secret) {
    logger.warn('Webhook', 'CLERK_WEBHOOK_SECRET not set — skipping verification');
    res.json({ received: true });
    return;
  }

  const svixId = req.headers['svix-id'] as string;
  const svixTimestamp = req.headers['svix-timestamp'] as string;
  const svixSignature = req.headers['svix-signature'] as string;

  if (!svixId || !svixTimestamp || !svixSignature) {
    res.status(400).json({ error: 'Missing svix headers' });
    return;
  }

  let payload: Buffer;
  try {
    payload = req.body as Buffer;
    if (!Buffer.isBuffer(payload)) {
      res.status(400).json({ error: 'Raw body required' });
      return;
    }
  } catch {
    res.status(400).json({ error: 'Invalid body' });
    return;
  }

  const wh = new Webhook(secret);
  let evt: { type: string; data: ClerkUserPayload };

  try {
    evt = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as { type: string; data: ClerkUserPayload };
  } catch (err) {
    logger.warn('Webhook', 'Clerk signature verification failed', { err });
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  const { type, data } = evt;
  logger.info('Webhook', `Clerk event: ${type}`, { userId: data.id });

  try {
    if (type === 'user.created') {
      await syncClerkUser(data, 'create');
    } else if (type === 'user.updated') {
      await syncClerkUser(data, 'update');
    } else if (type === 'user.deleted') {
      if (data.id) {
        await prisma.user.updateMany({
          where: { clerkId: data.id },
          data: { isActive: false },
        });
        logger.info('Webhook', `Soft-deleted user with clerkId ${data.id}`);
      }
    }
  } catch (err) {
    logger.error('Webhook', 'Error processing Clerk event', { type, err });
    res.status(500).json({ error: 'Processing failed' });
    return;
  }

  res.json({ received: true });
};

// ──────────────────────────────────
// Types
// ──────────────────────────────────

interface ClerkEmailAddress {
  email_address: string;
  id: string;
  verification: { status: string } | null;
}

interface ClerkPhoneNumber {
  phone_number: string;
  id: string;
  verification: { status: string } | null;
}

interface ClerkUserPayload {
  id: string;
  email_addresses: ClerkEmailAddress[];
  phone_numbers: ClerkPhoneNumber[];
  primary_email_address_id: string;
  primary_phone_number_id: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string;
  deleted?: boolean;
}

// ──────────────────────────────────
// Helpers
// ──────────────────────────────────

async function syncClerkUser(data: ClerkUserPayload, mode: 'create' | 'update') {
  const primaryEmail = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id
  );
  const email = primaryEmail?.email_address;
  if (!email) return;

  const primaryPhone = data.phone_numbers?.find(
    (p) => p.id === data.primary_phone_number_id
  );

  const fullName =
    [data.first_name, data.last_name].filter(Boolean).join(' ').trim() ||
    email.split('@')[0];

  const userData = {
    clerkId: data.id,
    name: fullName,
    avatarUrl: data.image_url || null,
    emailVerified: primaryEmail?.verification?.status === 'verified',
    phone: primaryPhone?.phone_number ?? null,
    phoneVerified: primaryPhone?.verification?.status === 'verified',
  };

  if (mode === 'create') {
    // Upsert — handles race condition if lazy-creation already ran
    await prisma.user.upsert({
      where: { email },
      create: {
        ...userData,
        email,
        isActive: true,
        subscription: { create: { tier: 'FREE', status: 'ACTIVE' } },
      },
      update: userData,
    });
    logger.info('Webhook', `Synced new Clerk user: ${email}`);
  } else {
    await prisma.user.updateMany({
      where: { clerkId: data.id },
      data: {
        name: fullName,
        avatarUrl: data.image_url || null,
        emailVerified: primaryEmail?.verification?.status === 'verified',
        phone: primaryPhone?.phone_number ?? null,
        phoneVerified: primaryPhone?.verification?.status === 'verified',
      },
    });
    logger.info('Webhook', `Updated Clerk user: ${email}`);
  }
}
