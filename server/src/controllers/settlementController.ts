import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler, AppError, paginate, paginationMeta } from '../utils';
import { buildBalanceSheet } from '../services/settlementService';
import { logActivity, logAudit } from '../services/auditService';
import { notifyUsers } from '../services/notificationService';
import { recordSettlementPlan, refreshSettlementPlan } from '../services/settlementPlanService';

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
      paidBy: { select: { id: true, name: true, avatarUrl: true, upiId: true } },
    },
  });

  const settlements = await prisma.settlement.findMany({
    where: { tripId, status: 'SETTLED' },
  });

  const { netBalances, simplifiedDebts } = buildBalanceSheet(
    expenses.map((e: any) => ({
      paidById: e.paidById,
      splitType: e.splitType,
      baseAmount: e.baseAmount,
      splits: e.splits.map((s: any) => ({ userId: s.userId, amount: s.amount, owedAmount: s.owedAmount })),
    })),
    settlements
  );

  // Who should pay next: the most negative settlement-adjusted balance.
  const debtorsRanked = netBalances
    .filter((b) => b.amount < -0.01)
    .sort((a, b) => a.amount - b.amount);
  const whoPaysNextBalance = debtorsRanked.length > 0 ? debtorsRanked[0] : null;

  const userIds = [...new Set(netBalances.map((b: any) => b.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, avatarUrl: true, upiId: true },
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
      whoPaysNext: whoPaysNextBalance
        ? { user: userMap.get(whoPaysNextBalance.userId), amount: whoPaysNextBalance.amount }
        : null,
      totalExpenses: expenses.length,
      totalSettled: settlements.length,
      currency: trip?.budgetCurrency || 'USD',
    },
  });
});

/**
 * GET /api/settlements/balances/group/:groupId
 * Get all balances and simplified debts for a group's direct (non-trip) expenses.
 */
export const getGroupBalances = asyncHandler(async (req: Request, res: Response) => {
  const groupId = req.params.groupId as string;
  const userId = req.user!.id as string;

  const isMember = await prisma.groupMember.findFirst({
    where: { groupId, userId },
  });
  if (!isMember) throw AppError.forbidden('You are not a member of this group');

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { defaultCurrency: true },
  });

  const expenses = await prisma.expense.findMany({
    where: { groupId, tripId: null },
    include: {
      splits: true,
      paidBy: { select: { id: true, name: true, avatarUrl: true, upiId: true } },
    },
  });

  const settlements = await prisma.settlement.findMany({
    where: { groupId, status: 'SETTLED' },
  });

  const { netBalances, simplifiedDebts } = buildBalanceSheet(
    expenses.map((e: any) => ({
      paidById: e.paidById,
      splitType: e.splitType,
      baseAmount: e.baseAmount,
      splits: e.splits.map((s: any) => ({ userId: s.userId, amount: s.amount, owedAmount: s.owedAmount })),
    })),
    settlements
  );

  // Who should pay next: the most negative settlement-adjusted balance.
  const debtorsRanked = netBalances
    .filter((b) => b.amount < -0.01)
    .sort((a, b) => a.amount - b.amount);
  const whoPaysNextBalance = debtorsRanked.length > 0 ? debtorsRanked[0] : null;

  const userIds = [...new Set(netBalances.map((b: any) => b.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, avatarUrl: true, upiId: true },
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
      whoPaysNext: whoPaysNextBalance
        ? { user: userMap.get(whoPaysNextBalance.userId), amount: whoPaysNextBalance.amount }
        : null,
      totalExpenses: expenses.length,
      totalSettled: settlements.length,
      currency: group?.defaultCurrency || 'USD',
    },
  });
});

/**
 * POST /api/settlements
 * Create a settlement record (mark as pending).
 */
export const createSettlement = asyncHandler(async (req: Request, res: Response) => {
  const { tripId, groupId, fromUserId, toUserId, amount, currency, note } = req.body;
  const userId = req.user!.id as string;

  let budgetCurrency: string | undefined;

  if (tripId) {
    const isMember = await prisma.tripMember.findFirst({
      where: { tripId, userId },
    });
    if (!isMember) throw AppError.forbidden('You are not a member of this trip');

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { budgetCurrency: true },
    });
    budgetCurrency = trip?.budgetCurrency;
  } else {
    const isMember = await prisma.groupMember.findFirst({
      where: { groupId, userId },
    });
    if (!isMember) throw AppError.forbidden('You are not a member of this group');
  }

  const settlement = await prisma.settlement.create({
    data: {
      tripId: tripId ?? undefined,
      groupId: groupId ?? undefined,
      fromUserId,
      toUserId,
      amount,
      currency: currency || budgetCurrency || 'USD',
      note,
      status: 'PENDING',
    },
    include: {
      fromUser: { select: { id: true, name: true, avatarUrl: true, upiId: true } },
      toUser: { select: { id: true, name: true, avatarUrl: true, upiId: true } },
    },
  });

  await notifyUsers(
    [fromUserId === userId ? toUserId : fromUserId],
    {
      type: 'SETTLEMENT_REQUEST',
      title: 'Settlement Request',
      message: `A settlement of $${amount} has been initiated`,
      data: { tripId, groupId, settlementId: settlement.id },
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

  const paidAmount = typeof req.body.amount === 'number' ? req.body.amount : settlement.amount;

  const updated = await prisma.settlement.update({
    where: { id: settlementId },
    data: {
      status: 'SETTLED',
      amount: paidAmount,
      settledAt: new Date(),
      note: req.body.note || settlement.note,
    },
    include: {
      fromUser: { select: { id: true, name: true, avatarUrl: true, upiId: true } },
      toUser: { select: { id: true, name: true, avatarUrl: true, upiId: true } },
    },
  });

  await logAudit({
    action: 'SETTLE',
    entityType: 'settlement',
    entityId: settlement.id,
    userId,
    after: { status: 'SETTLED', amount: updated.amount },
  });

  await logActivity({
    action: `${settlement.fromUser.name} settled $${updated.amount} with ${settlement.toUser.name}`,
    type: 'SETTLE',
    entityType: 'settlement',
    entityId: settlement.id,
    userId,
    tripId: settlement.tripId ?? undefined,
  });

  await notifyUsers(
    [settlement.fromUserId, settlement.toUserId].filter((id: string) => id !== userId),
    {
      type: 'SETTLEMENT_COMPLETED',
      title: 'Debt Settled ✅',
      message: `$${updated.amount} has been marked as settled`,
      data: { tripId: settlement.tripId, settlementId: settlement.id },
    }
  );

  await refreshSettlementPlan({
    tripId: settlement.tripId ?? undefined,
    groupId: settlement.groupId ?? undefined,
  });

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
        paidBy: { select: { id: true, name: true, avatarUrl: true, upiId: true } },
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
    select: { id: true, name: true, avatarUrl: true, upiId: true },
  });
  const userMap = new Map(participants.map((u: any) => [u.id, u]));

  // Process per-trip: calculate net balances and simplified debts, then filter to current user
  // Key: `${fromUserId}->${toUserId}` → aggregate amounts per counterpart
  const iOweMap = new Map<string, { user: { id: string; name: string; avatarUrl?: string; upiId?: string | null }; amount: number; trips: { id: string; name: string }[] }>();
  const owedToMeMap = new Map<string, { user: { id: string; name: string; avatarUrl?: string; upiId?: string | null }; amount: number; trips: { id: string; name: string }[] }>();

  for (const tripId of tripIds) {
    const tripExpenses = allExpenses.filter((e: any) => e.tripId === tripId);
    const tripSettlements = allSettlements.filter((s: any) => s.tripId === tripId);
    const trip = tripMap.get(tripId);

    if (tripExpenses.length === 0) continue;

    const { simplifiedDebts } = buildBalanceSheet(
      tripExpenses.map((e: any) => ({
        paidById: e.paidById,
        splitType: e.splitType,
        baseAmount: e.baseAmount,
        splits: e.splits.map((s: any) => ({ userId: s.userId, amount: s.amount, owedAmount: s.owedAmount })),
      })),
      tripSettlements
    );

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
  const groupId = req.query.groupId as string | undefined;
  const status = req.query.status as string | undefined;
  const page = req.query.page as string | undefined;
  const limit = req.query.limit as string | undefined;
  const userId = req.user!.id as string;
  const { take, skip } = paginate(page as any, limit as any);

  if (!tripId && !groupId) throw AppError.badRequest('Either tripId or groupId is required');
  if (tripId && groupId) throw AppError.badRequest('Provide only one of tripId or groupId');

  if (tripId) {
    const isMember = await prisma.tripMember.findFirst({ where: { tripId, userId } });
    if (!isMember) throw AppError.forbidden('You are not a member of this trip');
  } else {
    const isMember = await prisma.groupMember.findFirst({ where: { groupId: groupId!, userId } });
    if (!isMember) throw AppError.forbidden('You are not a member of this group');
  }

  const where: any = tripId ? { tripId } : { groupId };
  if (status) where.status = status;

  const [settlements, total] = await Promise.all([
    prisma.settlement.findMany({
      where,
      include: {
        fromUser: { select: { id: true, name: true, avatarUrl: true, upiId: true } },
        toUser: { select: { id: true, name: true, avatarUrl: true, upiId: true } },
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

/**
 * POST /api/settlements/settle-plan
 * Turn the current simplified-debt graph into PENDING settlements (replacing
 * any previously recorded plan for the scope).
 */
export const settlePlan = asyncHandler(async (req: Request, res: Response) => {
  const { tripId, groupId } = req.body as { tripId?: string; groupId?: string };
  const userId = req.user!.id as string;

  if (tripId) {
    const isMember = await prisma.tripMember.findFirst({ where: { tripId, userId } });
    if (!isMember) throw AppError.forbidden('You are not a member of this trip');
  } else {
    const isMember = await prisma.groupMember.findFirst({ where: { groupId: groupId!, userId } });
    if (!isMember) throw AppError.forbidden('You are not a member of this group');
  }

  const created = await recordSettlementPlan({ tripId, groupId });
  res.status(201).json({ success: true, data: created });
});
