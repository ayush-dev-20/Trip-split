import { Router } from 'express';
import * as auth from '../controllers/authController';
import { authenticate, authLimiter, validate } from '../middleware';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
} from '../validators';

const router = Router();

// Public routes
router.post('/register', authLimiter, validate({ body: registerSchema }), auth.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), auth.login);
router.post('/refresh', auth.refreshAccessToken);
router.post('/logout', auth.logout);
router.post('/google', authLimiter, auth.googleAuth);

// Protected routes
router.get('/me', authenticate, auth.getMe);
router.put('/profile', authenticate, validate({ body: updateProfileSchema }), auth.updateProfile);
router.put('/password', authenticate, validate({ body: changePasswordSchema }), auth.changePassword);
router.put('/onboarding', authenticate, auth.completeOnboarding);

export default router;
