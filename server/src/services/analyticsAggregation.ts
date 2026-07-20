import { roundCurrency } from '../utils/helpers';

export interface TripForAggregation {
  id: string;
  destination: string | null;
  budget: number | null;
  budgetCurrency: string;
  expenses: { baseAmount: number; category: string }[];
}

export interface TripRawAggregate {
  tripId: string;
  destination: string | null;
  budgetCurrency: string;
  budget: number | null;
  rawTotal: number;
  categoryTotals: Record<string, { total: number; count: number }>;
  expenseCount: number;
}

export interface BudgetCommitment {
  tripsWithBudget: number;
  tripsUnderBudget: number;
  percentage: number;
}

export interface CategoryBreakdownItem {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

/** One trip's raw totals, in that trip's own currency — no conversion here. */
export function computeTripRawAggregate(trip: TripForAggregation): TripRawAggregate {
  const categoryTotals: Record<string, { total: number; count: number }> = {};
  let rawTotal = 0;
  for (const e of trip.expenses) {
    rawTotal += e.baseAmount;
    if (!categoryTotals[e.category]) categoryTotals[e.category] = { total: 0, count: 0 };
    categoryTotals[e.category].total += e.baseAmount;
    categoryTotals[e.category].count += 1;
  }
  return {
    tripId: trip.id,
    destination: trip.destination,
    budgetCurrency: trip.budgetCurrency,
    budget: trip.budget,
    rawTotal: roundCurrency(rawTotal),
    categoryTotals,
    expenseCount: trip.expenses.length,
  };
}

/**
 * Budget commitment compares each trip's own spend against its own budget —
 * both already in the same currency by construction, so this runs on raw
 * (unconverted) totals, deliberately BEFORE any cross-trip currency conversion.
 */
export function computeBudgetCommitment(trips: TripRawAggregate[]): BudgetCommitment {
  const withBudget = trips.filter((t) => t.budget != null && t.budget > 0);
  const underBudget = withBudget.filter((t) => t.rawTotal <= (t.budget as number));
  return {
    tripsWithBudget: withBudget.length,
    tripsUnderBudget: underBudget.length,
    percentage: withBudget.length > 0 ? Math.round((underBudget.length / withBudget.length) * 100) : 0,
  };
}

/** Merges already-currency-converted per-entity category totals into one sorted breakdown. */
export function mergeCategoryTotals(
  entities: Record<string, { total: number; count: number }>[]
): CategoryBreakdownItem[] {
  const merged: Record<string, { total: number; count: number }> = {};
  for (const entity of entities) {
    for (const [category, { total, count }] of Object.entries(entity)) {
      if (!merged[category]) merged[category] = { total: 0, count: 0 };
      merged[category].total += total;
      merged[category].count += count;
    }
  }
  const grandTotal = Object.values(merged).reduce((s, c) => s + c.total, 0);
  return Object.entries(merged)
    .map(([category, { total, count }]) => ({
      category,
      total: roundCurrency(total),
      count,
      percentage: grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export function pickTopDestinations(trips: { destination: string | null }[]): { destination: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const t of trips) {
    if (!t.destination) continue;
    counts[t.destination] = (counts[t.destination] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([destination, count]) => ({ destination, count }))
    .sort((a, b) => b.count - a.count);
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * No range → monthly buckets across all-time.
 * Range <= 45 days → daily buckets.
 * Range > 45 days → monthly buckets.
 */
export function bucketSpendingByPeriod(
  items: { date: Date; amount: number }[],
  startDate: Date | null,
  endDate: Date | null
): { label: string; amount: number }[] {
  const useDailyBuckets =
    startDate != null &&
    endDate != null &&
    (endDate.getTime() - startDate.getTime()) / 86_400_000 <= 45;

  if (useDailyBuckets) {
    const totals: Record<string, number> = {};
    const cursor = new Date(Date.UTC(startDate!.getUTCFullYear(), startDate!.getUTCMonth(), startDate!.getUTCDate()));
    const endDay = new Date(Date.UTC(endDate!.getUTCFullYear(), endDate!.getUTCMonth(), endDate!.getUTCDate()));
    while (cursor <= endDay) {
      totals[cursor.toISOString().split('T')[0]] = 0;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    for (const item of items) {
      const key = item.date.toISOString().split('T')[0];
      if (totals[key] !== undefined) totals[key] += item.amount;
    }
    return Object.entries(totals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => {
        const d = new Date(`${date}T00:00:00.000Z`);
        return { label: `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`, amount: roundCurrency(amount) };
      });
  }

  // Monthly buckets — keyed by "YYYY-M" so different years never collide.
  const totals: Record<string, number> = {};
  for (const item of items) {
    const key = `${item.date.getUTCFullYear()}-${item.date.getUTCMonth()}`;
    totals[key] = (totals[key] || 0) + item.amount;
  }
  return Object.entries(totals)
    .sort(([a], [b]) => {
      const [ay, am] = a.split('-').map(Number);
      const [by, bm] = b.split('-').map(Number);
      return ay - by || am - bm;
    })
    .map(([key, amount]) => {
      const [year, month] = key.split('-').map(Number);
      return { label: `${MONTH_NAMES[month]} ${year}`, amount: roundCurrency(amount) };
    });
}

export interface GroupActivitySummary {
  groupId: string;
  name: string;
  totalSpent: number;
  expenseCount: number;
}

export function pickMostActiveGroup(groups: GroupActivitySummary[]): GroupActivitySummary | null {
  if (groups.length === 0) return null;
  return groups.reduce((most, g) => (g.expenseCount > most.expenseCount ? g : most));
}
