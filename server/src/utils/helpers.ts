import { nanoid } from 'nanoid';

/**
 * Generate a short invite code for groups and trips.
 */
export function generateInviteCode(length = 10): string {
  return nanoid(length);
}

/**
 * Paginate query results.
 */
export function paginate(page = 1, limit = 20) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;
  return { take, skip };
}

/**
 * Build pagination metadata for API responses.
 */
export function paginationMeta(total: number, page: number, limit: number) {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * Convert amount to smallest currency unit (cents).
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Convert from smallest currency unit (cents) to decimal.
 */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Round to 2 decimal places (currency precision).
 */
export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}
