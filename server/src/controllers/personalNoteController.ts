import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as noteService from '../services/noteService';

const scope = { type: 'personal' as const };

// GET /notes
export const getNotes = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id as string;
  const notes = await noteService.listNotes(scope, userId);
  res.json({ success: true, data: notes });
});

// POST /notes
export const createNote = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id as string;
  const { title, content } = req.body as { title: string; content?: string };
  const note = await noteService.createNote(scope, userId, { title, content });
  res.status(201).json({ success: true, data: note });
});

// PATCH /notes/:noteId
export const updateNote = asyncHandler(async (req: Request, res: Response) => {
  const noteId = req.params['noteId'] as string;
  const userId = req.user!.id as string;
  const { title, content } = req.body as { title?: string; content?: string };
  const note = await noteService.updateNote(scope, noteId, userId, { title, content });
  res.json({ success: true, data: note });
});

// PATCH /notes/:noteId/pin
export const togglePin = asyncHandler(async (req: Request, res: Response) => {
  const noteId = req.params['noteId'] as string;
  const userId = req.user!.id as string;
  const note = await noteService.togglePin(scope, noteId, userId);
  res.json({ success: true, data: note });
});

// DELETE /notes/:noteId
export const deleteNote = asyncHandler(async (req: Request, res: Response) => {
  const noteId = req.params['noteId'] as string;
  const userId = req.user!.id as string;
  await noteService.deleteNote(scope, noteId, userId);
  res.json({ success: true, data: null });
});
