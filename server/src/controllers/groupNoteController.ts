import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import * as noteService from '../services/noteService';

async function verifyGroupMember(groupId: string, userId: string) {
  const member = await prisma.groupMember.findFirst({ where: { groupId, userId } });
  if (!member) throw AppError.forbidden('You are not a member of this group');
  return member;
}

// GET /:groupId/notes
export const getNotes = asyncHandler(async (req: Request, res: Response) => {
  const groupId = req.params['groupId'] as string;
  const userId = req.user!.id as string;
  await verifyGroupMember(groupId, userId);

  const notes = await noteService.listNotes({ type: 'group', groupId }, userId);
  res.json({ success: true, data: notes });
});

// POST /:groupId/notes
export const createNote = asyncHandler(async (req: Request, res: Response) => {
  const groupId = req.params['groupId'] as string;
  const userId = req.user!.id as string;
  await verifyGroupMember(groupId, userId);

  const { title, content } = req.body as { title: string; content?: string };
  const note = await noteService.createNote({ type: 'group', groupId }, userId, { title, content });
  res.status(201).json({ success: true, data: note });
});

// PATCH /:groupId/notes/:noteId
export const updateNote = asyncHandler(async (req: Request, res: Response) => {
  const groupId = req.params['groupId'] as string;
  const noteId = req.params['noteId'] as string;
  const userId = req.user!.id as string;
  await verifyGroupMember(groupId, userId);

  const { title, content } = req.body as { title?: string; content?: string };
  const note = await noteService.updateNote({ type: 'group', groupId }, noteId, userId, { title, content });
  res.json({ success: true, data: note });
});

// PATCH /:groupId/notes/:noteId/pin
export const togglePin = asyncHandler(async (req: Request, res: Response) => {
  const groupId = req.params['groupId'] as string;
  const noteId = req.params['noteId'] as string;
  const userId = req.user!.id as string;
  await verifyGroupMember(groupId, userId);

  const note = await noteService.togglePin({ type: 'group', groupId }, noteId, userId);
  res.json({ success: true, data: note });
});

// DELETE /:groupId/notes/:noteId
export const deleteNote = asyncHandler(async (req: Request, res: Response) => {
  const groupId = req.params['groupId'] as string;
  const noteId = req.params['noteId'] as string;
  const userId = req.user!.id as string;
  await verifyGroupMember(groupId, userId);

  await noteService.deleteNote({ type: 'group', groupId }, noteId, userId);
  res.json({ success: true, data: null });
});
