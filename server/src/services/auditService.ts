import { prisma } from '../config/database';
import { AuditAction } from '@prisma/client';

/**
 * Log an action in the audit trail (immutable).
 */
export async function logAudit(params: {
  action: AuditAction;
  entityType: string;
  entityId: string;
  userId: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      userId: params.userId,
      before: params.before || undefined,
      after: params.after || undefined,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });
}

/**
 * Log an activity in the trip activity feed.
 */
export async function logActivity(params: {
  action: string;
  type: AuditAction;
  entityType: string;
  entityId: string;
  userId: string;
  tripId?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  await prisma.activityLog.create({
    data: {
      action: params.action,
      type: params.type,
      entityType: params.entityType,
      entityId: params.entityId,
      userId: params.userId,
      tripId: params.tripId,
      metadata: params.metadata || undefined,
    },
  });
}
