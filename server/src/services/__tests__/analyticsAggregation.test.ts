import { describe, it, expect } from 'vitest';
import {
  computeTripRawAggregate,
  computeBudgetCommitment,
  mergeCategoryTotals,
  pickTopDestinations,
  bucketSpendingByPeriod,
  pickMostActiveGroup,
} from '../analyticsAggregation';

describe('computeTripRawAggregate', () => {
  it('sums baseAmount and groups by category, in the trip\'s own currency', () => {
    const trip = {
      id: 'trip-1',
      destination: 'Goa',
      budget: 5000,
      budgetCurrency: 'INR',
      expenses: [
        { baseAmount: 1200, category: 'FOOD' },
        { baseAmount: 800, category: 'FOOD' },
        { baseAmount: 2000, category: 'TRANSPORT' },
      ],
    };
    const result = computeTripRawAggregate(trip);
    expect(result.rawTotal).toBe(4000);
    expect(result.expenseCount).toBe(3);
    expect(result.categoryTotals.FOOD).toEqual({ total: 2000, count: 2 });
    expect(result.categoryTotals.TRANSPORT).toEqual({ total: 2000, count: 1 });
  });

  it('returns zero totals for a trip with no expenses', () => {
    const trip = { id: 'trip-2', destination: null, budget: null, budgetCurrency: 'USD', expenses: [] };
    const result = computeTripRawAggregate(trip);
    expect(result.rawTotal).toBe(0);
    expect(result.expenseCount).toBe(0);
    expect(result.categoryTotals).toEqual({});
  });
});

describe('computeBudgetCommitment', () => {
  it('counts trips at or under budget as committed', () => {
    const trips = [
      { tripId: '1', destination: null, budgetCurrency: 'USD', budget: 1000, rawTotal: 900, categoryTotals: {}, expenseCount: 1 },
      { tripId: '2', destination: null, budgetCurrency: 'USD', budget: 1000, rawTotal: 1000, categoryTotals: {}, expenseCount: 1 },
      { tripId: '3', destination: null, budgetCurrency: 'USD', budget: 1000, rawTotal: 1200, categoryTotals: {}, expenseCount: 1 },
    ];
    const result = computeBudgetCommitment(trips);
    expect(result.tripsWithBudget).toBe(3);
    expect(result.tripsUnderBudget).toBe(2); // 900 and exactly-1000 both count, 1200 doesn't
    expect(result.percentage).toBe(67); // round(2/3 * 100)
  });

  it('excludes trips with no budget set from the denominator', () => {
    const trips = [
      { tripId: '1', destination: null, budgetCurrency: 'USD', budget: null, rawTotal: 500, categoryTotals: {}, expenseCount: 1 },
      { tripId: '2', destination: null, budgetCurrency: 'USD', budget: 1000, rawTotal: 500, categoryTotals: {}, expenseCount: 1 },
    ];
    const result = computeBudgetCommitment(trips);
    expect(result.tripsWithBudget).toBe(1);
    expect(result.tripsUnderBudget).toBe(1);
    expect(result.percentage).toBe(100);
  });

  it('returns 0 percentage when no trips have a budget', () => {
    const result = computeBudgetCommitment([
      { tripId: '1', destination: null, budgetCurrency: 'USD', budget: null, rawTotal: 500, categoryTotals: {}, expenseCount: 1 },
    ]);
    expect(result.tripsWithBudget).toBe(0);
    expect(result.percentage).toBe(0);
  });
});

describe('mergeCategoryTotals', () => {
  it('sums matching categories across entities and computes percentages', () => {
    const result = mergeCategoryTotals([
      { FOOD: { total: 100, count: 2 }, TRANSPORT: { total: 50, count: 1 } },
      { FOOD: { total: 50, count: 1 } },
    ]);
    const food = result.find((r) => r.category === 'FOOD')!;
    const transport = result.find((r) => r.category === 'TRANSPORT')!;
    expect(food).toEqual({ category: 'FOOD', total: 150, count: 3, percentage: 75 });
    expect(transport).toEqual({ category: 'TRANSPORT', total: 50, count: 1, percentage: 25 });
  });

  it('returns an empty array for no spend', () => {
    expect(mergeCategoryTotals([])).toEqual([]);
  });
});

describe('pickTopDestinations', () => {
  it('counts trips per destination, sorted descending, skipping nulls', () => {
    const result = pickTopDestinations([
      { destination: 'Goa' }, { destination: 'Goa' }, { destination: 'Manali' }, { destination: null },
    ]);
    expect(result).toEqual([
      { destination: 'Goa', count: 2 },
      { destination: 'Manali', count: 1 },
    ]);
  });
});

describe('bucketSpendingByPeriod', () => {
  it('buckets by month when no date range is given', () => {
    const items = [
      { date: new Date('2026-01-15'), amount: 100 },
      { date: new Date('2026-01-20'), amount: 50 },
      { date: new Date('2026-03-01'), amount: 200 },
    ];
    const result = bucketSpendingByPeriod(items, null, null);
    expect(result).toEqual([
      { label: 'Jan 2026', amount: 150 },
      { label: 'Mar 2026', amount: 200 },
    ]);
  });

  it('buckets by day for a short custom range (<= 45 days)', () => {
    const items = [{ date: new Date('2026-06-05'), amount: 100 }];
    const result = bucketSpendingByPeriod(items, new Date('2026-06-01'), new Date('2026-06-10'));
    expect(result).toHaveLength(10); // Jun 1–10 inclusive
    expect(result.find((r) => r.label === 'Jun 5')?.amount).toBe(100);
  });

  it('buckets by month for a long custom range (> 45 days)', () => {
    const items = [{ date: new Date('2026-02-15'), amount: 300 }];
    const result = bucketSpendingByPeriod(items, new Date('2026-01-01'), new Date('2026-04-01'));
    expect(result.some((r) => r.label === 'Feb 2026' && r.amount === 300)).toBe(true);
  });

  it('produces exactly the UTC-anchored day range regardless of local timezone', () => {
    const result = bucketSpendingByPeriod([], new Date('2026-06-01'), new Date('2026-06-03'));
    expect(result).toEqual([
      { label: 'Jun 1', amount: 0 },
      { label: 'Jun 2', amount: 0 },
      { label: 'Jun 3', amount: 0 },
    ]);
  });
});

describe('pickMostActiveGroup', () => {
  it('ranks by expense count, not total spend', () => {
    const groups = [
      { groupId: 'a', name: 'Roommates', totalSpent: 5000, expenseCount: 3 },
      { groupId: 'b', name: 'Office Lunch', totalSpent: 200, expenseCount: 40 },
    ];
    const result = pickMostActiveGroup(groups);
    expect(result?.groupId).toBe('b'); // fewer rupees, way more transactions
  });

  it('returns null for an empty list', () => {
    expect(pickMostActiveGroup([])).toBeNull();
  });
});
