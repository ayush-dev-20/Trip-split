import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

// ── Helper: verify user is a trip member ──
async function verifyTripMember(tripId: string, userId: string) {
  const member = await prisma.tripMember.findFirst({
    where: { tripId, userId },
  });
  if (!member) {
    throw AppError.forbidden('You are not a member of this trip');
  }
  return member;
}

// ── GET /:tripId/checkpoints ──
export const getCheckpoints = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  await verifyTripMember(tripId, req.user!.id);

  const checkpoints = await prisma.checkpoint.findMany({
    where: { tripId },
    orderBy: [{ day: 'asc' }, { sortOrder: 'asc' }],
  });

  res.json({ success: true, data: checkpoints });
});

// ── POST /:tripId/checkpoints ──
export const createCheckpoint = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  await verifyTripMember(tripId, req.user!.id);

  const { title, description, category, estimatedCost, day, sortOrder } = req.body;

  const checkpoint = await prisma.checkpoint.create({
    data: {
      tripId,
      title,
      description,
      category,
      estimatedCost,
      day,
      sortOrder: sortOrder ?? 0,
    },
  });

  res.status(201).json({ success: true, data: checkpoint });
});

// ── POST /:tripId/checkpoints/bulk ──
export const createCheckpointsBulk = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  await verifyTripMember(tripId, req.user!.id);

  const { checkpoints } = req.body as {
    checkpoints: Array<{
      title: string;
      description?: string;
      category?: string;
      estimatedCost?: number;
      day?: number;
      sortOrder?: number;
    }>;
  };

  const created = await prisma.checkpoint.createMany({
    data: checkpoints.map((cp, i) => ({
      tripId,
      title: cp.title,
      description: cp.description,
      category: cp.category,
      estimatedCost: cp.estimatedCost,
      day: cp.day,
      sortOrder: cp.sortOrder ?? i,
    })),
  });

  // Return the newly created checkpoints
  const allCheckpoints = await prisma.checkpoint.findMany({
    where: { tripId },
    orderBy: [{ day: 'asc' }, { sortOrder: 'asc' }],
  });

  res.status(201).json({ success: true, data: allCheckpoints, count: created.count });
});

// ── PATCH /:tripId/checkpoints/:id ──
export const updateCheckpoint = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const id = req.params.id as string;
  await verifyTripMember(tripId, req.user!.id);

  const existing = await prisma.checkpoint.findFirst({ where: { id, tripId } });
  if (!existing) throw AppError.notFound('Checkpoint not found');

  const checkpoint = await prisma.checkpoint.update({
    where: { id },
    data: req.body,
  });

  res.json({ success: true, data: checkpoint });
});

// ── DELETE /:tripId/checkpoints/:id ──
export const deleteCheckpoint = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const id = req.params.id as string;
  await verifyTripMember(tripId, req.user!.id);

  const existing = await prisma.checkpoint.findFirst({ where: { id, tripId } });
  if (!existing) throw AppError.notFound('Checkpoint not found');

  await prisma.checkpoint.delete({ where: { id } });

  res.json({ success: true, message: 'Checkpoint deleted' });
});

// ── DELETE /:tripId/checkpoints (all) ──
export const deleteAllCheckpoints = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  await verifyTripMember(tripId, req.user!.id);

  const { count } = await prisma.checkpoint.deleteMany({ where: { tripId } });

  res.json({ success: true, message: `Deleted ${count} checkpoint(s)` });
});

// ── DELETE /:tripId/checkpoints/day/:day ──
export const deleteDayCheckpoints = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const day = parseInt(req.params.day as string, 10);
  await verifyTripMember(tripId, req.user!.id);

  if (isNaN(day)) throw AppError.badRequest('Invalid day number');

  const { count } = await prisma.checkpoint.deleteMany({ where: { tripId, day } });

  res.json({ success: true, message: `Deleted ${count} checkpoint(s) for day ${day}` });
});

// ── PUT /:tripId/checkpoints/reorder ──
export const reorderCheckpoints = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  await verifyTripMember(tripId, req.user!.id);

  const { order } = req.body as { order: Array<{ id: string; sortOrder: number }> };

  await prisma.$transaction(
    order.map((item) =>
      prisma.checkpoint.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      })
    )
  );

  const checkpoints = await prisma.checkpoint.findMany({
    where: { tripId },
    orderBy: [{ day: 'asc' }, { sortOrder: 'asc' }],
  });

  res.json({ success: true, data: checkpoints });
});
