import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { asyncHandler, AppError } from '../utils';
import { logAudit } from '../services/auditService';

/**
 * Generate JWT access token.
 */
function generateAccessToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as any);
}

/**
 * Generate JWT refresh token and store in DB.
 */
async function generateRefreshToken(userId: string): Promise<string> {
  const token = jwt.sign({ userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as any);

  const decoded = jwt.decode(token) as { exp: number };

  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt: new Date(decoded.exp * 1000),
    },
  });

  return token;
}

/**
 * POST /api/auth/register
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw AppError.conflict('An account with this email already exists');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Create user + free subscription
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      subscription: {
        create: { tier: 'FREE', status: 'ACTIVE' },
      },
    },
    include: { subscription: true },
  });

  // Generate tokens
  const accessToken = generateAccessToken(user.id);
  const refreshToken = await generateRefreshToken(user.id);

  // Audit log
  await logAudit({
    action: 'CREATE',
    entityType: 'user',
    entityId: user.id,
    userId: user.id,
    after: { email: user.email, name: user.name },
  });

  // Set refresh token cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        preferredCurrency: user.preferredCurrency,
        tier: user.subscription?.tier || 'FREE',
        onboardingDone: user.onboardingDone,
      },
      accessToken,
    },
  });
});

/**
 * POST /api/auth/login
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { subscription: true },
  });

  if (!user || !user.passwordHash) {
    throw AppError.unauthorized('Invalid email or password');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw AppError.unauthorized('Invalid email or password');
  }

  if (!user.isActive) {
    throw AppError.forbidden('Your account has been deactivated');
  }

  const accessToken = generateAccessToken(user.id);
  const refreshToken = await generateRefreshToken(user.id);

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        preferredCurrency: user.preferredCurrency,
        tier: user.subscription?.tier || 'FREE',
        onboardingDone: user.onboardingDone,
      },
      accessToken,
    },
  });
});

/**
 * POST /api/auth/refresh
 */
export const refreshAccessToken = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken || req.body.refreshToken;

  if (!token) {
    throw AppError.unauthorized('Refresh token is required');
  }

  // Verify the refresh token
  let decoded: { userId: string };
  try {
    decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as { userId: string };
  } catch {
    throw AppError.unauthorized('Invalid or expired refresh token');
  }

  // Check if token exists in DB and is not revoked
  const storedToken = await prisma.refreshToken.findUnique({ where: { token } });
  if (!storedToken || storedToken.revoked) {
    throw AppError.unauthorized('Refresh token has been revoked');
  }

  // Revoke old refresh token (rotation)
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revoked: true },
  });

  // Generate new tokens
  const accessToken = generateAccessToken(decoded.userId);
  const newRefreshToken = await generateRefreshToken(decoded.userId);

  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    data: { accessToken },
  });
});

/**
 * POST /api/auth/logout
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;

  if (token) {
    await prisma.refreshToken.updateMany({
      where: { token },
      data: { revoked: true },
    });
  }

  res.clearCookie('refreshToken');
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * GET /api/auth/me
 */
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.id },
    include: { subscription: true },
  });

  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      preferredCurrency: user.preferredCurrency,
      onboardingDone: user.onboardingDone,
      // Map DB field names → client User type field names
      emailNotifications: user.notifyEmail,
      pushNotifications: user.notifyPush,
      weeklyReport: user.notifyInApp,
      tier: user.subscription?.tier ?? 'FREE',
      subscription: user.subscription
        ? {
            tier: user.subscription.tier,
            status: user.subscription.status,
            currentPeriodEnd: user.subscription.currentPeriodEnd,
            cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd,
          }
        : null,
      createdAt: user.createdAt,
    },
  });
});

/**
 * PUT /api/auth/profile
 */
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  // Map client field names → DB column names before writing
  const { emailNotifications, pushNotifications, weeklyReport, ...rest } = req.body as {
    name?: string;
    preferredCurrency?: string;
    avatarUrl?: string;
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    weeklyReport?: boolean;
  };

  const data: Record<string, unknown> = { ...rest };
  if (emailNotifications !== undefined) data.notifyEmail = emailNotifications;
  if (pushNotifications !== undefined) data.notifyPush = pushNotifications;
  if (weeklyReport !== undefined) data.notifyInApp = weeklyReport;

  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    data,
  });

  res.json({
    success: true,
    data: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatarUrl: updated.avatarUrl,
      preferredCurrency: updated.preferredCurrency,
      onboardingDone: updated.onboardingDone,
      emailNotifications: updated.notifyEmail,
      pushNotifications: updated.notifyPush,
      weeklyReport: updated.notifyInApp,
    },
  });
});

/**
 * PUT /api/auth/password
 */
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.id },
  });

  if (!user.passwordHash) {
    throw AppError.badRequest('Cannot change password for OAuth accounts');
  }

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    throw AppError.unauthorized('Current password is incorrect');
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  // Revoke all refresh tokens
  await prisma.refreshToken.updateMany({
    where: { userId: user.id },
    data: { revoked: true },
  });

  res.json({ success: true, message: 'Password changed successfully' });
});

/**
 * POST /api/auth/google
 * Authenticate with Google OAuth (receives Google token from client).
 */
export const googleAuth = asyncHandler(async (req: Request, res: Response) => {
  const { token, name: googleName, email: googleEmail, picture } = req.body;

  if (!token || !googleEmail) {
    throw AppError.badRequest('Google token and email are required');
  }

  // Decode Google token — in production, verify with Google's API
  // For now, trust the client-sent fields (should verify with google-auth-library)
  let user = await prisma.user.findUnique({
    where: { email: googleEmail },
    include: { subscription: true },
  });

  if (!user) {
    // Create new user from Google
    user = await prisma.user.create({
      data: {
        email: googleEmail,
        name: googleName || googleEmail.split('@')[0],
        avatarUrl: picture || null,
        googleId: token,
        emailVerified: true,
        subscription: {
          create: { tier: 'FREE', status: 'ACTIVE' },
        },
      },
      include: { subscription: true },
    });
  } else if (!user.googleId) {
    // Link Google to existing account
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId: token, avatarUrl: user.avatarUrl || picture },
      include: { subscription: true },
    });
  }

  const accessToken = generateAccessToken(user.id);
  const refreshToken = await generateRefreshToken(user.id);

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        preferredCurrency: user.preferredCurrency,
        tier: user.subscription?.tier || 'FREE',
        onboardingDone: user.onboardingDone,
      },
      accessToken,
    },
  });
});

/**
 * PUT /api/auth/onboarding
 */
export const completeOnboarding = asyncHandler(async (req: Request, res: Response) => {
  const { preferredCurrency } = req.body as { preferredCurrency?: string };

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: {
      onboardingDone: true,
      ...(preferredCurrency ? { preferredCurrency } : {}),
    },
    include: { subscription: true },
  });

  res.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      preferredCurrency: user.preferredCurrency,
      onboardingDone: user.onboardingDone,
      emailNotifications: user.notifyEmail,
      pushNotifications: user.notifyPush,
      weeklyReport: user.notifyInApp,
      tier: user.subscription?.tier ?? 'FREE',
      subscription: user.subscription
        ? {
            tier: user.subscription.tier,
            status: user.subscription.status,
            currentPeriodEnd: user.subscription.currentPeriodEnd,
            cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd,
          }
        : null,
      createdAt: user.createdAt,
    },
  });
});
