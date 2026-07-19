import { describe, it, expect } from 'vitest';
import { computeBudgetStatus } from '../budgetService';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe('computeBudgetStatus', () => {
  const base = { budget: 70000, startDate: d('2026-07-10'), endDate: d('2026-07-16') }; // 7-day trip

  it('returns { budget: null } when no budget set', () => {
    expect(computeBudgetStatus({ ...base, budget: null, totalSpent: 100, now: d('2026-07-12') }))
      .toEqual({ budget: null });
  });

  it('mid-trip: day counts, safePerDay, projection', () => {
    // now = day 3 of 7 → daysElapsed 3, daysRemaining 4
    const s = computeBudgetStatus({ ...base, totalSpent: 38000, now: d('2026-07-12') });
    if (!('tripDays' in s)) throw new Error('expected full status');
    expect(s.tripDays).toBe(7);
    expect(s.daysElapsed).toBe(3);
    expect(s.daysRemaining).toBe(4);
    expect(s.remaining).toBe(32000);
    expect(s.spentPerDay).toBeCloseTo(12666.67, 1);
    expect(s.safePerDay).toBe(8000);
    expect(s.projectedTotal).toBeCloseTo(88666.67, 1);
    expect(s.pace).toBe('OVER'); // 54% spent vs 43% elapsed → beyond +10 band? 54.3-42.9 = 11.4 → OVER
  });

  it('before trip start: elapsed 0, full allowance', () => {
    const s = computeBudgetStatus({ ...base, totalSpent: 0, now: d('2026-07-01') });
    if (!('tripDays' in s)) throw new Error('expected full status');
    expect(s.daysElapsed).toBe(0);
    expect(s.daysRemaining).toBe(7);
    expect(s.safePerDay).toBe(10000);
    expect(s.pace).toBe('ON_TRACK');
  });

  it('after trip end: remaining days 0, no division blowup', () => {
    const s = computeBudgetStatus({ ...base, totalSpent: 71000, now: d('2026-08-01') });
    if (!('tripDays' in s)) throw new Error('expected full status');
    expect(s.daysRemaining).toBe(0);
    expect(s.daysElapsed).toBe(7);
    expect(s.pace).toBe('OVER'); // remaining < 0 always OVER
  });

  it('on-track within ±10% band', () => {
    // 50% elapsed (now end of day ~3.5 → use day 4: elapsed 4/7 = 57%), spend 57% of budget
    const s = computeBudgetStatus({ ...base, totalSpent: 40000, now: d('2026-07-13') });
    if (!('tripDays' in s)) throw new Error('expected full status');
    expect(s.pace).toBe('ON_TRACK'); // 57.1% spent vs 57.1% elapsed
  });
});
