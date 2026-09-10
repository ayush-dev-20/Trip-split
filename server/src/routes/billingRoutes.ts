import { Router } from 'express';
import * as billing from '../controllers/billingController';
import { authenticate, validate } from '../middleware';
import { createSubscriptionSchema, verifyPaymentSchema } from '../validators';

const router = Router();

router.post('/create-subscription', authenticate, validate({ body: createSubscriptionSchema }), billing.createSubscription);
router.post('/verify-payment', authenticate, validate({ body: verifyPaymentSchema }), billing.verifyPayment);
router.post('/downgrade', authenticate, billing.downgrade);
router.get('/subscription', authenticate, billing.getSubscription);

export default router;
