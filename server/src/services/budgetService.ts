import { roundCurrency } from '../utils/helpers';

export interface BudgetStatus {
  budget: number;
  totalSpent: number;
  remaining: number;
  tripDays: number;
  daysElapsed: number;
  daysRemaining: number;
  spentPerDay: number;
  safePerDay: number;
  projectedTotal: number;
  pace: 'UNDER' | 'ON_TRACK' | 'OVER';
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days between two dates (UTC midnight boundaries), inclusive of the start day. */
function daysBetweenInclusive(start: Date, end: Date): number {
  const s = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const e = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.max(1, Math.round((e - s) / MS_PER_DAY) + 1);
}

/**
 * Burn-rate math for a trip budget. Pure — controller supplies totals.
 * Day semantics: a 7-day trip has tripDays=7; on day N, daysElapsed=N (the
 * current day counts as elapsed), daysRemaining = tripDays - daysElapsed.
 */
export function computeBudgetStatus(input: {
  budget: number | null;
  totalSpent: number;
  startDate: Date;
  endDate: Date;
  now?: Date;
}): BudgetStatus | { budget: null } {
  const { budget, totalSpent, startDate, endDate } = input;
  if (budget == null) return { budget: null };

  const now = input.now ?? new Date();
  const tripDays = daysBetweenInclusive(startDate, endDate);

  let daysElapsed: number;
  if (now < startDate) {
    daysElapsed = 0;
  } else {
    daysElapsed = Math.min(tripDays, daysBetweenInclusive(startDate, now));
  }
  const daysRemaining = tripDays - daysElapsed;

  const remaining = roundCurrency(budget - totalSpent);
  const spentPerDay = roundCurrency(totalSpent / Math.max(daysElapsed, 1));
  const safePerDay = roundCurrency(Math.max(remaining, 0) / Math.max(daysRemaining, 1));
  const projectedTotal = roundCurrency(spentPerDay * tripDays);

  const spentPct = (totalSpent / budget) * 100;
  const elapsedPct = (daysElapsed / tripDays) * 100;
  let pace: BudgetStatus['pace'];
  if (remaining < 0 || spentPct - elapsedPct > 10) pace = 'OVER';
  else if (elapsedPct - spentPct > 10) pace = 'UNDER';
  else pace = 'ON_TRACK';

  return {
    budget,
    totalSpent: roundCurrency(totalSpent),
    remaining,
    tripDays,
    daysElapsed,
    daysRemaining,
    spentPerDay,
    safePerDay,
    projectedTotal,
    pace,
  };
}
