import { Router } from 'express';
import * as auth from '../controllers/authController';
import { authenticate, validate } from '../middleware';
import { updateProfileSchema } from '../validators';

const router = Router();

// All routes below require a valid Clerk session
// GET  /api/auth/me          — fetch the current user's DB profile
// PUT  /api/auth/profile     — update name, currency, timezone, etc.
// PUT  /api/auth/onboarding  — mark onboarding as complete

router.get('/me', authenticate, auth.getMe);
router.put('/profile', authenticate, validate({ body: updateProfileSchema }), auth.updateProfile);
router.put('/onboarding', authenticate, auth.completeOnboarding);

export default router;
