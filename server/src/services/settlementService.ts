import { roundCurrency } from '../utils/helpers';

export interface Balance {
  userId: string;
  amount: number; // positive = is owed, negative = owes
}

export interface Debt {
  from: string;
  to: string;
  amount: number;
}

/**
 * Debt simplification algorithm.
 *
 * Given a list of net balances (positive = creditor, negative = debtor),
 * this minimizes the number of transactions needed to settle all debts.
 *
 * Uses a greedy approach:
 * 1. Calculate net balance for each person.
 * 2. Separate into creditors (positive) and debtors (negative).
 * 3. Match largest debtor with largest creditor greedily.
 */
export function simplifyDebts(balances: Balance[]): Debt[] {
  // Filter out zero balances
  const creditors: Balance[] = []; // people who are owed money
  const debtors: Balance[] = [];   // people who owe money

  for (const b of balances) {
    const rounded = roundCurrency(b.amount);
    if (rounded > 0.01) {
      creditors.push({ userId: b.userId, amount: rounded });
    } else if (rounded < -0.01) {
      debtors.push({ userId: b.userId, amount: Math.abs(rounded) });
    }
  }

  // Sort descending by amount
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transactions: Debt[] = [];

  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];

    const settleAmount = roundCurrency(Math.min(creditor.amount, debtor.amount));

    if (settleAmount > 0.01) {
      transactions.push({
        from: debtor.userId,
        to: creditor.userId,
        amount: settleAmount,
      });
    }

    creditor.amount = roundCurrency(creditor.amount - settleAmount);
    debtor.amount = roundCurrency(debtor.amount - settleAmount);

    if (creditor.amount < 0.01) i++;
    if (debtor.amount < 0.01) j++;
  }

  return transactions;
}

/**
 * Calculate net balances for all users in a trip.
 *
 * Model: split.amount = how much each person CONTRIBUTED (paid) toward the expense.
 * Fair share for each person = baseAmount / number of participants.
 * Net balance per person = sum of (contributed - fair_share) across all expenses.
 *
 * Example:
 *   Expense ₹4000, A paid all (contribution: A=4000, B=0), fair share = 2000 each
 *   → A net: +2000, B net: -2000
 *
 *   Expense ₹3000, B paid 70% (contribution: A=900, B=2100), fair share = 1500 each
 *   → A net: -600, B net: +600
 *
 *   Total: A = 2000 - 600 = +1400, B = -2000 + 600 = -1400
 *   → B owes A ₹1400
 */
export function calculateNetBalances(
  expenses: {
    paidById: string;
    splitType: string;
    baseAmount: number;
    splits: { userId: string; amount: number; owedAmount?: number | null }[];
  }[]
): Balance[] {
  const balanceMap = new Map<string, number>();

  for (const expense of expenses) {
    const participantCount = expense.splits.length;
    if (participantCount === 0) continue;

    const fairShare = roundCurrency(expense.baseAmount / participantCount);

    for (const split of expense.splits) {
      // Determine how much this person actually contributed (paid).
      // For EQUAL: the payer paid the full amount, everyone else paid 0.
      // For PERCENTAGE / EXACT / SHARES: split.amount = their contribution.
      let contributed: number;
      if (expense.splitType === 'EQUAL') {
        contributed = split.userId === expense.paidById ? expense.baseAmount : 0;
      } else {
        contributed = split.amount;
      }

      // Fair share = per-split owedAmount override (itemization), else equal split.
      const share = split.owedAmount ?? fairShare;

      // Net balance change = what they paid − their fair share
      const current = balanceMap.get(split.userId) || 0;
      balanceMap.set(split.userId, current + contributed - share);
    }
  }

  return Array.from(balanceMap.entries()).map(([userId, amount]) => ({
    userId,
    amount: roundCurrency(amount),
  }));
}

/**
 * Calculate pairwise debts (who owes whom and how much).
 */
export interface SheetExpense {
  paidById: string;
  splitType: string;
  baseAmount: number;
  splits: { userId: string; amount: number; owedAmount?: number | null }[];
}

export interface SheetSettlement {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

/**
 * Net balances + simplified debts for a set of expenses, after applying
 * settled repayments (fromUser paid toUser → from's balance rises, to's falls).
 */
export function buildBalanceSheet(
  expenses: SheetExpense[],
  settledSettlements: SheetSettlement[]
): { netBalances: Balance[]; simplifiedDebts: Debt[] } {
  const netBalances = calculateNetBalances(expenses);
  const byUser = new Map(netBalances.map((b) => [b.userId, b]));

  for (const s of settledSettlements) {
    const from = byUser.get(s.fromUserId);
    const to = byUser.get(s.toUserId);
    if (from) from.amount = roundCurrency(from.amount + s.amount);
    if (to) to.amount = roundCurrency(to.amount - s.amount);
  }

  return { netBalances, simplifiedDebts: simplifyDebts(netBalances) };
}

/**
 * Scale per-split owedAmount (fair share, entered in expense currency) into the
 * trip's base currency, then reconcile rounding drift against baseAmount.
 *
 * Each owedAmount is independently rounded via `roundCurrency(owed * exchangeRate)`,
 * so Σ(scaled owed) can differ from baseAmount by a few cents (baseAmount is rounded
 * separately via convertCurrency). Any such drift is added to the LARGEST scaled
 * owedAmount so the map sums to baseAmount exactly (to 2dp).
 */
export function scaleOwedAmounts(
  owedSplits: { userId: string; owedAmount: number }[],
  exchangeRate: number,
  baseAmount: number
): Map<string, number> {
  const scaled = new Map<string, number>(
    owedSplits.map((s) => [s.userId, roundCurrency(s.owedAmount * exchangeRate)])
  );

  const sumScaled = roundCurrency(
    Array.from(scaled.values()).reduce((sum, v) => sum + v, 0)
  );
  const drift = roundCurrency(baseAmount - sumScaled);

  if (Math.abs(drift) >= 0.01 && scaled.size > 0) {
    let largestUserId = owedSplits[0]!.userId;
    let largestValue = -Infinity;
    for (const [userId, value] of scaled) {
      if (value > largestValue) {
        largestValue = value;
        largestUserId = userId;
      }
    }
    scaled.set(largestUserId, roundCurrency(largestValue + drift));
  }

  return scaled;
}

export function calculatePairwiseDebts(
  expenses: {
    paidById: string;
    splitType: string;
    baseAmount: number;
    splits: { userId: string; amount: number }[];
  }[]
): Debt[] {
  const netBalances = calculateNetBalances(expenses);
  return simplifyDebts(netBalances);
}
