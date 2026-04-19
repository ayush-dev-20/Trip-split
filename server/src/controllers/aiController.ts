import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler, AppError } from '../utils';
import * as aiService from '../services/aiService';
import multer from 'multer';

// Multer config — store receipt files in memory for base64 conversion
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
export const uploadReceiptMiddleware = upload.single('receipt');

/**
 * POST /api/ai/scan-receipt
 * Accepts multipart form data with a "receipt" file.
 */
export const scanReceipt = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) throw AppError.badRequest('Receipt image file is required');

  const base64 = file.buffer.toString('base64');
  const mimeType = file.mimetype as 'image/jpeg' | 'image/png' | 'image/webp';

  const result = await aiService.scanReceipt(base64, mimeType);

  res.json({ success: true, data: result });
});

/**
 * POST /api/ai/categorize
 */
export const categorizeExpense = asyncHandler(async (req: Request, res: Response) => {
  const { title } = req.body;

  if (!title) throw AppError.badRequest('title is required');

  const category = await aiService.categorizeExpense(title);

  res.json({ success: true, data: { category } });
});

/**
 * POST /api/ai/budget-advisor
 */
export const budgetAdvisor = asyncHandler(async (req: Request, res: Response) => {
  const { destination, durationDays, groupSize, travelStyle } = req.body;

  if (!destination || !durationDays || !groupSize) {
    throw AppError.badRequest('destination, durationDays, and groupSize are required');
  }

  const result = await aiService.suggestTripBudget({
    destination,
    durationDays,
    groupSize,
    travelStyle,
  });

  res.json({ success: true, data: result });
});

/**
 * POST /api/ai/spending-insights/:tripId
 */
export const spendingInsights = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      members: { include: { user: { select: { id: true, name: true } } } },
      expenses: {
        include: { paidBy: { select: { name: true } } },
      },
    },
  });

  if (!trip) throw AppError.notFound('Trip not found');

  const totalSpent = trip.expenses.reduce((sum: number, e: any) => sum + e.baseAmount, 0);

  const categoryBreakdown: Record<string, number> = {};
  for (const e of trip.expenses) {
    categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.baseAmount;
  }

  const perUserSpending: Record<string, number> = {};
  for (const e of trip.expenses) {
    const name = (e as any).paidBy.name;
    perUserSpending[name] = (perUserSpending[name] || 0) + e.baseAmount;
  }

  const tripDays = Math.max(
    1,
    Math.ceil((trip.endDate.getTime() - trip.startDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  const insights = await aiService.generateSpendingInsights({
    tripName: trip.name,
    destination: trip.destination || 'Unknown',
    totalBudget: trip.budget,
    totalSpent,
    categoryBreakdown,
    perUserSpending: Object.entries(perUserSpending).map(([name, amount]) => ({ name, amount })),
    duration: tripDays,
  });

  res.json({ success: true, data: { insights } });
});

/**
 * POST /api/ai/trip-planner
 */
export const tripPlanner = asyncHandler(async (req: Request, res: Response) => {
  const { destination, days, budget, currency, travelers, interests } = req.body;

  if (!destination || !days || !budget || !currency || !travelers) {
    throw AppError.badRequest('destination, days, budget, currency, and travelers are required');
  }

  const result = await aiService.generateTripPlan({
    destination,
    days: Number(days),
    budget: Number(budget),
    currency: String(currency),
    travelers: Number(travelers),
    interests,
  });

  res.json({ success: true, data: result });
});

/**
 * POST /api/ai/trip-planner-for-trip
 * Generates itinerary + checkpoint suggestions from an existing trip's data.
 */
export const tripPlannerForTrip = asyncHandler(async (req: Request, res: Response) => {
  const { tripId } = req.body;
  const userId = req.user!.id as string;

  if (!tripId) throw AppError.badRequest('tripId is required');

  // Verify membership
  const member = await prisma.tripMember.findFirst({ where: { tripId, userId } });
  if (!member) throw AppError.forbidden('You are not a member of this trip');

  // Load trip data
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { members: true },
  });
  if (!trip) throw AppError.notFound('Trip not found');
  if (!trip.destination) throw AppError.badRequest('Trip has no destination set');

  const days = Math.max(1, Math.ceil((trip.endDate.getTime() - trip.startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const budget = trip.budget ?? 1000;
  const currency = trip.budgetCurrency;
  const travelers = trip.members.length;

  // Generate itinerary + checkpoint suggestions in parallel
  const [itineraryResult, suggestedCheckpoints] = await Promise.all([
    aiService.generateTripPlan({ destination: trip.destination, days, budget, currency, travelers }),
    aiService.generateCheckpointSuggestions({ destination: trip.destination, days, budget, currency, travelers }),
  ]);

  res.json({
    success: true,
    data: {
      itinerary: itineraryResult.itinerary,
      suggestedCheckpoints,
    },
  });
});

/**
 * POST /api/ai/trip-planner/stream
 * SSE — streams day-by-day itinerary markdown token by token.
 */
export const tripPlannerStream = async (req: Request, res: Response) => {
  const { destination, days, budget, currency, travelers, interests } = req.body;

  if (!destination || !days || !budget || !currency || !travelers) {
    res.status(400).json({ success: false, error: { message: 'destination, days, budget, currency, and travelers are required' } });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    await aiService.generateTripPlanStream(
      { destination, days: Number(days), budget: Number(budget), currency: String(currency), travelers: Number(travelers), interests },
      (text) => res.write(`data: ${JSON.stringify({ type: 'chunk', text })}\n\n`)
    );
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'chunk', text: '\n\nFailed to generate itinerary.' })}\n\n`);
  }

  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  res.end();
};

/**
 * POST /api/ai/trip-planner-for-trip/stream
 * SSE — streams itinerary markdown, then emits a "checkpoints" event with JSON suggestions.
 */
export const tripPlannerForTripStream = async (req: Request, res: Response) => {
  const { tripId } = req.body;
  const userId = req.user!.id as string;

  if (!tripId) {
    res.status(400).json({ success: false, error: { message: 'tripId is required' } });
    return;
  }

  const member = await prisma.tripMember.findFirst({ where: { tripId, userId } });
  if (!member) {
    res.status(403).json({ success: false, error: { message: 'You are not a member of this trip' } });
    return;
  }

  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { members: true } });
  if (!trip) {
    res.status(404).json({ success: false, error: { message: 'Trip not found' } });
    return;
  }
  if (!trip.destination) {
    res.status(400).json({ success: false, error: { message: 'Trip has no destination set' } });
    return;
  }

  const days = Math.max(1, Math.ceil((trip.endDate.getTime() - trip.startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const budget = trip.budget ?? 1000;
  const currency = trip.budgetCurrency;
  const travelers = trip.members.length;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Kick off checkpoint generation in parallel — it resolves after itinerary finishes streaming
  const checkpointsPromise = aiService.generateCheckpointSuggestions({ destination: trip.destination, days, budget, currency, travelers });

  try {
    await aiService.generateTripPlanStream(
      { destination: trip.destination, days, budget, currency, travelers },
      (text) => res.write(`data: ${JSON.stringify({ type: 'chunk', text })}\n\n`)
    );
  } catch {
    res.write(`data: ${JSON.stringify({ type: 'chunk', text: '\n\nFailed to generate itinerary.' })}\n\n`);
  }

  const checkpoints = await checkpointsPromise;
  res.write(`data: ${JSON.stringify({ type: 'checkpoints', data: checkpoints })}\n\n`);
  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  res.end();
};

/**
 * POST /api/ai/parse-expense
 */
export const parseNaturalLanguage = asyncHandler(async (req: Request, res: Response) => {
  const { text } = req.body;

  if (!text) throw AppError.badRequest('text is required');

  const parsed = await aiService.parseNaturalLanguageExpense(text);

  res.json({ success: true, data: parsed });
});

/**
 * POST /api/ai/chat
 */
export const chatbot = asyncHandler(async (req: Request, res: Response) => {
  const { message, tripId } = req.body;

  if (!message || !tripId) throw AppError.badRequest('message and tripId are required');

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      members: { include: { user: { select: { id: true, name: true } } } },
      expenses: {
        include: {
          paidBy: { select: { id: true, name: true } },
          splits: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
        orderBy: { date: 'desc' },
        take: 100,
      },
    },
  });

  if (!trip) throw AppError.notFound('Trip not found');

  const totalSpent = trip.expenses.reduce((sum: number, e: any) => sum + e.baseAmount, 0);

  // Build a member id→name lookup
  const memberNameMap: Record<string, string> = {};
  for (const m of trip.members) {
    memberNameMap[(m as any).userId] = (m as any).user.name;
  }

  // Pre-compute net balances using the contribution model (same as settlements)
  const { calculateNetBalances, simplifyDebts } = await import('../services/settlementService');
  const netBalances = calculateNetBalances(
    trip.expenses.map((e: any) => ({
      paidById: e.paidById,
      splitType: e.splitType,
      baseAmount: e.baseAmount,
      splits: e.splits.map((s: any) => ({ userId: s.userId, amount: s.amount })),
    }))
  );

  const debts = simplifyDebts(netBalances);

  // Build human-readable balance summary
  const balanceSummary = netBalances.map((b) => ({
    member: memberNameMap[b.userId] || b.userId,
    net: b.amount,
    status: b.amount > 0 ? 'is owed money' : b.amount < 0 ? 'owes money' : 'settled',
  }));

  const debtSummary = debts.map((d) => ({
    from: memberNameMap[d.from] || d.from,
    to: memberNameMap[d.to] || d.to,
    amount: d.amount,
  }));

  const answer = await aiService.chatWithExpenseData(message, {
    tripName: trip.name,
    destination: (trip as any).destination || 'Unknown',
    currency: trip.budgetCurrency || 'USD',
    expenses: trip.expenses.map((e: any) => ({
      title: e.title,
      amount: e.baseAmount,
      category: e.category,
      splitType: e.splitType,
      date: e.date.toISOString().split('T')[0],
      paidBy: e.paidBy.name,
      splits: e.splits.map((s: any) => ({
        member: s.user.name,
        contributed: e.splitType === 'EQUAL'
          ? (s.userId === e.paidById ? e.baseAmount : 0)
          : s.amount,
        fairShare: e.baseAmount / e.splits.length,
        percentage: s.percentage,
      })),
    })),
    members: trip.members.map((m: any) => m.user.name),
    totalSpent,
    budget: trip.budget,
    balanceSummary,
    debtSummary,
  });

  res.json({ success: true, data: { answer } });
});

/**
 * POST /api/ai/predict-cost
 */
export const predictCost = asyncHandler(async (req: Request, res: Response) => {
  const { destination, durationDays, groupSize } = req.body;
  const userId = req.user!.id as string;

  const pastTrips = await prisma.trip.findMany({
    where: {
      members: { some: { userId } },
      status: 'COMPLETED',
    },
    include: {
      expenses: { select: { baseAmount: true, category: true } },
      members: true,
    },
    orderBy: { endDate: 'desc' },
    take: 10,
  });

  const pastTripData = pastTrips.map((t: any) => {
    const totalSpent = t.expenses.reduce((sum: number, e: any) => sum + e.baseAmount, 0);
    const categoryBreakdown: Record<string, number> = {};
    for (const e of t.expenses) {
      categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.baseAmount;
    }
    return {
      destination: t.destination || 'Unknown',
      duration: Math.ceil((t.endDate.getTime() - t.startDate.getTime()) / (1000 * 60 * 60 * 24)),
      groupSize: t.members.length,
      totalSpent,
      categoryBreakdown,
    };
  });

  const prediction = await aiService.predictTripCost({
    destination,
    durationDays,
    groupSize,
    pastTrips: pastTripData,
  });

  res.json({ success: true, data: prediction });
});

/**
 * POST /api/ai/detect-anomaly
 */
export const detectAnomaly = asyncHandler(async (req: Request, res: Response) => {
  const { title, amount, category, tripId } = req.body;

  if (!title || !amount || !tripId) {
    throw AppError.badRequest('title, amount, and tripId are required');
  }

  // Get category average from the trip
  const categoryExpenses = await prisma.expense.aggregate({
    where: { tripId, category: category || 'MISCELLANEOUS' },
    _avg: { baseAmount: true },
  });

  const result = await aiService.detectAnomalies({
    currentExpense: { title, amount, category: category || 'MISCELLANEOUS' },
    categoryAverage: categoryExpenses._avg.baseAmount || amount,
    userAverage: amount,
    recentExpenses: [],
  });

  res.json({ success: true, data: result });
});
