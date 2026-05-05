import { z } from 'zod';

// ──────────────────────────────────
// AUTH VALIDATORS
// ──────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  preferredCurrency: z.string().length(3).optional(),
  timezone: z.string().optional(),
  locale: z.string().optional(),
  notifyEmail: z.boolean().optional(),
  notifyInApp: z.boolean().optional(),
  notifyPush: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
});

// ──────────────────────────────────
// GROUP VALIDATORS
// ──────────────────────────────────

export const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100),
  description: z.string().max(500).optional(),
  defaultCurrency: z.string().length(3).default('USD'),
});

export const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  defaultCurrency: z.string().length(3).optional(),
});

// ──────────────────────────────────
// TRIP VALIDATORS
// ──────────────────────────────────

export const createTripSchema = z.object({
  name: z.string().min(1, 'Trip name is required').max(150),
  description: z.string().max(1000).optional(),
  destination: z.string().max(200).optional(),
  startDate: z.string().datetime({ message: 'Invalid start date' }),
  endDate: z.string().datetime({ message: 'Invalid end date' }),
  budget: z.number().positive().optional(),
  budgetCurrency: z.string().length(3).default('USD'),
  groupId: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
  isPublic: z.boolean().default(false),
});

export const updateTripSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  description: z.string().max(1000).optional().nullable(),
  destination: z.string().max(200).optional().nullable(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(['UPCOMING', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
  budget: z.number().positive().optional().nullable(),
  budgetCurrency: z.string().length(3).optional().or(z.literal('').transform(() => undefined)),
  isPublic: z.boolean().optional(),
});

// ──────────────────────────────────
// EXPENSE VALIDATORS
// ──────────────────────────────────

export const splitItemSchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().optional(),
  shares: z.number().positive().optional(),
  percentage: z.number().min(0).max(100).optional(),
});

export const createExpenseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().length(3).default('USD'),
  category: z.enum([
    'FOOD', 'TRANSPORT', 'ACCOMMODATION', 'ACTIVITIES',
    'SHOPPING', 'ENTERTAINMENT', 'HEALTH', 'COMMUNICATION',
    'FEES', 'MISCELLANEOUS',
  ]).default('MISCELLANEOUS'),
  date: z.string().datetime(),
  splitType: z.enum(['EQUAL', 'PERCENTAGE', 'EXACT', 'SHARES']).default('EQUAL'),
  tripId: z.string().uuid(),
  paidById: z.string().uuid(),
  isRecurring: z.boolean().default(false),
  recurringPattern: z.string().optional(),
  splits: z.array(splitItemSchema).optional(),
});

export const updateExpenseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  amount: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  category: z.enum([
    'FOOD', 'TRANSPORT', 'ACCOMMODATION', 'ACTIVITIES',
    'SHOPPING', 'ENTERTAINMENT', 'HEALTH', 'COMMUNICATION',
    'FEES', 'MISCELLANEOUS',
  ]).optional(),
  date: z.string().datetime().optional(),
  splitType: z.enum(['EQUAL', 'PERCENTAGE', 'EXACT', 'SHARES']).optional(),
  splits: z.array(splitItemSchema).optional(),
});

// ──────────────────────────────────
// SETTLEMENT VALIDATORS
// ──────────────────────────────────

export const createSettlementSchema = z.object({
  tripId: z.string().uuid(),
  fromUserId: z.string().uuid(),
  toUserId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  note: z.string().max(500).optional(),
});

export const settleDebtSchema = z.object({
  note: z.string().max(500).optional(),
});

// ──────────────────────────────────
// SOCIAL VALIDATORS
// ──────────────────────────────────

export const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(2000),
  mentions: z.array(z.string().uuid()).optional(),
});

export const createReactionSchema = z.object({
  emoji: z.string().min(1).max(10),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  replyToId: z.string().uuid().optional(),
});

export const createPollSchema = z.object({
  question: z.string().min(1, 'Question is required').max(500),
  options: z.array(z.string().min(1).max(200)).min(2, 'At least 2 options required').max(10),
  expiresAt: z.string().datetime().optional(),
});

export const createTripNoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
  isPinned: z.boolean().default(false),
});

export const createFeedPostSchema = z.object({
  content: z.string().max(5000).optional(),
  imageUrl: z.string().url().optional(),
});

// ──────────────────────────────────
// COMMON VALIDATORS
// ──────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export const inviteCodeSchema = z.object({
  code: z.string().min(1, 'Invite code is required'),
});

// ──────────────────────────────────
// CHECKPOINT VALIDATORS
// ──────────────────────────────────

export const createCheckpointSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  category: z.string().max(50).optional(),
  estimatedCost: z.number().min(0).optional(),
  day: z.number().int().min(1).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const createCheckpointsBulkSchema = z.object({
  checkpoints: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(1000).optional(),
        category: z.string().max(50).optional(),
        estimatedCost: z.number().min(0).optional(),
        day: z.number().int().min(1).optional(),
        sortOrder: z.number().int().min(0).optional(),
      })
    )
    .min(1, 'At least one checkpoint is required')
    .max(100),
});

export const updateCheckpointSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  category: z.string().max(50).optional().nullable(),
  estimatedCost: z.number().min(0).optional().nullable(),
  day: z.number().int().min(1).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  isVisited: z.boolean().optional(),
});

export const reorderCheckpointsSchema = z.object({
  order: z
    .array(
      z.object({
        id: z.string().uuid(),
        sortOrder: z.number().int().min(0),
      })
    )
    .min(1),
});

// ──────────────────────────────────
// NOTE VALIDATORS
// ──────────────────────────────────

export const createNoteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().optional(),
});

export const updateNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
});
