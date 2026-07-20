import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler, AppError } from '../utils';
import { calculateNetBalances, simplifyDebts } from '../services/settlementService';
import {
  computeTripRawAggregate,
  computeBudgetCommitment,
  mergeCategoryTotals,
  pickTopDestinations,
  bucketSpendingByPeriod,
  pickMostActiveGroup,
} from '../services/analyticsAggregation';
import { convertCurrency } from '../services/currencyService';

/**
 * GET /api/analytics/trip/:tripId
 * Comprehensive analytics for a single trip.
 */
export const getTripAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const userId = req.user!.id as string;
  const startDateParam = req.query.startDate as string | undefined;
  const endDateParam   = req.query.endDate   as string | undefined;

  if (startDateParam && endDateParam && new Date(startDateParam) > new Date(endDateParam)) {
    throw AppError.badRequest('startDate must be before endDate');
  }

  // Verify membership
  const isMember = await prisma.tripMember.findFirst({
    where: { tripId, userId },
  });
  if (!isMember) throw AppError.forbidden('You are not a member of this trip');

  const trip = await prisma.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: { members: { include: { user: { select: { id: true, name: true } } } } },
  });

  // Everything below is computed from `expenses` — filtering it here scopes
  // every chart/stat to the requested range. Settlement progress (further
  // down) intentionally stays unfiltered: "how much of the trip's debt is
  // settled" is a running total, not something scoped to a date window.
  const expenses = await prisma.expense.findMany({
    where: {
      tripId,
      ...(startDateParam || endDateParam
        ? {
            date: {
              ...(startDateParam ? { gte: new Date(startDateParam) } : {}),
              ...(endDateParam   ? { lte: new Date(endDateParam)   } : {}),
            },
          }
        : {}),
    },
    include: {
      paidBy: { select: { id: true, name: true } },
      splits: true,
    },
    orderBy: { date: 'asc' },
  });

  // Velocity/"daily average" figures use the requested range when given,
  // falling back to the trip's actual dates otherwise (unchanged behavior
  // when no range is passed).
  const rangeStart = startDateParam ? new Date(startDateParam) : trip.startDate;
  const rangeEnd   = endDateParam   ? new Date(endDateParam)   : trip.endDate;

  // 1. Category breakdown (for pie chart) — as array with totals, counts, percentages
  const categoryMap: Record<string, { total: number; count: number }> = {};
  for (const e of expenses) {
    if (!categoryMap[e.category]) categoryMap[e.category] = { total: 0, count: 0 };
    categoryMap[e.category].total += e.baseAmount;
    categoryMap[e.category].count += 1;
  }

  const totalSpent = expenses.reduce((sum: number, e: any) => sum + e.baseAmount, 0);

  const categoryBreakdown = Object.entries(categoryMap).map(([category, { total, count }]) => ({
    category,
    total: Math.round(total * 100) / 100,
    count,
    percentage: totalSpent > 0 ? Math.round((total / totalSpent) * 10000) / 100 : 0,
  }));

  // 2. Daily spending (for line/bar chart) — as array of { date, amount }
  const dailyMap: Record<string, number> = {};
  for (const e of expenses) {
    const day = e.date.toISOString().split('T')[0];
    dailyMap[day] = (dailyMap[day] || 0) + e.baseAmount;
  }
  const dailySpending = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 }));

  // 3. Budget vs Actual over time (for line chart)
  let cumulative = 0;
  const budgetVsActual = dailySpending.map(({ date, amount }) => {
    cumulative += amount;
    return {
      date,
      spent: amount,
      cumulative: Math.round(cumulative * 100) / 100,
      budget: trip.budget || null,
    };
  });

  // 4. Per-user spending breakdown — using contribution model
  //    split.amount = how much each person CONTRIBUTED (paid toward the expense)
  //    fair share = baseAmount / number of participants (always equal)
  //    For EQUAL splits: payer contributed the full amount, others contributed 0
  //    net = sum of (contributed - fairShare) across all expenses
  const userContributed: Record<string, number> = {};
  const userFairShare: Record<string, number> = {};
  const userNames: Record<string, string> = {};

  // Initialize all members
  for (const m of trip.members) {
    const uid = (m as any).userId;
    const uname = (m as any).user.name;
    userContributed[uid] = 0;
    userFairShare[uid] = 0;
    userNames[uid] = uname;
  }

  for (const e of expenses) {
    const participantCount = e.splits.length;
    const fairShare = e.baseAmount / participantCount;

    for (const s of e.splits) {
      // For EQUAL splits, payer contributed full amount, others 0
      let contributed: number;
      if (e.splitType === 'EQUAL') {
        contributed = s.userId === e.paidById ? e.baseAmount : 0;
      } else {
        // PERCENTAGE / EXACT / SHARES — split.amount is the contribution
        contributed = s.amount;
      }

      userContributed[s.userId] = (userContributed[s.userId] || 0) + contributed;
      userFairShare[s.userId] = (userFairShare[s.userId] || 0) + fairShare;
      if (!userNames[s.userId]) {
        userNames[s.userId] = s.userId; // fallback
      }
    }
  }

  const perUser = Object.keys(userNames).map((uid) => {
    const contributed = userContributed[uid] || 0;
    const fairShare = userFairShare[uid] || 0;
    const net = contributed - fairShare;
    return {
      userId: uid,
      name: userNames[uid],
      paid: Math.round(contributed * 100) / 100,
      owes: Math.round(fairShare * 100) / 100,
      net: Math.round(net * 100) / 100,
    };
  });

  // 5. Summary cards
  const highestExpense = expenses.length > 0
    ? expenses.reduce((max: any, e: any) => (e.baseAmount > max.baseAmount ? e : max))
    : null;

  // 6. Spending velocity (spending rate per day)
  const tripDays = Math.max(
    1,
    Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24))
  );
  const avgDailySpend = totalSpent / tripDays;
  const daysElapsed = Math.max(1, Math.ceil(
    (Math.min(Date.now(), rangeEnd.getTime()) - rangeStart.getTime()) /
      (1000 * 60 * 60 * 24)
  ));
  const projectedTotal = Math.round((totalSpent / daysElapsed) * tripDays * 100) / 100;

  // 7. Spending by day of week
  const dayOfWeekNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayOfWeekTotals: number[] = new Array(7).fill(0);
  for (const e of expenses) {
    const day = e.date.getDay();
    dayOfWeekTotals[day] += e.baseAmount;
  }
  const spendingByDayOfWeek = dayOfWeekTotals.map((amount, idx) => ({
    day: dayOfWeekNames[idx],
    amount: Math.round(amount * 100) / 100,
  }));

  // 8. Top 5 expenses
  const topExpenses = [...expenses]
    .sort((a, b) => b.baseAmount - a.baseAmount)
    .slice(0, 5)
    .map((e) => ({
      title: e.title,
      amount: Math.round(e.baseAmount * 100) / 100,
      category: e.category,
      paidBy: (e as any).paidBy?.name || 'Unknown',
      date: e.date.toISOString().split('T')[0],
    }));

  // 9. Split type distribution
  const splitTypeMap: Record<string, number> = {};
  for (const e of expenses) {
    splitTypeMap[e.splitType] = (splitTypeMap[e.splitType] || 0) + 1;
  }
  const splitTypeDistribution = Object.entries(splitTypeMap).map(([type, count]) => ({
    type,
    count,
  }));

  // 10. Settlement progress
  //   Compute the ORIGINAL total debt from raw expense balances (before any settlements).
  //   This represents the gross amount that needed to be settled.
  const netBalances = calculateNetBalances(
    expenses.map((e: any) => ({
      paidById: e.paidById,
      splitType: e.splitType,
      baseAmount: e.baseAmount,
      splits: e.splits.map((s: any) => ({ userId: s.userId, amount: s.amount, owedAmount: s.owedAmount })),
    }))
  );
  const simplifiedDebts = simplifyDebts(netBalances);
  // Total original debt = sum of all simplified debts (what needed settling before any payments)
  const originalTotalDebt = simplifiedDebts.reduce((sum: number, d: any) => sum + d.amount, 0);

  const settlements = await prisma.settlement.findMany({
    where: { tripId },
  });
  const settledAmount = settlements
    .filter((s) => s.status === 'SETTLED')
    .reduce((sum, s) => sum + s.amount, 0);
  const pendingAmount = settlements
    .filter((s) => s.status === 'PENDING')
    .reduce((sum, s) => sum + s.amount, 0);
  const disputedAmount = settlements
    .filter((s) => s.status === 'DISPUTED')
    .reduce((sum, s) => sum + s.amount, 0);

  const totalDebt = Math.round(originalTotalDebt * 100) / 100;
  const outstanding = Math.max(0, Math.round((totalDebt - settledAmount) * 100) / 100);

  const settlementProgress = {
    settled: Math.round(settledAmount * 100) / 100,
    pending: Math.round(pendingAmount * 100) / 100,
    disputed: Math.round(disputedAmount * 100) / 100,
    total: totalDebt,
    outstanding,
    percentage: totalDebt > 0
      ? Math.round((settledAmount / totalDebt) * 100)
      : 0,
  };

  // Adjust perUser net balances to account for settled payments.
  // When fromUser settled X to toUser: fromUser's debt decreases by X, toUser's credit decreases by X.
  for (const s of settlements.filter((s) => s.status === 'SETTLED')) {
    const fromEntry = perUser.find((u) => u.userId === s.fromUserId);
    const toEntry = perUser.find((u) => u.userId === s.toUserId);
    if (fromEntry) fromEntry.net = Math.round((fromEntry.net + s.amount) * 100) / 100;
    if (toEntry) toEntry.net = Math.round((toEntry.net - s.amount) * 100) / 100;
  }

  res.json({
    success: true,
    data: {
      dateRange: {
        startDate: rangeStart.toISOString(),
        endDate: rangeEnd.toISOString(),
      },
      summary: {
        totalSpent: Math.round(totalSpent * 100) / 100,
        remainingBudget: trip.budget
          ? Math.round((trip.budget - totalSpent) * 100) / 100
          : null,
        budget: trip.budget,
        highestExpense: highestExpense
          ? { title: highestExpense.title, amount: highestExpense.baseAmount }
          : null,
        totalTransactions: expenses.length,
        avgDailySpend: Math.round(avgDailySpend * 100) / 100,
        currency: trip.budgetCurrency,
      },
      categoryBreakdown,
      dailySpending,
      budgetVsActual,
      perUser,
      spendingByDayOfWeek,
      topExpenses,
      splitTypeDistribution,
      settlementProgress,
      spendingVelocity: {
        dailyAverage: Math.round(avgDailySpend * 100) / 100,
        projectedTotal,
        daysElapsed,
      },
    },
  });
});

/**
 * GET /api/analytics/trips-overview
 * Aggregates across every trip the user is a member of.
 */
export const getTripsOverview = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id as string;
  const startDateParam = req.query.startDate as string | undefined;
  const endDateParam   = req.query.endDate   as string | undefined;

  if (startDateParam && endDateParam && new Date(startDateParam) > new Date(endDateParam)) {
    throw AppError.badRequest('startDate must be before endDate');
  }
  const startDate = startDateParam ? new Date(startDateParam) : null;
  const endDate   = endDateParam   ? new Date(endDateParam)   : null;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { preferredCurrency: true },
  });
  const targetCurrency = user.preferredCurrency || 'USD';

  const trips = await prisma.trip.findMany({
    where: { members: { some: { userId } } },
    select: {
      id: true,
      destination: true,
      budget: true,
      budgetCurrency: true,
      expenses: {
        where: (startDate || endDate)
          ? { date: { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) } }
          : undefined,
        select: { baseAmount: true, category: true, date: true },
      },
    },
  });

  const rawAggregates = trips.map(computeTripRawAggregate);
  const budgetCommitment = computeBudgetCommitment(rawAggregates);

  // Convert each trip's total + category totals to the user's preferred
  // currency using ONE convertCurrency call per trip (also yields the
  // exchange rate, reused below to convert that trip's category subtotals
  // by multiplication instead of calling convertCurrency again per category).
  let totalSpent = 0;
  const convertedCategoryTotals: Record<string, { total: number; count: number }>[] = [];
  const timeSeriesItems: { date: Date; amount: number }[] = [];
  const exchangeRateByTrip: Record<string, number> = {};

  for (let i = 0; i < trips.length; i++) {
    const trip = trips[i];
    const raw = rawAggregates[i];
    if (raw.rawTotal === 0) continue;

    const { convertedAmount, exchangeRate } = await convertCurrency(raw.rawTotal, raw.budgetCurrency, targetCurrency);
    totalSpent += convertedAmount;
    exchangeRateByTrip[trip.id] = exchangeRate;

    const convertedCategories: Record<string, { total: number; count: number }> = {};
    for (const [category, { total, count }] of Object.entries(raw.categoryTotals)) {
      convertedCategories[category] = { total: Math.round(total * exchangeRate * 100) / 100, count };
    }
    convertedCategoryTotals.push(convertedCategories);

    for (const e of trip.expenses) {
      timeSeriesItems.push({ date: e.date, amount: Math.round(e.baseAmount * exchangeRate * 100) / 100 });
    }
  }

  const categoryBreakdown = mergeCategoryTotals(convertedCategoryTotals);
  const topDestinations = pickTopDestinations(trips);
  const spendingOverTime = bucketSpendingByPeriod(timeSeriesItems, startDate, endDate);

  // Settlement progress — a running total, deliberately not date-filtered
  // (same reasoning as the single-trip endpoint: settling up is not scoped
  // to a spend window). Fetched in two BATCHED queries across all the
  // user's trips at once (not one query per trip in a loop), then grouped
  // by tripId in JS — calculateNetBalances/simplifyDebts still run per-trip
  // since debt graphs don't merge across trips, but the DB round-trips don't
  // scale with trip count.
  const tripIds = trips.map((t) => t.id);
  const [allTripExpenses, allSettlements] = await Promise.all([
    prisma.expense.findMany({
      where: { tripId: { in: tripIds } },
      select: { tripId: true, paidById: true, splitType: true, baseAmount: true, splits: { select: { userId: true, amount: true } } },
    }),
    prisma.settlement.findMany({ where: { tripId: { in: tripIds }, status: 'SETTLED' } }),
  ]);

  let settledTotal = 0, grandTotalDebt = 0;
  for (let i = 0; i < trips.length; i++) {
    const trip = trips[i];
    const tripExpensesWithSplits = allTripExpenses.filter((e) => e.tripId === trip.id);
    if (tripExpensesWithSplits.length === 0) continue;

    const netBalances = calculateNetBalances(tripExpensesWithSplits);
    const simplifiedDebts = simplifyDebts(netBalances);
    const tripTotalDebt = simplifiedDebts.reduce((sum: number, d: any) => sum + d.amount, 0);
    if (tripTotalDebt === 0) continue;

    const tripSettled = allSettlements
      .filter((s) => s.tripId === trip.id)
      .reduce((sum, s) => sum + s.amount, 0);

    // Reuse the exchange rate already computed above for this trip's
    // currency when it had date-filtered spend; if the trip had no spend
    // in the selected window (so no rate was cached) but still has
    // all-time debt, fetch the rate now. Mirrors getGroupsOverview's
    // exchangeRateByGroup pattern.
    const exchangeRate = exchangeRateByTrip[trip.id]
      ?? (await convertCurrency(1, rawAggregates[i].budgetCurrency, targetCurrency)).exchangeRate;
    grandTotalDebt += tripTotalDebt * exchangeRate;
    settledTotal   += Math.min(tripSettled, tripTotalDebt) * exchangeRate;
  }
  const outstandingTotal = Math.max(0, grandTotalDebt - settledTotal);

  res.json({
    success: true,
    data: {
      dateRange: { startDate: startDateParam ?? null, endDate: endDateParam ?? null, isCustom: !!(startDateParam || endDateParam) },
      currency: targetCurrency,
      totalTrips: trips.length,
      totalSpent: Math.round(totalSpent * 100) / 100,
      avgPerTrip: trips.length > 0 ? Math.round((totalSpent / trips.length) * 100) / 100 : 0,
      budgetCommitment,
      categoryBreakdown,
      spendingOverTime,
      topDestinations,
      settlementProgress: {
        total: Math.round(grandTotalDebt * 100) / 100,
        settled: Math.round(settledTotal * 100) / 100,
        outstanding: Math.round(outstandingTotal * 100) / 100,
        percentage: grandTotalDebt > 0 ? Math.round((settledTotal / grandTotalDebt) * 100) : 0,
      },
    },
  });
});

/**
 * GET /api/analytics/groups-overview
 * Aggregates across every group the user is a member of.
 */
export const getGroupsOverview = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id as string;
  const startDateParam = req.query.startDate as string | undefined;
  const endDateParam   = req.query.endDate   as string | undefined;

  if (startDateParam && endDateParam && new Date(startDateParam) > new Date(endDateParam)) {
    throw AppError.badRequest('startDate must be before endDate');
  }
  const startDate = startDateParam ? new Date(startDateParam) : null;
  const endDate   = endDateParam   ? new Date(endDateParam)   : null;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { preferredCurrency: true },
  });
  const targetCurrency = user.preferredCurrency || 'USD';

  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    select: { group: { select: { id: true, name: true, defaultCurrency: true } } },
  });
  const groups = memberships.map((m) => m.group);
  const groupIdsForOverview = groups.map((g) => g.id);

  let totalSpent = 0;
  const convertedCategoryTotals: Record<string, { total: number; count: number }>[] = [];
  const timeSeriesItems: { date: Date; amount: number }[] = [];
  const groupSummaries: { groupId: string; name: string; totalSpent: number; memberCount: number; yourBalance: number }[] = [];
  const activitySummaries: { groupId: string; name: string; totalSpent: number; expenseCount: number }[] = [];
  const exchangeRateByGroup: Record<string, number> = {};

  // Date-filtered — drives totalSpent, category breakdown, time series, and
  // each row's "yourBalance" (balance FROM SPENDING IN THIS WINDOW,
  // consistent with the row's date-scoped totalSpent right next to it).
  // Fetched in ONE batched query across all the user's groups (not one query
  // per group in a loop), then grouped by groupId in JS — same "one query
  // per module" pattern used for the settlement batched queries below.
  const [allDateFilteredExpenses, memberCountRows] = await Promise.all([
    prisma.expense.findMany({
      where: {
        groupId: { in: groupIdsForOverview },
        tripId: null,
        ...((startDate || endDate)
          ? { date: { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) } }
          : {}),
      },
      select: { groupId: true, baseAmount: true, category: true, date: true, paidById: true, splitType: true, splits: { select: { userId: true, amount: true } } },
    }),
    prisma.groupMember.groupBy({
      by: ['groupId'],
      where: { groupId: { in: groupIdsForOverview } },
      _count: { _all: true },
    }),
  ]);
  const memberCountByGroup: Record<string, number> = {};
  for (const row of memberCountRows) {
    memberCountByGroup[row.groupId] = row._count._all;
  }

  for (const group of groups) {
    const expenses = allDateFilteredExpenses.filter((e) => e.groupId === group.id);
    const memberCount = memberCountByGroup[group.id] || 0;

    const rawTotal = expenses.reduce((s, e) => s + e.baseAmount, 0);
    activitySummaries.push({ groupId: group.id, name: group.name, totalSpent: rawTotal, expenseCount: expenses.length });

    if (rawTotal > 0) {
      const { convertedAmount, exchangeRate } = await convertCurrency(rawTotal, group.defaultCurrency, targetCurrency);
      totalSpent += convertedAmount;
      exchangeRateByGroup[group.id] = exchangeRate;

      const categoryTotals: Record<string, { total: number; count: number }> = {};
      for (const e of expenses) {
        if (!categoryTotals[e.category]) categoryTotals[e.category] = { total: 0, count: 0 };
        categoryTotals[e.category].total += e.baseAmount * exchangeRate;
        categoryTotals[e.category].count += 1;
      }
      convertedCategoryTotals.push(categoryTotals);

      for (const e of expenses) timeSeriesItems.push({ date: e.date, amount: e.baseAmount * exchangeRate });

      // Current user's balance within this group: contributed - fair share.
      // Mirrors the EQUAL-split contribution logic already used for trips.
      let contributed = 0, fairShare = 0;
      for (const e of expenses) {
        const mySplit = e.splits.find((s) => s.userId === userId);
        if (!mySplit || e.splits.length === 0) continue;
        fairShare += e.baseAmount / e.splits.length;
        contributed += e.splitType === 'EQUAL'
          ? (e.paidById === userId ? e.baseAmount : 0)
          : mySplit.amount;
      }
      groupSummaries.push({
        groupId: group.id,
        name: group.name,
        totalSpent: Math.round(convertedAmount * 100) / 100,
        memberCount,
        yourBalance: Math.round((contributed - fairShare) * exchangeRate * 100) / 100,
      });
    } else {
      groupSummaries.push({ groupId: group.id, name: group.name, totalSpent: 0, memberCount, yourBalance: 0 });
    }
  }

  const categoryBreakdown = mergeCategoryTotals(convertedCategoryTotals);
  const spendingOverTime = bucketSpendingByPeriod(timeSeriesItems, startDate, endDate);
  const mostActiveGroup = pickMostActiveGroup(activitySummaries);

  // Settlement progress — a running total, deliberately NOT date-filtered
  // (same rule as trips-overview: settling up isn't scoped to a spend
  // window). Fetched in two batched queries across all the user's groups
  // at once, then grouped by groupId in JS — same pattern as Task 3.
  const groupIds = groupIdsForOverview;
  const [allGroupExpenses, allGroupSettlements] = await Promise.all([
    prisma.expense.findMany({
      where: { groupId: { in: groupIds }, tripId: null },
      select: { groupId: true, paidById: true, splitType: true, baseAmount: true, splits: { select: { userId: true, amount: true } } },
    }),
    prisma.settlement.findMany({ where: { groupId: { in: groupIds }, status: 'SETTLED' } }),
  ]);

  let settledTotal = 0, grandTotalDebt = 0;
  for (const group of groups) {
    const groupExpensesAllTime = allGroupExpenses.filter((e) => e.groupId === group.id);
    if (groupExpensesAllTime.length === 0) continue;

    const netBalances = calculateNetBalances(groupExpensesAllTime);
    const simplifiedDebts = simplifyDebts(netBalances);
    const groupTotalDebt = simplifiedDebts.reduce((sum: number, d: any) => sum + d.amount, 0);
    if (groupTotalDebt === 0) continue;

    const groupSettled = allGroupSettlements
      .filter((s) => s.groupId === group.id)
      .reduce((sum, s) => sum + s.amount, 0);

    // Reuse the exchange rate already computed above for this group's
    // currency when it had date-filtered spend; if the group had no spend
    // in the selected window (so no rate was cached) but still has
    // all-time debt, fetch the rate now.
    const exchangeRate = exchangeRateByGroup[group.id]
      ?? (await convertCurrency(1, group.defaultCurrency, targetCurrency)).exchangeRate;

    grandTotalDebt += groupTotalDebt * exchangeRate;
    settledTotal   += Math.min(groupSettled, groupTotalDebt) * exchangeRate;
  }
  const outstandingTotal = Math.max(0, grandTotalDebt - settledTotal);

  res.json({
    success: true,
    data: {
      dateRange: { startDate: startDateParam ?? null, endDate: endDateParam ?? null, isCustom: !!(startDateParam || endDateParam) },
      currency: targetCurrency,
      totalGroups: groups.length,
      totalSpent: Math.round(totalSpent * 100) / 100,
      avgPerGroup: groups.length > 0 ? Math.round((totalSpent / groups.length) * 100) / 100 : 0,
      mostActiveGroup,
      categoryBreakdown,
      spendingOverTime,
      groups: groupSummaries,
      settlementProgress: {
        total: Math.round(grandTotalDebt * 100) / 100,
        settled: Math.round(settledTotal * 100) / 100,
        outstanding: Math.round(outstandingTotal * 100) / 100,
        percentage: grandTotalDebt > 0 ? Math.round((settledTotal / grandTotalDebt) * 100) : 0,
      },
    },
  });
});

// ─── Shared helper ───────────────────────────────────────────────────────────
/**
 * Fetches all ExpenseSplit rows for `userId` within an optional date range and
 * returns them enriched with their parent expense data.
 * This is the single source of truth for "what did this user personally spend".
 */
async function getUserSplitExpenses(
  userId: string,
  dateFilter?: { gte: Date; lte: Date },
  tripId?: string
) {
  return prisma.expenseSplit.findMany({
    where: {
      userId,
      expense: {
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(tripId ? { tripId } : {}),
        trip: { members: { some: { userId } } },
      },
    },
    include: {
      expense: {
        select: {
          id: true,
          title: true,
          baseAmount: true,
          category: true,
          date: true,
          currency: true,
          splitType: true,
          trip: { select: { id: true, name: true, budgetCurrency: true } },
          paidBy: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { expense: { date: 'desc' } },
  });
}

/**
 * GET /api/analytics/my-expenses
 * Returns every expense the authenticated user is a participant in,
 * along with their personal share (ExpenseSplit.amount) and a grand total.
 *
 * Query params:
 *   year?: number   – filter to a specific year (defaults to current year)
 */
export const getUserExpenses = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id as string;
  const year = parseInt(req.query.year as string) || new Date().getFullYear();
  const tripId = req.query.tripId as string | undefined;

  // When filtering by a specific trip, skip the year-based date window
  const dateFilter = tripId
    ? undefined
    : { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31, 23, 59, 59) };

  const splits = await getUserSplitExpenses(userId, dateFilter, tripId);

  const expenses = splits.map((s) => ({
    expenseId: s.expense.id,
    expenseName: s.expense.title,
    amount: Math.round(s.amount * 100) / 100,          // user's personal share
    fullAmount: Math.round(s.expense.baseAmount * 100) / 100, // total expense amount
    category: s.expense.category,
    date: s.expense.date.toISOString().split('T')[0],
    currency: s.expense.trip?.budgetCurrency ?? 'USD',
    splitType: s.expense.splitType,
    paidBy: s.expense.paidBy,
    trip: s.expense.trip ? { id: s.expense.trip.id, name: s.expense.trip.name } : null,
  }));

  const totalSpent = Math.round(
    splits.reduce((sum, s) => sum + s.amount, 0) * 100
  ) / 100;

  res.json({
    success: true,
    data: { year, totalSpent, totalExpenses: expenses.length, expenses },
  });
});

/**
 * GET /api/analytics/compare
 * Compare spending across multiple trips.
 */
export const compareTrips = asyncHandler(async (req: Request, res: Response) => {
  const tripIdsStr = req.query.tripIds as string | undefined;
  const tripIds = tripIdsStr?.split(',');
  if (!tripIds || tripIds.length < 2) {
    throw AppError.badRequest('Provide at least 2 tripIds to compare');
  }

  const trips = await prisma.trip.findMany({
    where: { id: { in: tripIds } },
    include: {
      expenses: { select: { baseAmount: true, category: true } },
      members: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  const comparison = trips.map((trip: any) => {
    const totalSpent = trip.expenses.reduce((sum: number, e: any) => sum + e.baseAmount, 0);
    const categoryBreakdown: Record<string, number> = {};
    for (const e of trip.expenses) {
      categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.baseAmount;
    }

    return {
      tripId: trip.id,
      name: trip.name,
      destination: trip.destination,
      totalSpent: Math.round(totalSpent * 100) / 100,
      budget: trip.budget,
      memberCount: trip.members.length,
      expenseCount: trip.expenses.length,
      perPersonAvg: Math.round((totalSpent / Math.max(1, trip.members.length)) * 100) / 100,
      categoryBreakdown,
    };
  });

  res.json({ success: true, data: comparison });
});

/**
 * GET /api/analytics/year-in-review
 * Annual spending report for a user.
 */
export const yearInReview = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id as string;
  const year = parseInt(req.query.year as string) || new Date().getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { preferredCurrency: true },
  });

  const dateFilter = { gte: startOfYear, lte: endOfYear };

  // Use shared helper — splits give us the user's personal share per expense
  const [trips, splits] = await Promise.all([
    prisma.trip.findMany({
      where: {
        members: { some: { userId } },
        startDate: { gte: startOfYear, lte: endOfYear },
      },
      select: { id: true, destination: true },
    }),
    getUserSplitExpenses(userId, dateFilter),
  ]);

  const totalSpent = splits.reduce((sum, s) => sum + s.amount, 0);

  const mostRecentTrip = await prisma.trip.findFirst({
    where: { members: { some: { userId } } },
    orderBy: { startDate: 'desc' },
    select: { budgetCurrency: true },
  });
  const currency = mostRecentTrip?.budgetCurrency || user.preferredCurrency || 'USD';

  const destinations = [...new Set(trips.map((t) => t.destination).filter(Boolean))] as string[];

  const categoryTotals: Record<string, number> = {};
  for (const s of splits) {
    const cat = s.expense.category;
    categoryTotals[cat] = (categoryTotals[cat] || 0) + s.amount;
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const monthlySpendingRaw: number[] = new Array(12).fill(0);
  for (const s of splits) {
    monthlySpendingRaw[s.expense.date.getMonth()] += s.amount;
  }

  const monthlySpending = monthlySpendingRaw.map((amount: number, idx: number) => ({
    month: monthNames[idx],
    amount: Math.round(amount * 100) / 100,
  }));

  const topCategory = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a)[0];

  res.json({
    success: true,
    data: {
      year,
      currency,
      totalSpent: Math.round(totalSpent * 100) / 100,
      totalTrips: trips.length,
      destinations,
      destinationCount: destinations.length,
      totalExpenses: splits.length,
      topCategory: topCategory ? topCategory[0] : 'N/A',
      topDestinations: destinations.map((d) => ({ destination: d, count: trips.filter((t) => t.destination === d).length })),
      categoryBreakdown: categoryTotals,
      monthlySpending,
      avgPerTrip: trips.length > 0 ? Math.round((totalSpent / trips.length) * 100) / 100 : 0,
    },
  });
});

/**
 * GET /api/analytics/category-trends
 * See category spending trends across trips (pivoted by category).
 */
export const categoryTrends = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id as string;

  const trips = await prisma.trip.findMany({
    where: { members: { some: { userId } } },
    include: {
      expenses: { select: { category: true, baseAmount: true } },
    },
    orderBy: { startDate: 'asc' },
    take: 10,
  });

  // Build: category → [ { month: tripName, amount } ]
  const categoryMap: Record<string, { month: string; amount: number }[]> = {};

  for (const trip of trips) {
    const categoryTotals: Record<string, number> = {};
    for (const e of (trip as any).expenses) {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.baseAmount;
    }

    for (const [category, amount] of Object.entries(categoryTotals)) {
      if (!categoryMap[category]) categoryMap[category] = [];
      categoryMap[category].push({
        month: (trip as any).name,
        amount: Math.round(amount * 100) / 100,
      });
    }
  }

  const trends = Object.entries(categoryMap).map(([category, months]) => ({
    category,
    months,
  }));

  res.json({ success: true, data: trends });
});

// ──────────────────────────────────────────────────────────────────────────────
// PERSONAL ANALYTICS
// ──────────────────────────────────────────────────────────────────────────────

type Period = 'week' | 'month' | 'quarter' | 'year' | 'custom';

function getPeriodWindow(period: Exclude<Period, 'custom'>, ref: Date): { start: Date; end: Date } {
  const d = new Date(ref);
  switch (period) {
    case 'week': {
      const day = d.getDay(); // 0=Sun
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((day + 6) % 7));
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      return { start: monday, end: sunday };
    }
    case 'month': {
      return {
        start: new Date(d.getFullYear(), d.getMonth(), 1),
        end:   new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999),
      };
    }
    case 'quarter': {
      const q = Math.floor(d.getMonth() / 3);
      return {
        start: new Date(d.getFullYear(), q * 3, 1),
        end:   new Date(d.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999),
      };
    }
    case 'year': {
      return {
        start: new Date(d.getFullYear(), 0, 1),
        end:   new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999),
      };
    }
  }
}

function shiftPeriodBack(period: Period, start: Date): Date {
  const d = new Date(start);
  switch (period) {
    case 'week':    d.setDate(d.getDate() - 7);    break;
    case 'month':   d.setMonth(d.getMonth() - 1);  break;
    case 'quarter': d.setMonth(d.getMonth() - 3);  break;
    case 'year':    d.setFullYear(d.getFullYear() - 1); break;
  }
  return d;
}

function buildTimeSeries(period: Period, start: Date, end: Date, expenses: { date: Date; baseAmount: number }[]) {
  const labels: string[] = [];
  const totals: Record<string, number> = {};

  if (period === 'week') {
    const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().split('T')[0];
      labels.push(DAY_NAMES[i]);
      totals[key] = 0;
    }
    for (const e of expenses) {
      const key = e.date.toISOString().split('T')[0];
      if (totals[key] !== undefined) totals[key] += e.baseAmount;
    }
    return labels.map((label, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return { label, amount: Math.round((totals[d.toISOString().split('T')[0]] || 0) * 100) / 100 };
    });
  }

  if (period === 'custom') {
    // A custom range can be any length, so per-day is the one granularity
    // that always makes sense (unlike week/month/quarter/year, which each
    // have a natural fixed bucket size).
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (cursor <= endDay) {
      totals[cursor.toISOString().split('T')[0]] = 0;
      cursor.setDate(cursor.getDate() + 1);
    }
    for (const e of expenses) {
      const key = e.date.toISOString().split('T')[0];
      if (totals[key] !== undefined) totals[key] += e.baseAmount;
    }
    return Object.entries(totals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => {
        const d = new Date(date);
        return { label: `${d.getDate()}/${d.getMonth() + 1}`, amount: Math.round(amount * 100) / 100 };
      });
  }

  if (period === 'month') {
    const daysInMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(start.getFullYear(), start.getMonth(), day);
      const key = d.toISOString().split('T')[0];
      totals[key] = 0;
    }
    for (const e of expenses) {
      const key = e.date.toISOString().split('T')[0];
      if (totals[key] !== undefined) totals[key] += e.baseAmount;
    }
    return Object.entries(totals).map(([date, amount]) => ({
      label: String(new Date(date).getDate()),
      amount: Math.round(amount * 100) / 100,
    }));
  }

  if (period === 'quarter') {
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    for (let m = 0; m < 3; m++) {
      const month = new Date(start.getFullYear(), start.getMonth() + m, 1);
      const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
      totals[key] = 0;
    }
    for (const e of expenses) {
      const key = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, '0')}`;
      if (totals[key] !== undefined) totals[key] += e.baseAmount;
    }
    return Object.entries(totals).map(([key, amount]) => {
      const [, m] = key.split('-');
      return { label: MONTH_NAMES[parseInt(m, 10) - 1], amount: Math.round(amount * 100) / 100 };
    });
  }

  // year
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  for (let m = 0; m < 12; m++) {
    totals[String(m)] = 0;
  }
  for (const e of expenses) {
    const key = String(e.date.getMonth());
    if (totals[key] !== undefined) totals[key] += e.baseAmount;
  }
  return MONTH_NAMES.map((label, i) => ({
    label,
    amount: Math.round((totals[String(i)] || 0) * 100) / 100,
  }));
}

/**
 * GET /api/analytics/personal?period=week|month|quarter|year&referenceDate=ISO
 * GET /api/analytics/personal?startDate=ISO&endDate=ISO   (custom range — takes priority over period)
 */
export const getPersonalAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id as string;
  const startDateParam = req.query.startDate as string | undefined;
  const endDateParam   = req.query.endDate   as string | undefined;
  const useCustomRange = !!(startDateParam && endDateParam);

  let start: Date, end: Date, prevStart: Date, prevEnd: Date;
  let period: Period;

  if (useCustomRange) {
    period = 'custom';
    start = new Date(startDateParam!);
    start.setHours(0, 0, 0, 0);
    end = new Date(endDateParam!);
    end.setHours(23, 59, 59, 999);
    if (start > end) throw AppError.badRequest('startDate must be before endDate');

    // "Previous period" for a custom range = an equal-length window
    // immediately before it, so the "vs Previous Period" comparison still
    // means something instead of being tied to a fixed week/month/etc.
    const rangeMs = end.getTime() - start.getTime();
    prevEnd = new Date(start.getTime() - 1);
    prevStart = new Date(prevEnd.getTime() - rangeMs);
  } else {
    const presetPeriod = (req.query.period as Exclude<Period, 'custom'>) || 'month';
    if (!['week', 'month', 'quarter', 'year'].includes(presetPeriod)) {
      throw AppError.badRequest('period must be week, month, quarter, or year');
    }
    period = presetPeriod;
    const ref = req.query.referenceDate ? new Date(req.query.referenceDate as string) : new Date();
    ({ start, end } = getPeriodWindow(presetPeriod, ref));
    prevStart = getPeriodWindow(presetPeriod, shiftPeriodBack(presetPeriod, start)).start;
    prevEnd   = new Date(start.getTime() - 1);
  }

  const [currentExpenses, previousExpenses, user] = await Promise.all([
    prisma.expense.findMany({ where: { tripId: null, paidById: userId, date: { gte: start, lte: end } } }),
    prisma.expense.findMany({ where: { tripId: null, paidById: userId, date: { gte: prevStart, lte: prevEnd } } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { preferredCurrency: true } }),
  ]);

  const totalSpent = currentExpenses.reduce((s, e) => s + e.baseAmount, 0);
  const previousTotal = previousExpenses.reduce((s, e) => s + e.baseAmount, 0);
  const daysDiff = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));

  // Category breakdown
  const catMap: Record<string, { total: number; count: number }> = {};
  for (const e of currentExpenses) {
    if (!catMap[e.category]) catMap[e.category] = { total: 0, count: 0 };
    catMap[e.category].total += e.baseAmount;
    catMap[e.category].count += 1;
  }
  const categoryBreakdown = Object.entries(catMap)
    .map(([category, { total, count }]) => ({
      category,
      total: Math.round(total * 100) / 100,
      count,
      percentage: totalSpent > 0 ? Math.round((total / totalSpent) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const topCategory = categoryBreakdown[0]?.category || 'MISCELLANEOUS';
  const changePercent = previousTotal > 0
    ? Math.round(((totalSpent - previousTotal) / previousTotal) * 1000) / 10
    : 0;

  res.json({
    success: true,
    data: {
      period,
      dateRange: { startDate: start.toISOString(), endDate: end.toISOString() },
      totalSpent: Math.round(totalSpent * 100) / 100,
      currency: user.preferredCurrency || 'USD',
      transactionCount: currentExpenses.length,
      avgPerDay: Math.round((totalSpent / daysDiff) * 100) / 100,
      topCategory,
      categoryBreakdown,
      timeSeriesData: buildTimeSeries(period, start, end, currentExpenses),
      comparisonToPrev: {
        previousTotal: Math.round(previousTotal * 100) / 100,
        changePercent,
        direction: totalSpent > previousTotal ? 'up' : totalSpent < previousTotal ? 'down' : 'same',
      },
    },
  });
});

/**
 * GET /api/analytics/group/:groupId?period=week|month|quarter|year&referenceDate=ISO
 */
export const getGroupAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const userId  = req.user!.id as string;
  const groupId = req.params.groupId as string;
  const period  = (req.query.period as Exclude<Period, 'custom'>) || 'month';
  const ref = req.query.referenceDate ? new Date(req.query.referenceDate as string) : new Date();

  if (!['week', 'month', 'quarter', 'year'].includes(period)) {
    throw AppError.badRequest('period must be week, month, quarter, or year');
  }

  // Verify membership
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!member) throw AppError.forbidden('You are not a member of this group');

  const { start, end } = getPeriodWindow(period, ref);
  const prevStart = getPeriodWindow(period, shiftPeriodBack(period, start)).start;
  const prevEnd   = new Date(start.getTime() - 1);

  const [currentExpenses, previousExpenses, groupMembers, group] = await Promise.all([
    prisma.expense.findMany({
      where: { groupId, tripId: null, date: { gte: start, lte: end } },
      include: {
        paidBy: { select: { id: true, name: true, avatarUrl: true } },
        splits: true,
      },
    }),
    prisma.expense.findMany({
      where: { groupId, tripId: null, date: { gte: prevStart, lte: prevEnd } },
    }),
    prisma.groupMember.findMany({
      where: { groupId: groupId as string },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    }),
    prisma.group.findUnique({ where: { id: groupId }, select: { defaultCurrency: true } }),
  ]);

  const totalSpent    = currentExpenses.reduce((s, e) => s + e.baseAmount, 0);
  const previousTotal = previousExpenses.reduce((s, e) => s + e.baseAmount, 0);
  const daysDiff      = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  const currency      = group?.defaultCurrency || 'USD';

  // Category breakdown
  const catMap: Record<string, { total: number; count: number }> = {};
  for (const e of currentExpenses) {
    if (!catMap[e.category]) catMap[e.category] = { total: 0, count: 0 };
    catMap[e.category].total += e.baseAmount;
    catMap[e.category].count += 1;
  }
  const categoryBreakdown = Object.entries(catMap)
    .map(([category, { total, count }]) => ({
      category,
      total: Math.round(total * 100) / 100,
      count,
      percentage: totalSpent > 0 ? Math.round((total / totalSpent) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const topCategory = categoryBreakdown[0]?.category || 'MISCELLANEOUS';

  // Per-member: totalPaid = expenses they paid, fairShare = equal share of total
  const memberCount   = groupMembers.length || 1;
  const fairShareEach = totalSpent / memberCount;

  const memberBreakdown = groupMembers.map((gm) => {
    const user = gm.user;
    const totalPaid = currentExpenses
      .filter((e) => e.paidById === user.id)
      .reduce((s, e) => s + e.baseAmount, 0);
    const balance = Math.round((totalPaid - fairShareEach) * 100) / 100;
    return {
      userId: user.id,
      name: user.name,
      avatarUrl: (user as { avatarUrl?: string | null }).avatarUrl ?? null,
      totalPaid: Math.round(totalPaid * 100) / 100,
      fairShare: Math.round(fairShareEach * 100) / 100,
      balance,
    };
  });

  const changePercent = previousTotal > 0
    ? Math.round(((totalSpent - previousTotal) / previousTotal) * 1000) / 10
    : 0;

  res.json({
    success: true,
    data: {
      period,
      totalSpent: Math.round(totalSpent * 100) / 100,
      currency,
      transactionCount: currentExpenses.length,
      avgPerDay: Math.round((totalSpent / daysDiff) * 100) / 100,
      topCategory,
      categoryBreakdown,
      timeSeriesData: buildTimeSeries(period, start, end, currentExpenses),
      memberBreakdown,
      comparisonToPrev: {
        previousTotal: Math.round(previousTotal * 100) / 100,
        changePercent,
        direction: totalSpent > previousTotal ? 'up' : totalSpent < previousTotal ? 'down' : 'same',
      },
    },
  });
});
