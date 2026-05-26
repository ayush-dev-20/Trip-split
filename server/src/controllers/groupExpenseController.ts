import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler, AppError } from '../utils';
import { convertCurrency } from '../services/currencyService';
import { logActivity } from '../services/auditService';
import { io } from '../index';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function assertGroupMember(groupId: string, userId: string) {
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!member) throw AppError.forbidden('You are not a member of this group');
  return member;
}

async function getGroupMembers(groupId: string): Promise<string[]> {
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

function buildEqualSplits(memberIds: string[], baseAmount: number) {
  const share = baseAmount / memberIds.length;
  return memberIds.map((userId) => ({ userId, amount: share }));
}

// ── GET /api/groups/:groupId/expenses ────────────────────────────────────────

export const getGroupExpenses = asyncHandler(async (req: Request, res: Response) => {
  const userId  = req.user!.id as string;
  const groupId = req.params.groupId as string;

  await assertGroupMember(groupId, userId);

  const startDate = req.query.startDate as string | undefined;
  const endDate   = req.query.endDate   as string | undefined;
  const category  = req.query.category  as string | undefined;
  const page      = parseInt((req.query.page  as string) || '1', 10);
  const limit     = Math.min(100, parseInt((req.query.limit as string) || '50', 10));
  const skip      = (Math.max(1, page) - 1) * limit;

  const where: Record<string, unknown> = { groupId, tripId: null };
  if (startDate || endDate) {
    where.date = {
      ...(startDate ? { gte: new Date(startDate) } : {}),
      ...(endDate   ? { lte: new Date(endDate)   } : {}),
    };
  }
  if (category) where.category = category;

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      skip,
      take: limit,
      include: {
        paidBy: { select: { id: true, name: true, avatarUrl: true } },
        splits: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
    }),
    prisma.expense.count({ where }),
  ]);

  res.json({
    success: true,
    data: expenses,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// ── GET /api/groups/:groupId/expenses/calendar ────────────────────────────────

export const getGroupExpensesByDay = asyncHandler(async (req: Request, res: Response) => {
  const userId  = req.user!.id as string;
  const groupId = req.params.groupId as string;

  await assertGroupMember(groupId, userId);

  const { year, month } = req.query as Record<string, string>;
  if (!year || !month) throw AppError.badRequest('year and month are required');

  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const startDate = new Date(y, m - 1, 1);
  const endDate   = new Date(y, m, 0, 23, 59, 59, 999);

  const expenses = await prisma.expense.findMany({
    where: { groupId, tripId: null, date: { gte: startDate, lte: endDate } },
    orderBy: { date: 'asc' },
    include: {
      paidBy: { select: { id: true, name: true, avatarUrl: true } },
      splits: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });

  const byDay: Record<string, { date: string; total: number; count: number; expenses: typeof expenses }> = {};
  for (const e of expenses) {
    const key = e.date.toISOString().split('T')[0];
    if (!byDay[key]) byDay[key] = { date: key, total: 0, count: 0, expenses: [] };
    byDay[key].total += e.baseAmount;
    byDay[key].count += 1;
    byDay[key].expenses.push(e);
  }

  res.json({ success: true, data: Object.values(byDay) });
});

// ── POST /api/groups/:groupId/expenses ───────────────────────────────────────

export const createGroupExpense = asyncHandler(async (req: Request, res: Response) => {
  const userId  = req.user!.id as string;
  const groupId = req.params.groupId as string;

  await assertGroupMember(groupId, userId);

  const {
    title, description, amount, currency, category, date,
    splitType, splits: rawSplits, paidById,
    isRecurring, recurringPattern,
  } = req.body;

  const baseCurrency = currency || 'USD';
  const payerId = paidById || userId;

  // Verify payer is a member
  await assertGroupMember(groupId, payerId);

  const { convertedAmount: baseAmount, exchangeRate } = await convertCurrency(amount, baseCurrency, baseCurrency);

  // Build splits: use provided splits or default to EQUAL among all members
  let splitData: { userId: string; amount: number; percentage?: number; shares?: number }[];

  if (rawSplits && rawSplits.length > 0) {
    if (splitType === 'EQUAL') {
      const share = baseAmount / rawSplits.length;
      splitData = rawSplits.map((s: { userId: string }) => ({ userId: s.userId, amount: share }));
    } else if (splitType === 'PERCENTAGE') {
      splitData = rawSplits.map((s: { userId: string; percentage: number }) => ({
        userId: s.userId,
        percentage: s.percentage,
        amount: (s.percentage / 100) * baseAmount,
      }));
    } else if (splitType === 'EXACT') {
      splitData = rawSplits.map((s: { userId: string; amount: number }) => ({
        userId: s.userId,
        amount: s.amount,
      }));
    } else {
      // SHARES
      const totalShares = rawSplits.reduce((sum: number, s: { shares: number }) => sum + s.shares, 0);
      splitData = rawSplits.map((s: { userId: string; shares: number }) => ({
        userId: s.userId,
        shares: s.shares,
        amount: (s.shares / totalShares) * baseAmount,
      }));
    }
  } else {
    // Default: equal split among all group members
    const memberIds = await getGroupMembers(groupId);
    splitData = buildEqualSplits(memberIds, baseAmount);
  }

  const expense = await prisma.expense.create({
    data: {
      title,
      description,
      amount,
      currency: baseCurrency,
      exchangeRate,
      baseAmount,
      category: category || 'MISCELLANEOUS',
      date: new Date(date),
      splitType: splitType || 'EQUAL',
      isRecurring: isRecurring ?? false,
      recurringPattern,
      tripId: null,
      groupId,
      paidById: payerId,
      splits: { create: splitData },
    },
    include: {
      paidBy: { select: { id: true, name: true, avatarUrl: true } },
      splits: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });

  await logActivity({
    action: `Added group expense "${title}" in group ${groupId}`,
    type: 'CREATE',
    entityType: 'expense',
    entityId: expense.id,
    userId,
  });

  io.to(`group:${groupId}`).emit('group-expense:created', { expense, groupId });

  res.status(201).json({ success: true, data: expense });
});

// ── GET /api/groups/:groupId/expenses/:id ────────────────────────────────────

export const getGroupExpenseById = asyncHandler(async (req: Request, res: Response) => {
  const userId  = req.user!.id as string;
  const groupId = req.params.groupId as string;
  const id      = req.params.id as string;

  await assertGroupMember(groupId, userId);

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: {
      paidBy: { select: { id: true, name: true, avatarUrl: true } },
      splits: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });

  if (!expense || expense.groupId !== groupId || expense.tripId !== null) {
    throw AppError.notFound('Group expense not found');
  }

  res.json({ success: true, data: expense });
});

// ── PUT /api/groups/:groupId/expenses/:id ────────────────────────────────────

export const updateGroupExpense = asyncHandler(async (req: Request, res: Response) => {
  const userId  = req.user!.id as string;
  const groupId = req.params.groupId as string;
  const id      = req.params.id as string;

  await assertGroupMember(groupId, userId);

  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing || existing.groupId !== groupId || existing.tripId !== null) {
    throw AppError.notFound('Group expense not found');
  }

  const {
    title, description, amount, currency, category, date,
    splitType, splits: rawSplits, paidById,
    isRecurring, recurringPattern,
  } = req.body;

  let baseAmount   = existing.baseAmount;
  let exchangeRate = existing.exchangeRate;
  const newCurrency = currency ?? existing.currency;
  const newAmount   = amount   ?? existing.amount;

  if (amount !== undefined || currency !== undefined) {
    const result = await convertCurrency(newAmount, newCurrency, newCurrency);
    baseAmount   = result.convertedAmount;
    exchangeRate = result.exchangeRate;
  }

  const newSplitType = splitType ?? existing.splitType;

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      ...(title        !== undefined && { title }),
      ...(description  !== undefined && { description }),
      ...(amount       !== undefined && { amount: newAmount }),
      ...(currency     !== undefined && { currency: newCurrency }),
      exchangeRate,
      baseAmount,
      ...(category     !== undefined && { category }),
      ...(date         !== undefined && { date: new Date(date) }),
      ...(splitType    !== undefined && { splitType }),
      ...(paidById     !== undefined && { paidById }),
      ...(isRecurring  !== undefined && { isRecurring }),
      ...(recurringPattern !== undefined && { recurringPattern }),
    },
    include: {
      paidBy: { select: { id: true, name: true, avatarUrl: true } },
      splits: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });

  // Recalculate splits when amount/currency/splitType/splits change
  if (amount !== undefined || currency !== undefined || splitType !== undefined || rawSplits) {
    await prisma.expenseSplit.deleteMany({ where: { expenseId: id } });

    let splitData: { userId: string; amount: number; percentage?: number; shares?: number }[];

    if (rawSplits && rawSplits.length > 0) {
      if (newSplitType === 'EQUAL') {
        const share = baseAmount / rawSplits.length;
        splitData = rawSplits.map((s: { userId: string }) => ({ userId: s.userId, amount: share }));
      } else if (newSplitType === 'PERCENTAGE') {
        splitData = rawSplits.map((s: { userId: string; percentage: number }) => ({
          userId: s.userId, percentage: s.percentage, amount: (s.percentage / 100) * baseAmount,
        }));
      } else if (newSplitType === 'EXACT') {
        splitData = rawSplits.map((s: { userId: string; amount: number }) => ({ userId: s.userId, amount: s.amount }));
      } else {
        const totalShares = rawSplits.reduce((sum: number, s: { shares: number }) => sum + s.shares, 0);
        splitData = rawSplits.map((s: { userId: string; shares: number }) => ({
          userId: s.userId, shares: s.shares, amount: (s.shares / totalShares) * baseAmount,
        }));
      }
    } else {
      const memberIds = await getGroupMembers(groupId);
      splitData = buildEqualSplits(memberIds, baseAmount);
    }

    await prisma.expenseSplit.createMany({
      data: splitData.map((s) => ({ expenseId: id, ...s })),
    });
  }

  await logActivity({
    action: `Updated group expense "${updated.title}"`,
    type: 'UPDATE',
    entityType: 'expense',
    entityId: id,
    userId,
  });

  io.to(`group:${groupId}`).emit('group-expense:updated', { expense: updated, groupId });

  res.json({ success: true, data: updated });
});

// ── DELETE /api/groups/:groupId/expenses/:id ─────────────────────────────────

export const deleteGroupExpense = asyncHandler(async (req: Request, res: Response) => {
  const userId  = req.user!.id as string;
  const groupId = req.params.groupId as string;
  const id      = req.params.id as string;

  await assertGroupMember(groupId, userId);

  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing || existing.groupId !== groupId || existing.tripId !== null) {
    throw AppError.notFound('Group expense not found');
  }

  await prisma.expense.delete({ where: { id } });

  await logActivity({
    action: `Deleted group expense "${existing.title}"`,
    type: 'DELETE',
    entityType: 'expense',
    entityId: id,
    userId,
  });

  io.to(`group:${groupId}`).emit('group-expense:deleted', { expenseId: id, groupId });

  res.json({ success: true, message: 'Expense deleted' });
});
