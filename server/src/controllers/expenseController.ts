import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { SplitType } from '@prisma/client';
import { asyncHandler, AppError, paginate, paginationMeta, roundCurrency } from '../utils';
import { convertCurrency } from '../services/currencyService';
import { logActivity, logAudit } from '../services/auditService';
import { notifyUsers } from '../services/notificationService';
import { detectAnomalies } from '../services/aiService';

/**
 * Calculate split amounts based on split type.
 *
 * IMPORTANT: split.amount always represents how much each person CONTRIBUTED
 * (i.e. actually paid) toward the expense — NOT what they owe.
 *
 * The settlement engine computes balances as:
 *   balance = sum of (contribution - fair_share) per expense
 *
 * EQUAL   — the payer contributed the full amount; everyone else contributed 0.
 * PERCENTAGE — each person's contribution = their % × total (must sum to 100%).
 * EXACT   — each person's contribution is entered directly (must sum to total).
 * SHARES  — each person's contribution is proportional to their share count.
 */
function calculateSplits(
  totalAmount: number,
  splitType: SplitType,
  members: string[],
  paidById: string,
  splits?: { userId: string; amount?: number; shares?: number; percentage?: number }[]
): { userId: string; amount: number; shares?: number; percentage?: number }[] {
  switch (splitType) {
    case 'EQUAL': {
      // Only the payer contributed; non-payers contributed 0.
      return members.map((userId) => ({
        userId,
        amount: userId === paidById ? roundCurrency(totalAmount) : 0,
      }));
    }

    case 'PERCENTAGE': {
      if (!splits) throw AppError.badRequest('Splits data required for percentage split');
      const totalPct = splits.reduce((sum: number, s) => sum + (s.percentage || 0), 0);
      if (Math.abs(totalPct - 100) > 0.01) {
        throw AppError.badRequest('Percentages must sum to 100');
      }
      // Verify the payer's percentage lines up with what they actually paid
      return splits.map((s) => ({
        userId: s.userId,
        amount: roundCurrency((totalAmount * (s.percentage || 0)) / 100),
        percentage: s.percentage,
      }));
    }

    case 'EXACT': {
      if (!splits) throw AppError.badRequest('Splits data required for exact split');
      const totalExact = splits.reduce((sum: number, s) => sum + (s.amount || 0), 0);
      if (Math.abs(totalExact - totalAmount) > 0.01) {
        throw AppError.badRequest('Exact amounts must sum to the total expense amount');
      }
      return splits.map((s) => ({
        userId: s.userId,
        amount: roundCurrency(s.amount || 0),
      }));
    }

    case 'SHARES': {
      if (!splits) throw AppError.badRequest('Splits data required for shares split');
      const totalShares = splits.reduce((sum: number, s) => sum + (s.shares || 1), 0);
      return splits.map((s) => ({
        userId: s.userId,
        amount: roundCurrency((totalAmount * (s.shares || 1)) / totalShares),
        shares: s.shares,
      }));
    }

    default:
      throw AppError.badRequest('Invalid split type');
  }
}

/**
 * POST /api/expenses
 */
export const createExpense = asyncHandler(async (req: Request, res: Response) => {
  const {
    title, description, amount, currency, category, date,
    splitType, tripId, paidById, isRecurring, recurringPattern, splits: splitData,
  } = req.body;
  const userId = req.user!.id as string;

  // Verify trip membership
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { members: true },
  });

  if (!trip) throw AppError.notFound('Trip not found');

  const isMember = trip.members.some((m: any) => m.userId === userId);
  if (!isMember) throw AppError.forbidden('You are not a member of this trip');

  // Convert currency to trip base currency
  const { convertedAmount, exchangeRate } = await convertCurrency(
    amount,
    currency || 'USD',
    trip.budgetCurrency
  );

  // Calculate splits
  const memberIds = splitData
    ? splitData.map((s: any) => s.userId)
    : trip.members.map((m: any) => m.userId);

  const calculatedSplits = calculateSplits(convertedAmount, splitType || 'EQUAL', memberIds, paidById, splitData);

  // Create expense with splits
  const expense = await prisma.expense.create({
    data: {
      title,
      description,
      amount,
      currency: currency || 'USD',
      exchangeRate,
      baseAmount: convertedAmount,
      category: category || 'MISCELLANEOUS',
      date: new Date(date),
      splitType: splitType || 'EQUAL',
      isRecurring: isRecurring || false,
      recurringPattern,
      tripId,
      paidById,
      splits: {
        create: calculatedSplits.map((s) => ({
          userId: s.userId,
          amount: s.amount,
          shares: s.shares,
          percentage: s.percentage,
        })),
      },
    },
    include: {
      paidBy: { select: { id: true, name: true, avatarUrl: true } },
      splits: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });

  // Audit
  await logAudit({
    action: 'CREATE',
    entityType: 'expense',
    entityId: expense.id,
    userId,
    after: { title, amount, currency, category, splitType },
  });

  // Activity log
  await logActivity({
    action: `${req.user!.name} added expense "${title}" ($${amount})`,
    type: 'CREATE',
    entityType: 'expense',
    entityId: expense.id,
    userId,
    tripId,
  });

  // Notify other trip members
  const otherMembers = trip.members.filter((m: any) => m.userId !== userId);
  await notifyUsers(
    otherMembers.map((m: any) => m.userId),
    {
      type: 'EXPENSE_ADDED',
      title: 'New Expense',
      message: `${req.user!.name} added "${title}" — $${amount}`,
      data: { tripId, expenseId: expense.id },
    }
  );

  // AI anomaly detection (async, non-blocking)
  try {
    const categoryExpenses = await prisma.expense.aggregate({
      where: { tripId, category: category || 'MISCELLANEOUS' },
      _avg: { baseAmount: true },
    });

    const anomaly = await detectAnomalies({
      currentExpense: { title, amount: convertedAmount, category },
      categoryAverage: categoryExpenses._avg.baseAmount || convertedAmount,
      userAverage: convertedAmount,
      recentExpenses: [],
    });

    if (anomaly.isAnomaly) {
      await notifyUsers([userId], {
        type: 'AI_INSIGHT',
        title: '⚠️ Unusual Expense Detected',
        message: anomaly.reason || 'This expense seems unusual compared to your spending pattern.',
        data: { expenseId: expense.id, severity: anomaly.severity },
      });
    }
  } catch (e) {
    console.error('Anomaly detection failed:', e);
  }

  res.status(201).json({ success: true, data: expense });
});

/**
 * GET /api/expenses?tripId=xxx
 */
export const getExpenses = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.query.tripId as string | undefined;
  const category = req.query.category as string | undefined;
  const page = req.query.page as string | undefined;
  const limit = req.query.limit as string | undefined;
  const userId = req.user!.id as string;
  const { take, skip } = paginate(page as any, limit as any);

  if (!tripId) throw AppError.badRequest('tripId is required');

  const isMember = await prisma.tripMember.findFirst({
    where: { tripId, userId },
  });
  if (!isMember) throw AppError.forbidden('You are not a member of this trip');

  const where: any = { tripId };
  if (category) where.category = category;

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: {
        paidBy: { select: { id: true, name: true, avatarUrl: true } },
        splits: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
        _count: { select: { comments: true, reactions: true } },
      },
      orderBy: { date: 'desc' },
      take,
      skip,
    }),
    prisma.expense.count({ where }),
  ]);

  res.json({
    success: true,
    data: expenses,
    pagination: paginationMeta(total, Number(page) || 1, Number(limit) || 20),
  });
});

/**
 * GET /api/expenses/:id
 */
export const getExpense = asyncHandler(async (req: Request, res: Response) => {
  const expenseId = req.params.id as string;

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      paidBy: { select: { id: true, name: true, avatarUrl: true } },
      splits: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
      comments: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: 'asc' },
      },
      reactions: {
        include: { user: { select: { id: true, name: true } } },
      },
      receipts: true,
    },
  });

  if (!expense) throw AppError.notFound('Expense not found');

  res.json({ success: true, data: expense });
});

/**
 * PUT /api/expenses/:id
 */
export const updateExpense = asyncHandler(async (req: Request, res: Response) => {
  const expenseId = req.params.id as string;
  const userId = req.user!.id as string;

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { trip: { include: { members: true } }, splits: true },
  });

  if (!expense) throw AppError.notFound('Expense not found');

  const isMember = expense.trip.members.some((m: any) => m.userId === userId);
  if (!isMember) throw AppError.forbidden('You are not a member of this trip');

  const before = {
    title: expense.title,
    amount: expense.amount,
    currency: expense.currency,
    category: expense.category,
  };

  const { splits: newSplits, ...updateData } = req.body;

  if (updateData.amount || updateData.currency) {
    const { convertedAmount, exchangeRate } = await convertCurrency(
      updateData.amount || expense.amount,
      updateData.currency || expense.currency,
      expense.trip.budgetCurrency
    );
    updateData.baseAmount = convertedAmount;
    updateData.exchangeRate = exchangeRate;
  }

  if (updateData.date) updateData.date = new Date(updateData.date);

  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data: updateData,
    include: {
      paidBy: { select: { id: true, name: true, avatarUrl: true } },
      splits: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  if (newSplits || updateData.splitType || updateData.amount) {
    await prisma.expenseSplit.deleteMany({ where: { expenseId: expense.id } });

    const memberIds = newSplits
      ? newSplits.map((s: any) => s.userId)
      : expense.trip.members.map((m: any) => m.userId);

    const calculatedSplits = calculateSplits(
      updated.baseAmount,
      updated.splitType,
      memberIds,
      updated.paidById,
      newSplits
    );

    await prisma.expenseSplit.createMany({
      data: calculatedSplits.map((s) => ({
        expenseId: expense.id,
        userId: s.userId,
        amount: s.amount,
        shares: s.shares,
        percentage: s.percentage,
      })),
    });
  }

  await logAudit({
    action: 'UPDATE',
    entityType: 'expense',
    entityId: expense.id,
    userId,
    before,
    after: updateData,
  });

  res.json({ success: true, data: updated });
});

/**
 * DELETE /api/expenses/:id
 */
export const deleteExpense = asyncHandler(async (req: Request, res: Response) => {
  const expenseId = req.params.id as string;
  const userId = req.user!.id as string;

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { trip: { include: { members: true } } },
  });

  if (!expense) throw AppError.notFound('Expense not found');

  const membership = expense.trip.members.find((m: any) => m.userId === userId);
  if (!membership) throw AppError.forbidden('You are not a member of this trip');

  if (expense.paidById !== userId && membership.role !== 'ADMIN') {
    throw AppError.forbidden('Only the payer or trip admin can delete this expense');
  }

  await logAudit({
    action: 'DELETE',
    entityType: 'expense',
    entityId: expense.id,
    userId,
    before: { title: expense.title, amount: expense.amount },
  });

  await prisma.expense.delete({ where: { id: expenseId } });

  await logActivity({
    action: `${req.user!.name} deleted expense "${expense.title}"`,
    type: 'DELETE',
    entityType: 'expense',
    entityId: expense.id,
    userId,
    tripId: expense.tripId,
  });

  res.json({ success: true, message: 'Expense deleted' });
});

// ──────────────────────────────────
// COMMENTS & REACTIONS
// ──────────────────────────────────

/**
 * POST /api/expenses/:id/comments
 */
export const addComment = asyncHandler(async (req: Request, res: Response) => {
  const { content, mentions } = req.body;
  const expenseId = req.params.id as string;
  const userId = req.user!.id as string;

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { trip: { include: { members: true } } },
  });

  if (!expense) throw AppError.notFound('Expense not found');

  const comment = await prisma.comment.create({
    data: {
      content,
      mentions: mentions || [],
      expenseId: expense.id,
      userId,
    },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });

  if (mentions?.length > 0) {
    await notifyUsers(mentions, {
      type: 'MENTION',
      title: 'You were mentioned',
      message: `${req.user!.name} mentioned you in a comment on "${expense.title}"`,
      data: { expenseId: expense.id, commentId: comment.id },
    });
  }

  res.status(201).json({ success: true, data: comment });
});

/**
 * POST /api/expenses/:id/reactions
 */
export const addReaction = asyncHandler(async (req: Request, res: Response) => {
  const { emoji } = req.body;
  const expenseId = req.params.id as string;
  const userId = req.user!.id as string;

  const existing = await prisma.reaction.findFirst({
    where: { expenseId, userId, emoji },
  });

  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
    res.json({ success: true, message: 'Reaction removed' });
    return;
  }

  const reaction = await prisma.reaction.create({
    data: {
      emoji,
      expenseId,
      userId,
    },
  });

  res.status(201).json({ success: true, data: reaction });
});

/**
 * POST /api/expenses/:id/receipts
 * Upload a receipt image URL and attach to an expense.
 */
export const uploadReceipt = asyncHandler(async (req: Request, res: Response) => {
  const expenseId = req.params.id as string;
  const userId = req.user!.id as string;
  const { imageUrl } = req.body;

  if (!imageUrl) throw AppError.badRequest('imageUrl is required');

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { trip: { include: { members: true } } },
  });

  if (!expense) throw AppError.notFound('Expense not found');

  const isMember = (expense as any).trip.members.some((m: any) => m.userId === userId);
  if (!isMember) throw AppError.forbidden('You are not a member of this trip');

  const receipt = await prisma.receipt.create({
    data: {
      expenseId,
      imageUrl,
    },
  });

  // Update expense receipt URL
  await prisma.expense.update({
    where: { id: expenseId },
    data: { receiptUrl: imageUrl },
  });

  res.status(201).json({ success: true, data: receipt });
});
