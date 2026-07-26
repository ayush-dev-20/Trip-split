import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

export type NoteScope =
  | { type: 'trip'; tripId: string }
  | { type: 'group'; groupId: string }
  | { type: 'personal' };

const userSelect = { select: { id: true, name: true, avatarUrl: true } };

/**
 * Prisma `where` fragment identifying every note that belongs to this scope.
 * Personal scope additionally requires userId, since "both FKs null" alone
 * would otherwise match every user's personal notes.
 */
export function scopeWhere(scope: NoteScope, userId: string) {
  switch (scope.type) {
    case 'trip':
      return { tripId: scope.tripId };
    case 'group':
      return { groupId: scope.groupId };
    case 'personal':
      return { tripId: null, groupId: null, userId };
  }
}

export async function listNotes(scope: NoteScope, userId: string) {
  return prisma.note.findMany({
    where: scopeWhere(scope, userId),
    include: { user: userSelect },
    orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
  });
}

export async function createNote(
  scope: NoteScope,
  userId: string,
  data: { title: string; content?: string }
) {
  const scopeIds =
    scope.type === 'trip' ? { tripId: scope.tripId } :
    scope.type === 'group' ? { groupId: scope.groupId } :
    {};

  return prisma.note.create({
    data: { ...scopeIds, userId, title: data.title, content: data.content ?? '' },
    include: { user: userSelect },
  });
}

async function findOwnedNote(scope: NoteScope, noteId: string, userId: string, action: string) {
  const existing = await prisma.note.findFirst({ where: { id: noteId, ...scopeWhere(scope, userId) } });
  if (!existing) throw AppError.notFound('Note not found');
  if (existing.userId !== userId) throw AppError.forbidden(`You can only ${action} your own notes`);
  return existing;
}

export async function updateNote(
  scope: NoteScope,
  noteId: string,
  userId: string,
  data: { title?: string; content?: string }
) {
  await findOwnedNote(scope, noteId, userId, 'edit');
  return prisma.note.update({
    where: { id: noteId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.content !== undefined && { content: data.content }),
    },
    include: { user: userSelect },
  });
}

export async function togglePin(scope: NoteScope, noteId: string, userId: string) {
  const existing = await findOwnedNote(scope, noteId, userId, 'pin');
  return prisma.note.update({
    where: { id: noteId },
    data: { isPinned: !existing.isPinned },
    include: { user: userSelect },
  });
}

export async function deleteNote(scope: NoteScope, noteId: string, userId: string) {
  await findOwnedNote(scope, noteId, userId, 'delete');
  await prisma.note.delete({ where: { id: noteId } });
}
