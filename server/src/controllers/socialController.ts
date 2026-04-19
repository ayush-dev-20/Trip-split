import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler, AppError, paginate, paginationMeta } from '../utils';

// ──────────────────────────────────
// CHAT
// ──────────────────────────────────

/**
 * GET /api/trips/:tripId/chat
 */
export const getChatMessages = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const userId = req.user!.id as string;
  const page = req.query.page as string | undefined;
  const limit = req.query.limit as string | undefined;
  const { take, skip } = paginate(page as any, limit as any);

  const isMember = await prisma.tripMember.findFirst({
    where: { tripId, userId },
  });
  if (!isMember) throw AppError.forbidden('You are not a member of this trip');

  const [messages, total] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { tripId },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        replyTo: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.chatMessage.count({ where: { tripId } }),
  ]);

  res.json({
    success: true,
    data: messages.reverse(),
    pagination: paginationMeta(total, Number(page) || 1, Number(limit) || 50),
  });
});

/**
 * POST /api/trips/:tripId/chat
 */
export const sendChatMessage = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const userId = req.user!.id as string;
  const { content, replyToId } = req.body;

  const isMember = await prisma.tripMember.findFirst({
    where: { tripId, userId },
  });
  if (!isMember) throw AppError.forbidden('You are not a member of this trip');

  const message = await prisma.chatMessage.create({
    data: {
      content,
      tripId,
      userId,
      replyToId,
    },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
      replyTo: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  res.status(201).json({ success: true, data: message });
});

// ──────────────────────────────────
// POLLS
// ──────────────────────────────────

/**
 * GET /api/trips/:tripId/polls
 */
export const getPolls = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const userId = req.user!.id as string;

  const isMember = await prisma.tripMember.findFirst({
    where: { tripId, userId },
  });
  if (!isMember) throw AppError.forbidden('You are not a member of this trip');

  const polls = await prisma.poll.findMany({
    where: { tripId },
    include: {
      options: {
        include: {
          votes: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          },
          _count: { select: { votes: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ success: true, data: polls });
});

/**
 * POST /api/trips/:tripId/polls
 */
export const createPoll = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const userId = req.user!.id as string;
  const { question, options, expiresAt } = req.body;

  const isMember = await prisma.tripMember.findFirst({
    where: { tripId, userId },
  });
  if (!isMember) throw AppError.forbidden('You are not a member of this trip');

  const poll = await prisma.poll.create({
    data: {
      question,
      tripId,
      createdById: userId,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      options: {
        create: (options as string[]).map((text: string) => ({ text })),
      },
    },
    include: {
      options: {
        include: { _count: { select: { votes: true } } },
      },
    },
  });

  res.status(201).json({ success: true, data: poll });
});

/**
 * POST /api/polls/:pollId/vote/:optionId
 */
export const votePoll = asyncHandler(async (req: Request, res: Response) => {
  const pollId = req.params.pollId as string;
  const optionId = req.params.optionId as string;
  const userId = req.user!.id as string;

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { options: true },
  });

  if (!poll) throw AppError.notFound('Poll not found');
  if (poll.status === 'CLOSED') throw AppError.badRequest('This poll is closed');

  const option = poll.options.find((o: any) => o.id === optionId);
  if (!option) throw AppError.notFound('Option not found');

  // Remove any existing vote by this user on this poll
  await prisma.pollVote.deleteMany({
    where: {
      userId,
      option: { pollId },
    },
  });

  // Create new vote
  const vote = await prisma.pollVote.create({
    data: { optionId, userId },
  });

  res.json({ success: true, data: vote });
});

/**
 * PUT /api/polls/:pollId/close
 */
export const closePoll = asyncHandler(async (req: Request, res: Response) => {
  const pollId = req.params.pollId as string;
  const userId = req.user!.id as string;

  const poll = await prisma.poll.findUnique({ where: { id: pollId } });

  if (!poll) throw AppError.notFound('Poll not found');
  if (poll.createdById !== userId) {
    throw AppError.forbidden('Only the poll creator can close it');
  }

  const updated = await prisma.poll.update({
    where: { id: pollId },
    data: { status: 'CLOSED' },
  });

  res.json({ success: true, data: updated });
});

// ──────────────────────────────────
// TRIP NOTES
// ──────────────────────────────────

/**
 * GET /api/trips/:tripId/notes
 */
export const getTripNotes = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;

  const notes = await prisma.tripNote.findMany({
    where: { tripId },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
  });

  res.json({ success: true, data: notes });
});

/**
 * POST /api/trips/:tripId/notes
 */
export const createTripNote = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const userId = req.user!.id as string;
  const { title, content, isPinned } = req.body;

  const note = await prisma.tripNote.create({
    data: {
      title,
      content,
      isPinned: isPinned || false,
      tripId,
      userId,
    },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });

  res.status(201).json({ success: true, data: note });
});

/**
 * PUT /api/trips/:tripId/notes/:noteId
 */
export const updateTripNote = asyncHandler(async (req: Request, res: Response) => {
  const noteId = req.params.noteId as string;
  const userId = req.user!.id as string;

  const note = await prisma.tripNote.findUnique({ where: { id: noteId } });

  if (!note) throw AppError.notFound('Note not found');
  if (note.userId !== userId) throw AppError.forbidden('You can only edit your own notes');

  const updated = await prisma.tripNote.update({
    where: { id: noteId },
    data: req.body,
  });

  res.json({ success: true, data: updated });
});

/**
 * DELETE /api/trips/:tripId/notes/:noteId
 */
export const deleteTripNote = asyncHandler(async (req: Request, res: Response) => {
  const noteId = req.params.noteId as string;
  const userId = req.user!.id as string;

  const note = await prisma.tripNote.findUnique({ where: { id: noteId } });

  if (!note) throw AppError.notFound('Note not found');
  if (note.userId !== userId) throw AppError.forbidden('You can only delete your own notes');

  await prisma.tripNote.delete({ where: { id: noteId } });

  res.json({ success: true, message: 'Note deleted' });
});

// ──────────────────────────────────
// TRIP FEED
// ──────────────────────────────────

/**
 * GET /api/trips/:tripId/feed
 */
export const getTripFeed = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const page = req.query.page as string | undefined;
  const limit = req.query.limit as string | undefined;
  const { take, skip } = paginate(page as any, limit as any);

  const [posts, total] = await Promise.all([
    prisma.tripFeedPost.findMany({
      where: { tripId },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.tripFeedPost.count({ where: { tripId } }),
  ]);

  res.json({
    success: true,
    data: posts,
    pagination: paginationMeta(total, Number(page) || 1, Number(limit) || 20),
  });
});

/**
 * POST /api/trips/:tripId/feed
 */
export const createFeedPost = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const userId = req.user!.id as string;
  const { content, imageUrl } = req.body;

  if (!content && !imageUrl) {
    throw AppError.badRequest('Post must have content or an image');
  }

  const post = await prisma.tripFeedPost.create({
    data: {
      content,
      imageUrl,
      tripId,
      userId,
    },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });

  res.status(201).json({ success: true, data: post });
});

/**
 * DELETE /api/trips/:tripId/feed/:postId
 */
export const deleteFeedPost = asyncHandler(async (req: Request, res: Response) => {
  const postId = req.params.postId as string;
  const userId = req.user!.id as string;

  const post = await prisma.tripFeedPost.findUnique({ where: { id: postId } });

  if (!post) throw AppError.notFound('Post not found');
  if (post.userId !== userId) throw AppError.forbidden('You can only delete your own posts');

  await prisma.tripFeedPost.delete({ where: { id: postId } });

  res.json({ success: true, message: 'Post deleted' });
});
