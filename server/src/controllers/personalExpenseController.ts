import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler, AppError } from '../utils';
import { convertCurrency } from '../services/currencyService';
import { logActivity } from '../services/auditService';

/**
 * POST /api/personal-expenses
 */
export const createPersonalExpense = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id as string;
  const { title, description, amount, currency, category, date, isRecurring, recurringPattern } = req.body;

  const baseCurrency = currency || 'USD';
  const { convertedAmount: baseAmount, exchangeRate } = await convertCurrency(amount, baseCurrency, baseCurrency);

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
      splitType: 'EQUAL',
      isRecurring: isRecurring ?? false,
      recurringPattern,
      tripId: null,
      paidById: userId,
      splits: {
        create: [{ userId, amount: baseAmount }],
      },
    },
  });

  await logActivity({
    action: `Added personal expense "${title}"`,
    type: 'CREATE',
    entityType: 'expense',
    entityId: expense.id,
    userId,
  });

  res.status(201).json({ success: true, data: expense });
});

/**
 * GET /api/personal-expenses
 */
export const getPersonalExpenses = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id as string;
  const startDate = req.query.startDate as string | undefined;
  const endDate   = req.query.endDate   as string | undefined;
  const category  = req.query.category  as string | undefined;
  const search    = req.query.search    as string | undefined;
  const page      = (req.query.page  as string) || '1';
  const limit     = (req.query.limit as string) || '50';

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const where: Record<string, unknown> = { tripId: null, paidById: userId };
  if (startDate || endDate) {
    where.date = {
      ...(startDate ? { gte: new Date(startDate) } : {}),
      ...(endDate   ? { lte: new Date(endDate)   } : {}),
    };
  }
  if (category) where.category = category;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.expense.count({ where }),
  ]);

  res.json({
    success: true,
    data: expenses,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
  });
});

/**
 * GET /api/personal-expenses/calendar
 */
export const getPersonalExpensesByDay = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id as string;
  const { year, month } = req.query as Record<string, string>;

  if (!year || !month) throw AppError.badRequest('year and month are required');

  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const startDate = new Date(y, m - 1, 1);
  const endDate   = new Date(y, m, 0, 23, 59, 59, 999);

  const expenses = await prisma.expense.findMany({
    where: { tripId: null, paidById: userId, date: { gte: startDate, lte: endDate } },
    orderBy: { date: 'asc' },
  });

  // Group by calendar day
  const byDay: Record<string, { date: string; total: number; count: number; expenses: typeof expenses }> = {};
  for (const e of expenses) {
    const key = e.date.toISOString().split('T')[0];
    if (!byDay[key]) byDay[key] = { date: key, total: 0, count: 0, expenses: [] };
    byDay[key].total  += e.baseAmount;
    byDay[key].count  += 1;
    byDay[key].expenses.push(e);
  }

  res.json({ success: true, data: Object.values(byDay) });
});

/**
 * GET /api/personal-expenses/:id
 */
export const getPersonalExpenseById = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id as string;
  const id = req.params.id as string;

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense || expense.tripId !== null || expense.paidById !== userId) {
    throw AppError.notFound('Personal expense not found');
  }

  res.json({ success: true, data: expense });
});

/**
 * PUT /api/personal-expenses/:id
 */
export const updatePersonalExpense = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id as string;
  const id = req.params.id as string;

  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing || existing.tripId !== null || existing.paidById !== userId) {
    throw AppError.notFound('Personal expense not found');
  }

  const { title, description, amount, currency, category, date, isRecurring, recurringPattern } = req.body;

  let baseAmount = existing.baseAmount;
  let exchangeRate = existing.exchangeRate;
  const newCurrency = currency ?? existing.currency;
  const newAmount   = amount   ?? existing.amount;

  if (amount !== undefined || currency !== undefined) {
    const result = await convertCurrency(newAmount, newCurrency, newCurrency);
    baseAmount   = result.convertedAmount;
    exchangeRate = result.exchangeRate;
  }

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      ...(title       !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(amount      !== undefined && { amount: newAmount }),
      ...(currency    !== undefined && { currency: newCurrency }),
      exchangeRate,
      baseAmount,
      ...(category    !== undefined && { category }),
      ...(date        !== undefined && { date: new Date(date) }),
      ...(isRecurring !== undefined && { isRecurring }),
      ...(recurringPattern !== undefined && { recurringPattern }),
    },
  });

  // Keep the single ExpenseSplit in sync with the new baseAmount
  if (amount !== undefined || currency !== undefined) {
    await prisma.expenseSplit.updateMany({
      where: { expenseId: id },
      data: { amount: baseAmount },
    });
  }

  await logActivity({
    action: `Updated personal expense "${updated.title}"`,
    type: 'UPDATE',
    entityType: 'expense',
    entityId: id,
    userId,
  });

  res.json({ success: true, data: updated });
});

/**
 * DELETE /api/personal-expenses/:id
 */
export const deletePersonalExpense = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id as string;
  const id = req.params.id as string;

  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing || existing.tripId !== null || existing.paidById !== userId) {
    throw AppError.notFound('Personal expense not found');
  }

  await prisma.expense.delete({ where: { id } });

  await logActivity({
    action: `Deleted personal expense "${existing.title}"`,
    type: 'DELETE',
    entityType: 'expense',
    entityId: id,
    userId,
  });

  res.json({ success: true, message: 'Expense deleted' });
});

/**
 * GET /api/personal-expenses/recurring
 */
export const getRecurringExpenses = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const expenses = await prisma.expense.findMany({
    where: { paidById: userId, isRecurring: true, tripId: null },
    orderBy: [{ recurringPattern: 'asc' }, { title: 'asc' }],
  });

  res.json({ success: true, data: expenses });
});
