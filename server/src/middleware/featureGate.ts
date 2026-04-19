import { Request, Response, NextFunction } from 'express';
import { SubscriptionTier } from '@prisma/client';
import { PLAN_LIMITS } from '../config/plans';
import { AppError } from '../utils/AppError';

type FeatureKey = keyof typeof PLAN_LIMITS.FREE;

/**
 * Middleware that checks if the user's subscription tier
 * has access to a specific feature.
 */
export const requireFeature = (feature: FeatureKey) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized('Authentication required'));
      return;
    }

    const tier = (req.user.tier as SubscriptionTier) || 'FREE';
    const limits = PLAN_LIMITS[tier];

    if (!limits[feature]) {
      next(
        AppError.forbidden(
          `This feature requires a higher subscription plan. Current plan: ${tier}`,
          'UPGRADE_REQUIRED'
        )
      );
      return;
    }

    next();
  };
};

/**
 * Middleware to check numeric limits (e.g., max active trips).
 */
export const checkLimit = (limitKey: 'maxActiveTrips' | 'maxMembersPerTrip', currentCount: number) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized('Authentication required'));
      return;
    }

    const tier = (req.user.tier as SubscriptionTier) || 'FREE';
    const limit = PLAN_LIMITS[tier][limitKey];

    if (currentCount >= limit) {
      next(
        AppError.forbidden(
          `You have reached the limit of ${limit} for your ${tier} plan. Please upgrade.`,
          'LIMIT_REACHED'
        )
      );
      return;
    }

    next();
  };
};
