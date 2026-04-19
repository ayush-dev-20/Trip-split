import { Request, Response } from 'express';
import { asyncHandler, AppError } from '../utils';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

/**
 * POST /api/billing/upgrade
 * Directly upgrade a user's subscription tier (no payment provider).
 */
export const upgrade = asyncHandler(async (req: Request, res: Response) => {
  const { tier } = req.body;

  if (!['PRO', 'TEAM'].includes(tier)) {
    throw AppError.badRequest('Invalid tier. Must be PRO or TEAM.');
  }

  const subscription = await prisma.subscription.upsert({
    where: { userId: req.user!.id },
    create: {
      userId: req.user!.id,
      tier,
      status: 'ACTIVE',
    },
    update: {
      tier,
      status: 'ACTIVE',
    },
  });

  logger.info('Billing', `User ${req.user!.id} upgraded to ${tier}`);

  res.json({ success: true, data: subscription });
});

/**
 * POST /api/billing/downgrade
 * Downgrade a user back to FREE tier.
 */
export const downgrade = asyncHandler(async (req: Request, res: Response) => {
  const subscription = await prisma.subscription.upsert({
    where: { userId: req.user!.id },
    create: {
      userId: req.user!.id,
      tier: 'FREE',
      status: 'ACTIVE',
    },
    update: {
      tier: 'FREE',
      status: 'ACTIVE',
      cancelAtPeriodEnd: false,
    },
  });

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
