import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

/**
 * Global error handler middleware.
 * Catches all errors thrown in routes/middleware and returns
 * a consistent JSON error response.
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let code: string | undefined;
  let details: { field: string; message: string }[] | undefined;

  const route = `${req.method} ${req.path}`;

  // AppError (intentional operational errors)
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
  }

  // Prisma known errors
  if (err.constructor.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as any;
    if (prismaErr.code === 'P2002') {
      statusCode = 409;
      message = `Duplicate value for field: ${prismaErr.meta?.target?.join(', ')}`;
      code = 'DUPLICATE_ENTRY';
    } else if (prismaErr.code === 'P2025') {
      statusCode = 404;
      message = 'Record not found';
      code = 'NOT_FOUND';
    }
    logger.warn('ErrorHandler', `Prisma error on ${route}`, {
      prismaCode: (err as any).code,
      message,
    });
  }

  // Zod validation errors
  if (err.constructor.name === 'ZodError') {
    statusCode = 400;
    const zodErr = err as any;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
    details = zodErr.errors?.map((e: any) => ({
      field: e.path.join('.') || '(root)',
      message: e.message,
    }));

    logger.warn('Validation', `Failed on ${route}`, {
      fields: details?.map((d) => `${d.field}: ${d.message}`),
      body: req.body,
    });

    res.status(statusCode).json({
      success: false,
      error: { message, code, details },
    });
    return;
  }

  // 4xx operational errors — warn level
  if (statusCode >= 400 && statusCode < 500) {
    logger.warn('ErrorHandler', `${statusCode} on ${route} — ${message}`, {
      code,
      ...(req.user ? { userId: (req.user as any).id } : {}),
    });
  }

  // 5xx unexpected errors — error level with stack
  if (statusCode >= 500) {
    logger.error('ErrorHandler', `Unexpected error on ${route}`, {
      message: err.message,
      stack: err.stack,
    });
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code,
      ...(process.env.NODE_ENV === 'development' && statusCode >= 500 && { stack: err.stack }),
    },
  });
};
