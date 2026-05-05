import { Router } from 'express';
import express from 'express';
import { handleClerkWebhook } from '../controllers/webhookController';

const router = Router();

// Use raw body parser for Clerk webhook — svix needs the raw bytes to verify signature
router.post('/clerk', express.raw({ type: 'application/json' }), handleClerkWebhook);

export default router;
