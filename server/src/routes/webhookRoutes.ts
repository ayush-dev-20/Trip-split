import { Router } from 'express';
import express from 'express';
import { handleClerkWebhook } from '../controllers/webhookController';
import { handleRazorpayWebhook } from '../controllers/razorpayWebhookController';

const router = Router();

// Use raw body parser for Clerk webhook — svix needs the raw bytes to verify signature
router.post('/clerk', express.raw({ type: 'application/json' }), handleClerkWebhook);

// Same reason — Razorpay's HMAC signature check needs the exact raw bytes,
// which is lost once the JSON parser has re-serialized the body.
router.post('/razorpay', express.raw({ type: 'application/json' }), handleRazorpayWebhook);

export default router;
