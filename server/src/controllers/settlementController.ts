import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler, AppError, paginate, paginationMeta } from '../utils';
import { calculateNetBalances, simplifyDebts } from '../services/settlementService';
import { logActivity, logAudit } from '../services/auditService';
import { notifyUsers } from '../services/notificationService';

/**
 * GET /api/settlements/balances/:tripId
 * Get all balances and simplified debts for a trip.
 */
export const getTripBalances = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const userId = req.user!.id as string;

  const isMember = await prisma.tripMember.findFirst({
    where: { tripId, userId },
  });
  if (!isMember) throw AppError.forbidden('You are not a member of this trip');

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { budgetCurrency: true },
  });

  const expenses = await prisma.expense.findMany({
    where: { tripId },
    include: {
      splits: true,
      paidBy: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  const settlements = await prisma.settlement.findMany({
    where: { tripId, status: 'SETTLED' },
  });

  const netBalances = calculateNetBalances(
    expenses.map((e: any) => ({
      paidById: e.paidById,
      splitType: e.splitType,
      baseAmount: e.baseAmount,
      splits: e.splits.map((s: any) => ({ userId: s.userId, amount: s.amount })),
    }))
  );

  // Apply settled payments: fromUser paid toUser, so:
  //   fromUser contributed more → balance goes UP
  //   toUser received payment  → balance goes DOWN
  for (const settlement of settlements) {
    const fromIdx = netBalances.findIndex((b: any) => b.userId === settlement.fromUserId);
    const toIdx = netBalances.findIndex((b: any) => b.userId === settlement.toUserId);

    if (fromIdx !== -1) netBalances[fromIdx].amount = (netBalances[fromIdx].amount || 0) + settlement.amount;
    if (toIdx !== -1) netBalances[toIdx].amount = (netBalances[toIdx].amount || 0) - settlement.amount;
  }

  const simplifiedDebts = simplifyDebts(netBalances);

  const userIds = [...new Set(netBalances.map((b: any) => b.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, avatarUrl: true },
  });

  const userMap = new Map(users.map((u: any) => [u.id, u]));

  res.json({
    success: true,
    data: {
      balances: netBalances.map((b: any) => ({
        user: userMap.get(b.userId),
        amount: b.amount,
      })),
      simplifiedDebts: simplifiedDebts.map((d: any) => ({
        from: userMap.get(d.from),
        to: userMap.get(d.to),
        amount: d.amount,
      })),
      totalExpenses: expenses.length,
      totalSettled: settlements.length,
      currency: trip?.budgetCurrency || 'USD',
    },
  });
});

/**
 * POST /api/settlements
 * Create a settlement record (mark as pending).
 */
export const createSettlement = asyncHandler(async (req: Request, res: Response) => {
  const { tripId, fromUserId, toUserId, amount, currency, note } = req.body;
  const userId = req.user!.id as string;

  const isMember = await prisma.tripMember.findFirst({
    where: { tripId, userId },
  });
  if (!isMember) throw AppError.forbidden('You are not a member of this trip');

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { budgetCurrency: true },
  });

  const settlement = await prisma.settlement.create({
    data: {
      tripId,
      fromUserId,
      toUserId,
      amount,
      currency: currency || trip?.budgetCurrency || 'USD',
      note,
      status: 'PENDING',
    },
    include: {
      fromUser: { select: { id: true, name: true, avatarUrl: true } },
      toUser: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  await notifyUsers(
    [fromUserId === userId ? toUserId : fromUserId],
    {
      type: 'SETTLEMENT_REQUEST',
      title: 'Settlement Request',
      message: `A settlement of $${amount} has been initiated`,
      data: { tripId, settlementId: settlement.id },
    }
  );

  res.status(201).json({ success: true, data: settlement });
});

/**
 * PUT /api/settlements/:id/settle
 * Mark a settlement as settled.
 */
export const settleDebt = asyncHandler(async (req: Request, res: Response) => {
  const settlementId = req.params.id as string;
  const userId = req.user!.id as string;

  const settlement = await prisma.settlement.findUnique({
    where: { id: settlementId },
    include: {
      fromUser: { select: { id: true, name: true } },
      toUser: { select: { id: true, name: true } },
    },
  });

  if (!settlement) throw AppError.notFound('Settlement not found');

  if (settlement.fromUserId !== userId && settlement.toUserId !== userId) {
    throw AppError.forbidden('Only involved parties can settle this debt');
  }

  const updated = await prisma.settlement.update({
    where: { id: settlementId },
    data: {
      status: 'SETTLED',
      settledAt: new Date(),
      note: req.body.note || settlement.note,
    },
    include: {
      fromUser: { select: { id: true, name: true, avatarUrl: true } },
      toUser: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  await logAudit({
    action: 'SETTLE',
    entityType: 'settlement',
    entityId: settlement.id,
    userId,
    after: { status: 'SETTLED', amount: settlement.amount },
  });

  await logActivity({
    action: `${settlement.fromUser.name} settled $${settlement.amount} with ${settlement.toUser.name}`,
    type: 'SETTLE',
    entityType: 'settlement',
    entityId: settlement.id,
    userId,
    tripId: settlement.tripId,
  });

  await notifyUsers(
    [settlement.fromUserId, settlement.toUserId].filter((id: string) => id !== userId),
    {
      type: 'SETTLEMENT_COMPLETED',
      title: 'Debt Settled ✅',
      message: `$${settlement.amount} has been marked as settled`,
      data: { tripId: settlement.tripId, settlementId: settlement.id },
    }
  );

  res.json({ success: true, data: updated });
});

/**
 * GET /api/settlements/overall-balances
 * Aggregate "who owes me" / "I owe" across ALL trips the current user is a member of.
 */
export const getOverallBalances = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id as string;

  // Find all trips the user is a member of
  const tripMemberships = await prisma.tripMember.findMany({
    where: { userId },
    select: {
      tripId: true,
      trip: { select: { id: true, name: true, budgetCurrency: true } },
    },
  });

  const tripIds = tripMemberships.map((m: any) => m.tripId);
  const tripMap = new Map(tripMemberships.map((m: any) => [m.tripId, m.trip]));

  if (tripIds.length === 0) {
    return res.json({ success: true, data: { iOwe: [], owedToMe: [] } });
  }

  // Fetch all expenses and settled settlements for those trips
  const [allExpenses, allSettlements] = await Promise.all([
    prisma.expense.findMany({
      where: { tripId: { in: tripIds } },
      include: {
        splits: true,
        paidBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    prisma.settlement.findMany({
      where: { tripId: { in: tripIds }, status: 'SETTLED' },
    }),
  ]);

  // Collect all unique user IDs from expenses/splits so we can fetch their names
  const participantIds = new Set<string>();
  for (const expense of allExpenses) {
    participantIds.add(expense.paidById);
    for (const split of expense.splits) participantIds.add(split.userId);
  }

  const participants = await prisma.user.findMany({
    where: { id: { in: [...participantIds] } },
    select: { id: true, name: true, avatarUrl: true },
  });
  const userMap = new Map(participants.map((u: any) => [u.id, u]));

  // Process per-trip: calculate net balances and simplified debts, then filter to current user
  // Key: `${fromUserId}->${toUserId}` → aggregate amounts per counterpart
  const iOweMap = new Map<string, { user: { id: string; name: string; avatarUrl?: string }; amount: number; trips: { id: string; name: string }[] }>();
  const owedToMeMap = new Map<string, { user: { id: string; name: string; avatarUrl?: string }; amount: number; trips: { id: string; name: string }[] }>();

  for (const tripId of tripIds) {
    const tripExpenses = allExpenses.filter((e: any) => e.tripId === tripId);
    const tripSettlements = allSettlements.filter((s: any) => s.tripId === tripId);
    const trip = tripMap.get(tripId);

    if (tripExpenses.length === 0) continue;

    const netBalances = calculateNetBalances(
      tripExpenses.map((e: any) => ({
        paidById: e.paidById,
        splitType: e.splitType,
        baseAmount: e.baseAmount,
        splits: e.splits.map((s: any) => ({ userId: s.userId, amount: s.amount })),
      }))
    );

    // Apply settled payments
    for (const settlement of tripSettlements) {
      const fromIdx = netBalances.findIndex((b: any) => b.userId === settlement.fromUserId);
      const toIdx = netBalances.findIndex((b: any) => b.userId === settlement.toUserId);
      if (fromIdx !== -1) netBalances[fromIdx].amount = (netBalances[fromIdx].amount || 0) + settlement.amount;
      if (toIdx !== -1) netBalances[toIdx].amount = (netBalances[toIdx].amount || 0) - settlement.amount;
    }

    const simplifiedDebts = simplifyDebts(netBalances);

    for (const debt of simplifiedDebts) {
      if (debt.from === userId) {
        // Current user owes someone
        const existing = iOweMap.get(debt.to);
        if (existing) {
          existing.amount = Math.round((existing.amount + debt.amount) * 100) / 100;
          if (trip && !existing.trips.find((t: any) => t.id === trip.id)) existing.trips.push({ id: trip.id, name: trip.name });
        } else {
          iOweMap.set(debt.to, {
            user: userMap.get(debt.to) || { id: debt.to, name: 'Unknown' },
            amount: Math.round(debt.amount * 100) / 100,
            trips: trip ? [{ id: trip.id, name: trip.name }] : [],
          });
        }
      } else if (debt.to === userId) {
        // Someone owes the current user
        const existing = owedToMeMap.get(debt.from);
        if (existing) {
          existing.amount = Math.round((existing.amount + debt.amount) * 100) / 100;
          if (trip && !existing.trips.find((t: any) => t.id === trip.id)) existing.trips.push({ id: trip.id, name: trip.name });
        } else {
          owedToMeMap.set(debt.from, {
            user: userMap.get(debt.from) || { id: debt.from, name: 'Unknown' },
            amount: Math.round(debt.amount * 100) / 100,
            trips: trip ? [{ id: trip.id, name: trip.name }] : [],
          });
        }
      }
    }
  }

  res.json({
    success: true,
    data: {
      iOwe: [...iOweMap.values()].sort((a, b) => b.amount - a.amount),
      owedToMe: [...owedToMeMap.values()].sort((a, b) => b.amount - a.amount),
    },
  });
});

/**
 * GET /api/settlements?tripId=xxx
 */
export const getSettlements = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.query.tripId as string | undefined;
  const status = req.query.status as string | undefined;
  const page = req.query.page as string | undefined;
  const limit = req.query.limit as string | undefined;
  const { take, skip } = paginate(page as any, limit as any);

  if (!tripId) throw AppError.badRequest('tripId is required');

  const where: any = { tripId };
  if (status) where.status = status;

  const [settlements, total] = await Promise.all([
    prisma.settlement.findMany({
      where,
      include: {
        fromUser: { select: { id: true, name: true, avatarUrl: true } },
        toUser: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.settlement.count({ where }),
  ]);

  res.json({
    success: true,
    data: settlements,
    pagination: paginationMeta(total, Number(page) || 1, Number(limit) || 20),
  });
});
