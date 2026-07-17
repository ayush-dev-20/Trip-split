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
