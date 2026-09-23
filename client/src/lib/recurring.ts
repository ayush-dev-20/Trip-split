import { parseISO, startOfDay, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import type { RecurringFrequency } from '@/types';

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  daily:   'Daily',
  weekly:  'Weekly',
  monthly: 'Monthly',
  yearly:  'Yearly',
};

/** Next calendar date on which this expense is due (always in the future). */
export function getNextDueDate(originalDate: string, pattern: RecurringFrequency): Date {
  const origin = parseISO(originalDate);
  const today  = startOfDay(new Date());

  switch (pattern) {
    case 'daily':
      return addDays(today, 1);

    case 'weekly': {
      let next = new Date(origin);
      while (startOfDay(next) <= today) next = addWeeks(next, 1);
      return next;
    }

    case 'monthly': {
      let next = new Date(origin);
      while (startOfDay(next) <= today) next = addMonths(next, 1);
      return next;
    }

    case 'yearly': {
      let next = new Date(origin);
      while (startOfDay(next) <= today) next = addYears(next, 1);
      return next;
    }

    default: {
      const _exhaustive: never = pattern;
      return _exhaustive;
    }
  }
}

/** Returns true if today matches the recurrence day for this expense. */
export function isDueToday(originalDate: string, pattern: RecurringFrequency): boolean {
  const origin = parseISO(originalDate);
  const today  = startOfDay(new Date());

  switch (pattern) {
    case 'daily':
      return true;
    case 'weekly':
      return today.getDay() === origin.getDay();
    case 'monthly': {
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      return today.getDate() === Math.min(origin.getDate(), lastDayOfMonth);
    }
    case 'yearly': {
      const isSameMonth = today.getMonth() === origin.getMonth();
      if (!isSameMonth) return false;
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      return today.getDate() === Math.min(origin.getDate(), lastDayOfMonth);
    }

    default: {
      const _exhaustive: never = pattern;
      return _exhaustive;
    }
  }
}

/**
 * Most recent scheduled occurrence that is strictly after the template's anchor
 * date and on/before today — i.e. a cycle that should already have been paid.
 * `null` for `daily` (due every day, so there's no "missed cycle" to catch up
 * on) or when the first cycle after the anchor hasn't arrived yet.
 */
export function getMostRecentPastDueDate(originalDate: string, pattern: RecurringFrequency): Date | null {
  const origin = parseISO(originalDate);
  const today  = startOfDay(new Date());

  switch (pattern) {
    case 'daily':
      return null;

    case 'weekly': {
      let next = addWeeks(origin, 1);
      let prev: Date | null = null;
      while (startOfDay(next) <= today) { prev = next; next = addWeeks(next, 1); }
      return prev;
    }

    case 'monthly': {
      let next = addMonths(origin, 1);
      let prev: Date | null = null;
      while (startOfDay(next) <= today) { prev = next; next = addMonths(next, 1); }
      return prev;
    }

    case 'yearly': {
      let next = addYears(origin, 1);
      let prev: Date | null = null;
      while (startOfDay(next) <= today) { prev = next; next = addYears(next, 1); }
      return prev;
    }

    default: {
      const _exhaustive: never = pattern;
      return _exhaustive;
    }
  }
}

/** True when a scheduled occurrence has passed without being logged (today itself doesn't count — that's "due today"). */
export function isOverdue(originalDate: string, pattern: RecurringFrequency): boolean {
  const mostRecent = getMostRecentPastDueDate(originalDate, pattern);
  return !!mostRecent && startOfDay(mostRecent) < startOfDay(new Date());
}

/** The due date that logging this expense right now would satisfy — the missed date if overdue, today if due today, else the still-upcoming next due date. */
export function getFulfilledDueDate(originalDate: string, pattern: RecurringFrequency): Date {
  const mostRecent = getMostRecentPastDueDate(originalDate, pattern);
  if (mostRecent && startOfDay(mostRecent) < startOfDay(new Date())) return mostRecent;
  if (isDueToday(originalDate, pattern)) return startOfDay(new Date());
  return getNextDueDate(originalDate, pattern);
}

/** Normalises any frequency's amount to a monthly equivalent for summary stats. */
export function getMonthlyEquivalent(amount: number, pattern: RecurringFrequency): number {
  switch (pattern) {
    case 'daily':   return amount * 30;
    case 'weekly':  return amount * 4.33;
    case 'monthly': return amount;
    case 'yearly':  return amount / 12;

    default: {
      const _exhaustive: never = pattern;
      return _exhaustive;
    }
  }
}
