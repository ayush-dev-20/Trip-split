import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler, AppError } from '../utils';
import { calculateNetBalances, simplifyDebts } from '../services/settlementService';

/**
 * GET /api/analytics/trip/:tripId
 * Comprehensive analytics for a single trip.
 */
export const getTripAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const userId = req.user!.id as string;

  // Verify membership
  const isMember = await prisma.tripMember.findFirst({
    where: { tripId, userId },
  });
  if (!isMember) throw AppError.forbidden('You are not a member of this trip');

  const trip = await prisma.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: { members: { include: { user: { select: { id: true, name: true } } } } },
  });

  const expenses = await prisma.expense.findMany({
    where: { tripId },
    include: {
      paidBy: { select: { id: true, name: true } },
      splits: true,
    },
    orderBy: { date: 'asc' },
  });

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
    Math.ceil((trip.endDate.getTime() - trip.startDate.getTime()) / (1000 * 60 * 60 * 24))
  );
  const avgDailySpend = totalSpent / tripDays;
  const daysElapsed = Math.max(1, Math.ceil(
    (Math.min(Date.now(), trip.endDate.getTime()) - trip.startDate.getTime()) /
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
      splits: e.splits.map((s: any) => ({ userId: s.userId, amount: s.amount })),
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
    currency: s.expense.trip.budgetCurrency,
    splitType: s.expense.splitType,
    paidBy: s.expense.paidBy,
    trip: { id: s.expense.trip.id, name: s.expense.trip.name },
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
