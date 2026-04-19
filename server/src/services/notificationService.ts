import { prisma } from '../config/database';
import { NotificationType } from '@prisma/client';

/**
 * Create an in-app notification.
 */
export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      data: params.data || {},
    },
  });
}

/**
 * Notify multiple users at once.
 */
export async function notifyUsers(
  userIds: string[],
  params: {
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, any>;
  }
): Promise<void> {
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: params.type,
      title: params.title,
      message: params.message,
      data: params.data || {},
    })),
  });
}

/**
 * Get unread notification count for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
}
