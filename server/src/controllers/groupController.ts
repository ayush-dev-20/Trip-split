import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler, AppError, generateInviteCode, paginate, paginationMeta } from '../utils';
import { logActivity, logAudit } from '../services/auditService';

/**
 * POST /api/groups
 */
export const createGroup = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, defaultCurrency } = req.body;
  const userId = req.user!.id as string;

  const group = await prisma.group.create({
    data: {
      name,
      description,
      defaultCurrency,
      inviteCode: generateInviteCode(),
      members: {
        create: {
          userId,
          role: 'ADMIN',
        },
      },
    },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      },
    },
  });

  await logAudit({
    action: 'CREATE',
    entityType: 'group',
    entityId: group.id,
    userId,
    after: { name, defaultCurrency },
  });

  res.status(201).json({ success: true, data: group });
});

/**
 * GET /api/groups
 */
export const getGroups = asyncHandler(async (req: Request, res: Response) => {
  const page = req.query.page as string | undefined;
  const limit = req.query.limit as string | undefined;
  const userId = req.user!.id as string;
  const { take, skip } = paginate(page as any, limit as any);

  const [groups, total] = await Promise.all([
    prisma.group.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
        _count: { select: { trips: true, members: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.group.count({
      where: { members: { some: { userId } } },
    }),
  ]);

  res.json({
    success: true,
    data: groups,
    pagination: paginationMeta(total, Number(page) || 1, Number(limit) || 20),
  });
});

/**
 * GET /api/groups/:id
 */
export const getGroup = asyncHandler(async (req: Request, res: Response) => {
  const groupId = req.params.id as string;
  const userId = req.user!.id as string;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      },
      trips: {
        orderBy: { startDate: 'desc' },
        take: 10,
      },
    },
  });

  if (!group) throw AppError.notFound('Group not found');

  const isMember = group.members.some((m: any) => m.userId === userId);
  if (!isMember) throw AppError.forbidden('You are not a member of this group');

  res.json({ success: true, data: group });
});

/**
 * PUT /api/groups/:id
 */
export const updateGroup = asyncHandler(async (req: Request, res: Response) => {
  const groupId = req.params.id as string;
  const userId = req.user!.id as string;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: true },
  });

  if (!group) throw AppError.notFound('Group not found');

  const membership = group.members.find((m: any) => m.userId === userId);
  if (!membership || membership.role !== 'ADMIN') {
    throw AppError.forbidden('Only group admins can update group settings');
  }

  const updated = await prisma.group.update({
    where: { id: groupId },
    data: req.body,
    include: {
      members: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });

  res.json({ success: true, data: updated });
});

/**
 * DELETE /api/groups/:id
 */
export const deleteGroup = asyncHandler(async (req: Request, res: Response) => {
  const groupId = req.params.id as string;
  const userId = req.user!.id as string;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: true },
  });

  if (!group) throw AppError.notFound('Group not found');

  const membership = group.members.find((m: any) => m.userId === userId);
  if (!membership || membership.role !== 'ADMIN') {
    throw AppError.forbidden('Only group admins can delete a group');
  }

  await prisma.group.delete({ where: { id: groupId } });

  res.json({ success: true, message: 'Group deleted successfully' });
});

/**
 * POST /api/groups/:id/invite
 */
export const inviteToGroup = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const groupId = req.params.id as string;
  const userId = req.user!.id as string;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: true },
  });

  if (!group) throw AppError.notFound('Group not found');

  const isMember = group.members.some((m: any) => m.userId === userId);
  if (!isMember) throw AppError.forbidden('You are not a member of this group');

  const invitedUser = await prisma.user.findUnique({ where: { email } });
  if (!invitedUser) throw AppError.notFound('User with that email not found');

  const alreadyMember = group.members.some((m: any) => m.userId === invitedUser.id);
  if (alreadyMember) throw AppError.conflict('User is already a member of this group');

  await prisma.groupMember.create({
    data: { groupId, userId: invitedUser.id, role: 'MEMBER' },
  });

  res.json({ success: true, message: 'User invited to group' });
});

/**
 * POST /api/groups/join/:code
 */
export const joinGroupByCode = asyncHandler(async (req: Request, res: Response) => {
  const code = req.params.code as string;
  const userId = req.user!.id as string;

  const group = await prisma.group.findUnique({
    where: { inviteCode: code },
    include: { members: true },
  });

  if (!group) throw AppError.notFound('Invalid invite code');

  const alreadyMember = group.members.some((m: any) => m.userId === userId);
  if (alreadyMember) throw AppError.conflict('You are already a member of this group');

  await prisma.groupMember.create({
    data: { groupId: group.id, userId, role: 'MEMBER' },
  });

  await logActivity({
    action: `${req.user!.name || 'Someone'} joined the group`,
    type: 'JOIN',
    entityType: 'group',
    entityId: group.id,
    userId,
  });

  res.json({ success: true, data: group });
});

/**
 * DELETE /api/groups/:id/members/:userId
 */
export const removeMember = asyncHandler(async (req: Request, res: Response) => {
  const groupId = req.params.id as string;
  const targetUserId = req.params.userId as string;
  const userId = req.user!.id as string;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: true },
  });

  if (!group) throw AppError.notFound('Group not found');

  const requesterMembership = group.members.find((m: any) => m.userId === userId);
  if (!requesterMembership) throw AppError.forbidden('You are not a member of this group');

  if (targetUserId !== userId && requesterMembership.role !== 'ADMIN') {
    throw AppError.forbidden('Only admins can remove other members');
  }

  await prisma.groupMember.deleteMany({
    where: { groupId, userId: targetUserId },
  });

  res.json({ success: true, message: 'Member removed' });
});
