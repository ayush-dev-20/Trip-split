import { describe, it, expect } from 'vitest';
import { computeCategoryDeltas } from '../aiService';

describe('computeCategoryDeltas', () => {
  it('computes per-category current vs previous totals', () => {
    const current = [
      { category: 'FOOD', baseAmount: 100, title: 'Dinner' },
      { category: 'TRANSPORT', baseAmount: 50, title: 'Taxi' },
    ];
    const previous = [
      { category: 'FOOD', baseAmount: 40 },
    ];

    const { categoryDeltas } = computeCategoryDeltas(current, previous);

    expect(categoryDeltas).toEqual(
      expect.arrayContaining([
        { category: 'FOOD', current: 100, previous: 40 },
        { category: 'TRANSPORT', current: 50, previous: 0 },
      ])
    );
  });

  it('flags a single expense that is more than 2x the average of the rest of its category', () => {
    const current = [
      { category: 'FOOD', baseAmount: 500, title: 'Fancy dinner' },
      { category: 'FOOD', baseAmount: 20, title: 'Coffee' },
      { category: 'FOOD', baseAmount: 25, title: 'Lunch' },
    ];
    const { standoutExpenses } = computeCategoryDeltas(current, []);

    expect(standoutExpenses).toEqual(
      expect.arrayContaining([{ title: 'Fancy dinner', amount: 500, category: 'FOOD' }])
    );
    expect(standoutExpenses.find((e) => e.title === 'Coffee')).toBeUndefined();
  });

  it('flags categories present in current but absent from previous as standouts when material', () => {
    const current = [
      { category: 'SHOPPING', baseAmount: 200, title: 'New shoes' },
    ];
    const { categoryDeltas } = computeCategoryDeltas(current, []);
    expect(categoryDeltas).toEqual([{ category: 'SHOPPING', current: 200, previous: 0 }]);
  });

  it('returns empty results for no expenses', () => {
    const { categoryDeltas, standoutExpenses } = computeCategoryDeltas([], []);
    expect(categoryDeltas).toEqual([]);
    expect(standoutExpenses).toEqual([]);
  });
});
