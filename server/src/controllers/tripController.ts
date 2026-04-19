import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { SubscriptionTier } from '@prisma/client';
import { PLAN_LIMITS } from '../config/plans';
import { asyncHandler, AppError, generateInviteCode, paginate, paginationMeta } from '../utils';
import { logActivity, logAudit } from '../services/auditService';
import { notifyUsers } from '../services/notificationService';

/**
 * POST /api/trips
 */
export const createTrip = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, destination, startDate, endDate, budget, budgetCurrency, groupId, isPublic } = req.body;

  const userId = req.user!.id as string;
  const tier = (req.user!.tier as SubscriptionTier) || 'FREE';
  const limits = PLAN_LIMITS[tier];

  const activeTrips = await prisma.trip.count({
    where: {
      members: { some: { userId } },
      status: { in: ['UPCOMING', 'ACTIVE'] },
    },
  });

  if (activeTrips >= limits.maxActiveTrips) {
    throw AppError.forbidden(
      `You have reached the maximum of ${limits.maxActiveTrips} active trips on the ${tier} plan. Please upgrade.`,
      'LIMIT_REACHED'
    );
  }

  if (groupId) {
    const isMember = await prisma.groupMember.findFirst({
      where: { groupId, userId },
    });
    if (!isMember) throw AppError.forbidden('You are not a member of this group');
  }

  const trip = await prisma.trip.create({
    data: {
      name,
      description,
      destination,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      budget,
      budgetCurrency: budgetCurrency || 'USD',
      groupId: groupId || null,
      isPublic: isPublic || false,
      inviteCode: generateInviteCode(),
      members: {
        create: { userId, role: 'ADMIN' },
      },
    },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
      group: { select: { id: true, name: true } },
    },
  });

  if (groupId) {
    const groupMembers = await prisma.groupMember.findMany({
      where: { groupId, userId: { not: userId } },
    });

    if (groupMembers.length > 0) {
      await prisma.tripMember.createMany({
        data: groupMembers.map((gm: any) => ({
          tripId: trip.id,
          userId: gm.userId,
          role: 'MEMBER' as const,
        })),
        skipDuplicates: true,
      });

      await notifyUsers(
        groupMembers.map((gm: any) => gm.userId),
        {
          type: 'TRIP_INVITE',
          title: 'New Trip Created',
          message: `You've been added to the trip "${name}"`,
          data: { tripId: trip.id },
        }
      );
    }
  }

  await logAudit({
    action: 'CREATE',
    entityType: 'trip',
    entityId: trip.id,
    userId,
    after: { name, destination, startDate, endDate, budget },
  });

  res.status(201).json({ success: true, data: trip });
});

/**
 * POST /api/trips/sync-statuses
 * Automatically update trip statuses based on current date:
 *   - startDate > now           → UPCOMING
 *   - startDate <= now <= endDate → ACTIVE
 *   - endDate < now             → COMPLETED
 * Only trips with UPCOMING / ACTIVE / COMPLETED status are touched
 * (ARCHIVED trips are left alone). Returns the number of trips updated.
 */
export const syncTripStatuses = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id as string;
  const now = new Date();

  // Fetch all trips the user is a member of that are not ARCHIVED
  const trips = await prisma.trip.findMany({
    where: {
      members: { some: { userId } },
      status: { in: ['UPCOMING', 'ACTIVE', 'COMPLETED'] },
    },
    select: { id: true, startDate: true, endDate: true, status: true },
  });

  // Determine what each status should be
  const updates: { id: string; newStatus: string }[] = [];

  for (const trip of trips) {
    let newStatus: string;
    if (now < trip.startDate) {
      newStatus = 'UPCOMING';
    } else if (now >= trip.startDate && now <= trip.endDate) {
      newStatus = 'ACTIVE';
    } else {
      newStatus = 'COMPLETED';
    }

    if (newStatus !== trip.status) {
      updates.push({ id: trip.id, newStatus });
    }
  }

  // Bulk update only the ones that actually changed
  if (updates.length > 0) {
    await Promise.all(
      updates.map((u) =>
        prisma.trip.update({
          where: { id: u.id },
          data: { status: u.newStatus as any },
        })
      )
    );
  }

  res.json({ success: true, data: { updated: updates.length } });
});

/**
 * GET /api/trips
 */
export const getTrips = asyncHandler(async (req: Request, res: Response) => {
  const page = req.query.page as string | undefined;
  const limit = req.query.limit as string | undefined;
  const status = req.query.status as string | undefined;
  const groupId = req.query.groupId as string | undefined;
  const userId = req.user!.id as string;
  const { take, skip } = paginate(page as any, limit as any);

  const where: any = {
    members: { some: { userId } },
  };
  if (status) where.status = status;
  if (groupId) where.groupId = groupId;

  const [trips, total] = await Promise.all([
    prisma.trip.findMany({
      where,
      include: {
        members: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
        group: { select: { id: true, name: true } },
        expenses: { select: { baseAmount: true } },
        _count: { select: { expenses: true, members: true } },
      },
      orderBy: { startDate: 'desc' },
      take,
      skip,
    }),
    prisma.trip.count({ where }),
  ]);

  // Compute totalSpent per trip and strip the raw expenses array
  const tripsWithTotals = trips.map((trip) => {
    const totalSpent = (trip as any).expenses.reduce((sum: number, e: any) => sum + e.baseAmount, 0);
    const { expenses, ...rest } = trip as any;
    return { ...rest, totalSpent: Math.round(totalSpent * 100) / 100 };
  });

  res.json({
    success: true,
    data: tripsWithTotals,
    pagination: paginationMeta(total, Number(page) || 1, Number(limit) || 20),
  });
});

/**
 * GET /api/trips/:id
 */
export const getTrip = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.id as string;
  const userId = req.user!.id as string;

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, preferredCurrency: true } } },
      },
      group: { select: { id: true, name: true } },
      expenses: {
        include: {
          paidBy: { select: { id: true, name: true, avatarUrl: true } },
          splits: { include: { user: { select: { id: true, name: true } } } },
          _count: { select: { comments: true, reactions: true } },
        },
        orderBy: { date: 'desc' },
      },
      _count: { select: { expenses: true, settlements: true, chatMessages: true } },
    },
  });

  if (!trip) throw AppError.notFound('Trip not found');

  const isMember = trip.members.some((m: any) => m.userId === userId);
  if (!isMember && !trip.isPublic) {
    throw AppError.forbidden('You are not a member of this trip');
  }

  const totalSpent = trip.expenses.reduce((sum: number, e: any) => sum + e.baseAmount, 0);

  res.json({
    success: true,
    data: {
      ...trip,
      totalSpent: Math.round(totalSpent * 100) / 100,
      remainingBudget: trip.budget ? Math.round((trip.budget - totalSpent) * 100) / 100 : null,
    },
  });
});

/**
 * GET /api/trips/:id/public
 */
export const getPublicTrip = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.id as string;

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
      expenses: {
        select: { title: true, amount: true, currency: true, category: true, date: true, baseAmount: true },
        orderBy: { date: 'desc' },
      },
    },
  });

  if (!trip || !trip.isPublic) {
    throw AppError.notFound('Trip not found or is not public');
  }

  const totalSpent = trip.expenses.reduce((sum: number, e: any) => sum + e.baseAmount, 0);

  res.json({
    success: true,
    data: {
      name: trip.name,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      status: trip.status,
      budget: trip.budget,
      totalSpent: Math.round(totalSpent * 100) / 100,
      memberCount: trip.members.length,
      expenses: trip.expenses,
    },
  });
});

/**
 * PUT /api/trips/:id
 */
export const updateTrip = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.id as string;
  const userId = req.user!.id as string;

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { members: true },
  });

  if (!trip) throw AppError.notFound('Trip not found');

  const membership = trip.members.find((m: any) => m.userId === userId);
  if (!membership || membership.role !== 'ADMIN') {
    throw AppError.forbidden('Only trip admins can update trip settings');
  }

  const updateData: any = { ...req.body };
  if (updateData.startDate) updateData.startDate = new Date(updateData.startDate);
  if (updateData.endDate) updateData.endDate = new Date(updateData.endDate);

  const updated = await prisma.trip.update({
    where: { id: tripId },
    data: updateData,
    include: {
      members: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });

  if (req.body.status && req.body.status !== trip.status) {
    const otherMembers = trip.members.filter((m: any) => m.userId !== userId);
    await notifyUsers(
      otherMembers.map((m: any) => m.userId),
      {
        type: 'TRIP_STATUS_CHANGED',
        title: 'Trip Status Updated',
        message: `"${trip.name}" is now ${req.body.status}`,
        data: { tripId: trip.id },
      }
    );

    await logActivity({
      action: `Trip status changed to ${req.body.status}`,
      type: 'UPDATE',
      entityType: 'trip',
      entityId: trip.id,
      userId,
      tripId: trip.id,
    });
  }

  res.json({ success: true, data: updated });
});

/**
 * DELETE /api/trips/:id
 */
export const deleteTrip = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.id as string;
  const userId = req.user!.id as string;

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { members: true },
  });

  if (!trip) throw AppError.notFound('Trip not found');

  const membership = trip.members.find((m: any) => m.userId === userId);
  if (!membership || membership.role !== 'ADMIN') {
    throw AppError.forbidden('Only trip admins can delete a trip');
  }

  await prisma.trip.delete({ where: { id: tripId } });

  res.json({ success: true, message: 'Trip deleted successfully' });
});

/**
 * POST /api/trips/:id/members
 */
export const addTripMember = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const tripId = req.params.id as string;
  const userId = req.user!.id as string;

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { members: true },
  });

  if (!trip) throw AppError.notFound('Trip not found');

  const isMember = trip.members.some((m: any) => m.userId === userId);
  if (!isMember) throw AppError.forbidden('You are not a member of this trip');

  const tier = (req.user!.tier as SubscriptionTier) || 'FREE';
  const limits = PLAN_LIMITS[tier];

  if (trip.members.length >= limits.maxMembersPerTrip) {
    throw AppError.forbidden(
      `Maximum ${limits.maxMembersPerTrip} members per trip on the ${tier} plan.`,
      'LIMIT_REACHED'
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw AppError.notFound('User not found');

  const alreadyMember = trip.members.some((m: any) => m.userId === user.id);
  if (alreadyMember) throw AppError.conflict('User is already a trip member');

  await prisma.tripMember.create({
    data: { tripId, userId: user.id, role: 'MEMBER' },
  });

  await notifyUsers([user.id], {
    type: 'TRIP_INVITE',
    title: 'Trip Invitation',
    message: `You've been invited to "${trip.name}"`,
    data: { tripId },
  });

  res.json({ success: true, message: 'Member added to trip' });
});

/**
 * POST /api/trips/join/:code
 */
export const joinTripByCode = asyncHandler(async (req: Request, res: Response) => {
  const code = req.params.code as string;
  const userId = req.user!.id as string;

  const trip = await prisma.trip.findUnique({
    where: { inviteCode: code },
    include: { members: true },
  });

  if (!trip) throw AppError.notFound('Invalid invite code');

  const alreadyMember = trip.members.some((m: any) => m.userId === userId);
  if (alreadyMember) throw AppError.conflict('You are already a member of this trip');

  await prisma.tripMember.create({
    data: { tripId: trip.id, userId, role: 'MEMBER' },
  });

  await logActivity({
    action: `${req.user!.name || 'Someone'} joined the trip`,
    type: 'JOIN',
    entityType: 'trip',
    entityId: trip.id,
    userId,
    tripId: trip.id,
  });

  res.json({ success: true, data: trip });
});
