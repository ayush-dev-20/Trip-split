import { roundCurrency } from '../utils/helpers';

export interface PersonalBudgetStatus {
  budget: number;
  currency: string;
  totalSpent: number;
  remaining: number;
  daysInMonth: number;
  daysElapsed: number;
  daysRemaining: number;
  spentPerDay: number;
  safePerDay: number;
  projectedTotal: number;
  pace: 'UNDER' | 'ON_TRACK' | 'OVER';
}

/**
 * Burn-rate math for a personal monthly budget. Pure — controller supplies totals.
 * Period is always the calendar month (UTC) containing `now`, 1st to last day.
 */
export function computeMonthlyBudgetStatus(input: {
  budget: number | null;
  currency: string;
  totalSpentThisMonth: number;
  now?: Date;
}): PersonalBudgetStatus | { budget: null } {
  const { budget, currency, totalSpentThisMonth } = input;
  if (budget == null) return { budget: null };

  const now = input.now ?? new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const daysElapsed = now.getUTCDate();
  const daysRemaining = daysInMonth - daysElapsed;

  const remaining = roundCurrency(budget - totalSpentThisMonth);
  const spentPerDay = roundCurrency(totalSpentThisMonth / Math.max(daysElapsed, 1));
  const safePerDay = roundCurrency(Math.max(remaining, 0) / Math.max(daysRemaining, 1));
  const projectedTotal = roundCurrency(spentPerDay * daysInMonth);

  const spentPct = (totalSpentThisMonth / budget) * 100;
  const elapsedPct = (daysElapsed / daysInMonth) * 100;
  let pace: PersonalBudgetStatus['pace'];
  if (remaining < 0 || spentPct - elapsedPct > 10) pace = 'OVER';
  else if (elapsedPct - spentPct > 10) pace = 'UNDER';
  else pace = 'ON_TRACK';

  return {
    budget,
    currency,
    totalSpent: roundCurrency(totalSpentThisMonth),
    remaining,
    daysInMonth,
    daysElapsed,
    daysRemaining,
    spentPerDay,
    safePerDay,
    projectedTotal,
    pace,
  };
}
