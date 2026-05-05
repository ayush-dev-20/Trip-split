import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

async function verifyTripMember(tripId: string, userId: string) {
  const member = await prisma.tripMember.findFirst({ where: { tripId, userId } });
  if (!member) throw AppError.forbidden('You are not a member of this trip');
  return member;
}

const userSelect = { select: { id: true, name: true, avatarUrl: true } };

// GET /:tripId/notes
export const getNotes = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params['tripId'] as string;
  await verifyTripMember(tripId, req.user!.id);

  const notes = await prisma.tripNote.findMany({
    where: { tripId },
    include: { user: userSelect },
    orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
  });

  res.json({ success: true, data: notes });
});

// POST /:tripId/notes
export const createNote = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params['tripId'] as string;
  await verifyTripMember(tripId, req.user!.id);

  const { title, content } = req.body as { title: string; content?: string };

  const note = await prisma.tripNote.create({
    data: { tripId, userId: req.user!.id, title, content: content ?? '' },
    include: { user: userSelect },
  });

  res.status(201).json({ success: true, data: note });
});

// PATCH /:tripId/notes/:noteId
export const updateNote = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params['tripId'] as string;
  const noteId = req.params['noteId'] as string;
  await verifyTripMember(tripId, req.user!.id);

  const existing = await prisma.tripNote.findFirst({ where: { id: noteId, tripId } });
  if (!existing) throw AppError.notFound('Note not found');
  if (existing.userId !== req.user!.id) throw AppError.forbidden('You can only edit your own notes');

  const { title, content } = req.body as { title?: string; content?: string };

  const note = await prisma.tripNote.update({
    where: { id: noteId },
    data: {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
    },
    include: { user: userSelect },
  });

  res.json({ success: true, data: note });
});

// PATCH /:tripId/notes/:noteId/pin
export const togglePin = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params['tripId'] as string;
  const noteId = req.params['noteId'] as string;
  await verifyTripMember(tripId, req.user!.id);

  const existing = await prisma.tripNote.findFirst({ where: { id: noteId, tripId } });
  if (!existing) throw AppError.notFound('Note not found');
  if (existing.userId !== req.user!.id) throw AppError.forbidden('You can only pin your own notes');

  const note = await prisma.tripNote.update({
    where: { id: noteId },
    data: { isPinned: !existing.isPinned },
    include: { user: userSelect },
  });

  res.json({ success: true, data: note });
});

// DELETE /:tripId/notes/:noteId
export const deleteNote = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params['tripId'] as string;
  const noteId = req.params['noteId'] as string;
  await verifyTripMember(tripId, req.user!.id);

  const existing = await prisma.tripNote.findFirst({ where: { id: noteId, tripId } });
  if (!existing) throw AppError.notFound('Note not found');
  if (existing.userId !== req.user!.id) throw AppError.forbidden('You can only delete your own notes');

  await prisma.tripNote.delete({ where: { id: noteId } });

  res.json({ success: true, data: null });
});
