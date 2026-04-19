import { Router } from 'express';
import * as billing from '../controllers/billingController';
import { authenticate } from '../middleware';

const router = Router();

router.post('/upgrade', authenticate, billing.upgrade);
router.post('/downgrade', authenticate, billing.downgrade);
router.get('/subscription', authenticate, billing.getSubscription);

export default router;
