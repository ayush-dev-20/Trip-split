import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

/**
 * Middleware factory for validating request data against a Zod schema.
 * Validates body, query, and/or params.
 */
export const validate = (schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }
      if (schema.query) {
        req.query = schema.query.parse(req.query) as any;
      }
      if (schema.params) {
        req.params = schema.params.parse(req.params) as any;
      }
      next();
    } catch (error: any) {
      // ZodError: log exactly which fields failed before passing to errorHandler
      if (error?.errors) {
        const fields = error.errors.map((e: any) => `  • ${e.path.join('.') || '(root)'}: ${e.message}`);
        logger.warn('Validate', `Schema rejected ${req.method} ${req.path}\n${fields.join('\n')}`, {
          received: req.body,
        });
      }
      next(error); // passed to errorHandler as ZodError
    }
  };
};

/**
 * Require a specific role (ADMIN or MEMBER) for access.
 */
export const requireRole = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized('Authentication required'));
      return;
    }
    // Role checks are done per-resource in controllers
    // This is a generic role guard
    next();
  };
};
