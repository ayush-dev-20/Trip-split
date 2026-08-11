import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import * as aiService from '../services/aiService';

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

// ── GET /:tripId/packing-items ──
export const getPackingItems = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  await verifyTripMember(tripId, req.user!.id);

  const items = await prisma.packingItem.findMany({
    where: { tripId },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  });

  res.json({ success: true, data: items });
});

// ── POST /:tripId/packing-items ── add a single custom item
export const createPackingItem = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  await verifyTripMember(tripId, req.user!.id);

  const { name, category } = req.body as { name: string; category?: string };

  // Place new items at the end of their category
  const last = await prisma.packingItem.findFirst({
    where: { tripId, category: category ?? 'Other' },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });

  const item = await prisma.packingItem.create({
    data: {
      tripId,
      name,
      category: category ?? 'Other',
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  res.status(201).json({ success: true, data: item });
});

// ── POST /:tripId/packing-items/generate ──
// Generates an AI packing list from the trip's own data and persists it.
// Existing items are kept; only genuinely new item names are added, so
// regenerating never wipes out what the user has already ticked off.
export const generatePackingItems = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  await verifyTripMember(tripId, req.user!.id);

  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { members: true },
  });
  if (!trip) throw AppError.notFound('Trip not found');
  if (!trip.destination) throw AppError.badRequest('Trip has no destination set', 'NO_DESTINATION');

  const days = Math.max(1, Math.ceil(
    (trip.endDate.getTime() - trip.startDate.getTime()) / (1000 * 60 * 60 * 24)
  ));

  const result = await aiService.generatePackingList({
    destination: trip.destination,
    days,
    startDate: trip.startDate.toISOString().split('T')[0],
    travelers: trip.members.length,
  });

  const existing = await prisma.packingItem.findMany({
    where: { tripId },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((i) => i.name.trim().toLowerCase()));

  const toCreate: { tripId: string; name: string; category: string; sortOrder: number }[] = [];
  for (const cat of result.categories) {
    cat.items.forEach((name, i) => {
      if (existingNames.has(name.trim().toLowerCase())) return;
      existingNames.add(name.trim().toLowerCase());
      toCreate.push({ tripId, name, category: cat.name, sortOrder: i });
    });
  }

  if (toCreate.length > 0) {
    await prisma.packingItem.createMany({ data: toCreate });
  }

  const items = await prisma.packingItem.findMany({
    where: { tripId },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  });

  res.status(201).json({ success: true, data: items, added: toCreate.length });
});

// ── PATCH /:tripId/packing-items/:id ──
export const updatePackingItem = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const id = req.params.id as string;
  await verifyTripMember(tripId, req.user!.id);

  const existing = await prisma.packingItem.findFirst({ where: { id, tripId } });
  if (!existing) throw AppError.notFound('Packing item not found');

  const item = await prisma.packingItem.update({
    where: { id },
    data: req.body,
  });

  res.json({ success: true, data: item });
});

// ── DELETE /:tripId/packing-items/:id ──
export const deletePackingItem = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const id = req.params.id as string;
  await verifyTripMember(tripId, req.user!.id);

  const existing = await prisma.packingItem.findFirst({ where: { id, tripId } });
  if (!existing) throw AppError.notFound('Packing item not found');

  await prisma.packingItem.delete({ where: { id } });

  res.json({ success: true, message: 'Packing item deleted' });
});

// ── DELETE /:tripId/packing-items (all) ──
export const deleteAllPackingItems = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  await verifyTripMember(tripId, req.user!.id);

  const { count } = await prisma.packingItem.deleteMany({ where: { tripId } });

  res.json({ success: true, message: `Deleted ${count} packing item(s)` });
});
