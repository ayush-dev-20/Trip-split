import { Request, Response, NextFunction } from 'express';
import { getAuth, clerkClient } from '@clerk/express';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  tier: string;
}

/**
 * The stored `tier` column already reflects the correct effective tier as of
 * the last webhook/verify-payment write (see billingController's
 * `mapRazorpayStatus`). This is a cheap, local-only belt-and-suspenders
 * check on top of that: if the paid period has clearly passed and the row
 * hasn't been reconciled yet (a webhook was missed), don't keep granting PRO
 * purely because the stored tier hasn't caught up. No external Razorpay call
 * here — that full reconciliation happens lazily in GET /billing/subscription.
 * Trade-off: right at an exact renewal boundary, a few minutes of webhook
 * delivery lag could very briefly read as FREE — acceptable vs. the
 * alternative of indefinite stale access if a webhook is missed entirely.
 */
function resolveEffectiveTier(subscription: {
  tier: string;
  status: string;
  currentPeriodEnd: Date | null;
} | null): string {
  if (!subscription) return 'FREE';
  if (
    subscription.status === 'ACTIVE' &&
    subscription.currentPeriodEnd &&
    subscription.currentPeriodEnd.getTime() < Date.now()
  ) {
    return 'FREE';
  }
  return subscription.tier;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Clerk-based authentication middleware.
 * Verifies the Clerk session token and attaches our DB user to req.user.
 * On first sign-in, lazily creates the local DB user from Clerk profile data.
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = getAuth(req);
    logger.debug('Auth', `[authenticate] userId from Clerk: ${userId ?? 'NONE'} | ${req.method} ${req.path}`);

    if (!userId) {
      throw AppError.unauthorized('Not authenticated');
    }

    // Find existing local user by Clerk ID
    let user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { subscription: true },
    });

    logger.debug('Auth', `[authenticate] DB user found by clerkId: ${user ? user.email : 'NOT FOUND — will lazy-create'}`);

    // Lazy-create local user on first API call after Clerk sign-up
    if (!user) {
      const clerkUser = await clerkClient.users.getUser(userId);
      logger.debug('Auth', `[authenticate] Clerk profile: ${clerkUser.emailAddresses.map(e => e.emailAddress).join(', ')}`);

      const primaryEmail = clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId
      );
      const email = primaryEmail?.emailAddress;

      if (!email) {
        logger.debug('Auth', `[authenticate] No primary email on Clerk account for userId: ${userId}`);
        throw AppError.unauthorized('No verified email on Clerk account');
      }

      // Check if a legacy user with this email already exists (migration path)
      const existingByEmail = await prisma.user.findUnique({ where: { email } });

      if (existingByEmail) {
        logger.debug('Auth', `[authenticate] Linking Clerk ID to existing account: ${email}`);
        user = await prisma.user.update({
          where: { email },
          data: {
            clerkId: userId,
            emailVerified: primaryEmail?.verification?.status === 'verified',
            avatarUrl: existingByEmail.avatarUrl ?? clerkUser.imageUrl ?? null,
          },
          include: { subscription: true },
        });
      } else {
        const fullName =
          [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim() ||
          email.split('@')[0];

        const primaryPhone = clerkUser.phoneNumbers.find(
          (p) => p.id === clerkUser.primaryPhoneNumberId
        );

        logger.debug('Auth', `[authenticate] Creating new DB user: ${email} | name: ${fullName}`);
        user = await prisma.user.create({
          data: {
            clerkId: userId,
            email,
            name: fullName,
            avatarUrl: clerkUser.imageUrl ?? null,
            emailVerified: primaryEmail?.verification?.status === 'verified',
            phone: primaryPhone?.phoneNumber ?? null,
            phoneVerified: primaryPhone?.verification?.status === 'verified',
            isActive: true,
            subscription: {
              create: { tier: 'FREE', status: 'ACTIVE' },
            },
          },
          include: { subscription: true },
        });
        logger.debug('Auth', `[authenticate] New user created: ${user.id}`);
      }
    }

    if (!user.isActive) {
      throw AppError.unauthorized('Account is inactive');
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      tier: resolveEffectiveTier(user.subscription),
    };

    logger.debug('Auth', `[authenticate] OK — req.user = { id: ${user.id}, email: ${user.email} }`);
    next();
  } catch (error) {
    logger.error('Auth', `[authenticate] FAILED on ${req.method} ${req.path}`, { error });
    next(error);
  }
};

/**
 * Optional authentication — attaches user if a valid Clerk session exists,
 * silently continues without one (used for public trip pages).
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = getAuth(req);
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        include: { subscription: true },
      });
      if (user?.isActive) {
        req.user = {
          id: user.id,
          email: user.email,
          name: user.name,
          tier: resolveEffectiveTier(user.subscription),
        };
      }
    }
  } catch {
    // Silently continue without auth
  }
  next();
};
