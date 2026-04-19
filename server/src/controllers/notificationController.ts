import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler, AppError, paginate, paginationMeta } from '../utils';

/**
 * GET /api/notifications
 */
export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const page = req.query.page as string | undefined;
  const limit = req.query.limit as string | undefined;
  const unreadOnly = req.query.unreadOnly as string | undefined;
  const userId = req.user!.id as string;
  const { take, skip } = paginate(page as any, limit as any);

  const where: any = { userId };
  if (unreadOnly === 'true') where.isRead = false;

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  res.json({
    success: true,
    data: notifications,
    unreadCount,
    pagination: paginationMeta(total, Number(page) || 1, Number(limit) || 20),
  });
});

/**
 * PUT /api/notifications/:id/read
 */
export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const notificationId = req.params.id as string;
  const userId = req.user!.id as string;

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) throw AppError.notFound('Notification not found');
  if (notification.userId !== userId) throw AppError.forbidden('Not your notification');

  await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  res.json({ success: true, message: 'Marked as read' });
});

/**
 * PUT /api/notifications/read-all
 */
export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id as string;

  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });

  res.json({ success: true, message: 'All notifications marked as read' });
});

/**
 * GET /api/activity/:tripId
 */
export const getActivityFeed = asyncHandler(async (req: Request, res: Response) => {
  const tripId = req.params.tripId as string;
  const page = req.query.page as string | undefined;
  const limit = req.query.limit as string | undefined;
  const { take, skip } = paginate(page as any, limit as any);

  const [activities, total] = await Promise.all([
    prisma.activityLog.findMany({
      where: { tripId },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.activityLog.count({ where: { tripId } }),
  ]);

  res.json({
    success: true,
    data: activities,
    pagination: paginationMeta(total, Number(page) || 1, Number(limit) || 20),
  });
});
