/**
 * Custom error class for API errors with HTTP status codes.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(message = 'Bad Request', code?: string) {
    return new AppError(message, 400, code);
  }

  static unauthorized(message = 'Unauthorized', code?: string) {
    return new AppError(message, 401, code);
  }

  static forbidden(message = 'Forbidden', code?: string) {
    return new AppError(message, 403, code);
  }

  static notFound(message = 'Not Found', code?: string) {
    return new AppError(message, 404, code);
  }

  static conflict(message = 'Conflict', code?: string) {
    return new AppError(message, 409, code);
  }

  static tooMany(message = 'Too Many Requests', code?: string) {
    return new AppError(message, 429, code);
  }

  static internal(message = 'Internal Server Error', code?: string) {
    return new AppError(message, 500, code);
  }
}
