import { describe, it, expect } from 'vitest';
import { calculateNetBalances, simplifyDebts, buildBalanceSheet, scaleOwedAmounts } from '../settlementService';

const equalExpense = (paidById: string, baseAmount: number, userIds: string[]) => ({
  paidById,
  splitType: 'EQUAL',
  baseAmount,
  splits: userIds.map((userId) => ({ userId, amount: userId === paidById ? baseAmount : 0 })),
});

describe('calculateNetBalances', () => {
  it('EQUAL split: payer is owed, others owe equally', () => {
    const balances = calculateNetBalances([equalExpense('a', 3000, ['a', 'b', 'c'])]);
    const map = Object.fromEntries(balances.map((b) => [b.userId, b.amount]));
    expect(map.a).toBe(2000);
    expect(map.b).toBe(-1000);
    expect(map.c).toBe(-1000);
  });

  it('EXACT split: contributions vary, fair share stays equal', () => {
    // ₹3000 dinner, A contributed 900, B contributed 2100; fair share 1500 each
    const balances = calculateNetBalances([
      {
        paidById: 'b',
        splitType: 'EXACT',
        baseAmount: 3000,
        splits: [
          { userId: 'a', amount: 900 },
          { userId: 'b', amount: 2100 },
        ],
      },
    ]);
    const map = Object.fromEntries(balances.map((b) => [b.userId, b.amount]));
    expect(map.a).toBe(-600);
    expect(map.b).toBe(600);
  });
});

describe('simplifyDebts', () => {
  it('nets out transitive debt (A owes B, B owes C → A pays C)', () => {
    const debts = simplifyDebts([
      { userId: 'a', amount: -2000 },
      { userId: 'b', amount: 0 },
      { userId: 'c', amount: 2000 },
    ]);
    expect(debts).toEqual([{ from: 'a', to: 'c', amount: 2000 }]);
  });

  it('produces at most n-1 transactions', () => {
    const debts = simplifyDebts([
      { userId: 'a', amount: 4700 },
      { userId: 'b', amount: -2800 },
      { userId: 'c', amount: -1900 },
    ]);
    expect(debts).toHaveLength(2);
    expect(debts.reduce((s, d) => s + d.amount, 0)).toBeCloseTo(4700, 2);
  });

  it('ignores dust below 1 cent', () => {
    expect(simplifyDebts([{ userId: 'a', amount: 0.005 }, { userId: 'b', amount: -0.005 }])).toEqual([]);
  });
});

describe('buildBalanceSheet', () => {
  it('applies settled settlements to net balances before simplifying', () => {
    const { netBalances, simplifiedDebts } = buildBalanceSheet(
      [equalExpense('a', 4000, ['a', 'b'])], // b owes a 2000
      [{ fromUserId: 'b', toUserId: 'a', amount: 2000 }]
    );
    const map = Object.fromEntries(netBalances.map((b) => [b.userId, b.amount]));
    expect(map.a).toBe(0);
    expect(map.b).toBe(0);
    expect(simplifiedDebts).toEqual([]);
  });

  it('partial settlement leaves residual debt', () => {
    const { simplifiedDebts } = buildBalanceSheet(
      [equalExpense('a', 4000, ['a', 'b'])],
      [{ fromUserId: 'b', toUserId: 'a', amount: 1500 }]
    );
    expect(simplifiedDebts).toEqual([{ from: 'b', to: 'a', amount: 500 }]);
  });
});

describe('calculateNetBalances with owedAmount (itemization)', () => {
  it('uses owedAmount as fair share when present', () => {
    // ₹3240 bill paid by A. Owed: A 850, B 1793, C 597.
    const balances = calculateNetBalances([
      {
        paidById: 'a',
        splitType: 'EXACT',
        baseAmount: 3240,
        splits: [
          { userId: 'a', amount: 3240, owedAmount: 850 },
          { userId: 'b', amount: 0, owedAmount: 1793 },
          { userId: 'c', amount: 0, owedAmount: 597 },
        ],
      },
    ]);
    const map = Object.fromEntries(balances.map((b) => [b.userId, b.amount]));
    expect(map.a).toBe(2390); // 3240 - 850
    expect(map.b).toBe(-1793);
    expect(map.c).toBe(-597);
  });

  it('null owedAmount keeps legacy equal-share behavior', () => {
    const balances = calculateNetBalances([equalExpense('a', 3000, ['a', 'b', 'c'])]);
    const map = Object.fromEntries(balances.map((b) => [b.userId, b.amount]));
    expect(map.a).toBe(2000);
  });
});

describe('scaleOwedAmounts', () => {
  it('reconciles rounding drift onto the largest scaled share', () => {
    // owed 100, 100, 101 (sum 301) scaled by 1/7:
    // independently-rounded shares are 14.29 + 14.29 + 14.43 = 43.01,
    // but baseAmount rounds to 43.00 — a 1-cent drift that must land on the
    // largest share (c) so the map sums exactly to baseAmount.
    const exchangeRate = 1 / 7;
    const baseAmount = 43; // roundCurrency(301 * exchangeRate)
    const scaled = scaleOwedAmounts(
      [
        { userId: 'a', owedAmount: 100 },
        { userId: 'b', owedAmount: 100 },
        { userId: 'c', owedAmount: 101 },
      ],
      exchangeRate,
      baseAmount
    );

    expect(scaled.get('a')).toBe(14.29);
    expect(scaled.get('b')).toBe(14.29);
    expect(scaled.get('c')).toBe(14.42); // 14.43 - 0.01 drift absorbed here

    const sum = Array.from(scaled.values()).reduce((s, v) => s + v, 0);
    expect(Math.round(sum * 100) / 100).toBe(baseAmount);
  });

  it('exchangeRate 1 is a no-drift passthrough', () => {
    const scaled = scaleOwedAmounts(
      [
        { userId: 'a', owedAmount: 10 },
        { userId: 'b', owedAmount: 20 },
        { userId: 'c', owedAmount: 30 },
      ],
      1,
      60
    );

    expect(scaled.get('a')).toBe(10);
    expect(scaled.get('b')).toBe(20);
    expect(scaled.get('c')).toBe(30);
  });
});
