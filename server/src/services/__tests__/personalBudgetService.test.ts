import { describe, it, expect } from 'vitest';
import { computeMonthlyBudgetStatus } from '../personalBudgetService';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe('computeMonthlyBudgetStatus', () => {
  const base = { budget: 30000, currency: 'INR' }; // July 2026 has 31 days

  it('returns { budget: null } when no budget set', () => {
    expect(computeMonthlyBudgetStatus({ ...base, budget: null, totalSpentThisMonth: 100, now: d('2026-07-12') }))
      .toEqual({ budget: null });
  });

  it('mid-month: day counts, safePerDay, projection', () => {
    // now = July 12 → daysInMonth 31, daysElapsed 12, daysRemaining 19
    const s = computeMonthlyBudgetStatus({ ...base, totalSpentThisMonth: 15000, now: d('2026-07-12') });
    if (!('daysInMonth' in s)) throw new Error('expected full status');
    expect(s.daysInMonth).toBe(31);
    expect(s.daysElapsed).toBe(12);
    expect(s.daysRemaining).toBe(19);
    expect(s.remaining).toBe(15000);
    expect(s.spentPerDay).toBe(1250);
    expect(s.safePerDay).toBeCloseTo(789.47, 1);
    expect(s.projectedTotal).toBeCloseTo(38750, 1);
    expect(s.pace).toBe('OVER'); // 50% spent vs 38.7% elapsed → +11.3 → OVER
  });

  it('start of month: elapsed 1, full allowance', () => {
    const s = computeMonthlyBudgetStatus({ ...base, totalSpentThisMonth: 0, now: d('2026-07-01') });
    if (!('daysInMonth' in s)) throw new Error('expected full status');
    expect(s.daysElapsed).toBe(1);
    expect(s.daysRemaining).toBe(30);
    expect(s.pace).toBe('ON_TRACK');
  });

  it('over budget: remaining negative always OVER', () => {
    const s = computeMonthlyBudgetStatus({ ...base, totalSpentThisMonth: 31000, now: d('2026-07-20') });
    if (!('daysInMonth' in s)) throw new Error('expected full status');
    expect(s.remaining).toBe(-1000);
    expect(s.pace).toBe('OVER');
  });

  it('on-track within ±10% band', () => {
    // July 20 → 20/31 = 64.5% elapsed, spend 64.5% of budget
    const s = computeMonthlyBudgetStatus({ ...base, totalSpentThisMonth: 19350, now: d('2026-07-20') });
    if (!('daysInMonth' in s)) throw new Error('expected full status');
    expect(s.pace).toBe('ON_TRACK');
  });

  it('leap-aware: February in a non-leap year has 28 days', () => {
    const s = computeMonthlyBudgetStatus({ ...base, totalSpentThisMonth: 0, now: d('2026-02-15') });
    if (!('daysInMonth' in s)) throw new Error('expected full status');
    expect(s.daysInMonth).toBe(28);
  });
});
