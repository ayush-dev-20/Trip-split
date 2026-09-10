import { Router } from 'express';
import * as billing from '../controllers/billingController';
import { authenticate, validate } from '../middleware';
import { createOrderSchema, verifyPaymentSchema } from '../validators';

const router = Router();

router.post('/create-order', authenticate, validate({ body: createOrderSchema }), billing.createOrder);
router.post('/verify-payment', authenticate, validate({ body: verifyPaymentSchema }), billing.verifyPayment);
router.post('/downgrade', authenticate, billing.downgrade);
router.get('/subscription', authenticate, billing.getSubscription);

export default router;
