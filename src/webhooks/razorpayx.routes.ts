/**
 * razorpayx.routes.ts
 *
 * Mounted at /webhook/razorpayx in app.ts.
 * Raw body parsing is applied upstream in app.ts BEFORE the JSON parser
 * so that the HMAC signature can be verified against the original bytes.
 *
 *   app.use('/webhook/razorpayx', express.raw({ type: 'application/json' }));
 *   app.use('/webhook/razorpayx', razorpayxRoutes);
 */

import { Router } from 'express';
import { handleRazorpayXWebhook } from './razorpayx.webhook';

const router = Router();

// POST /webhook/razorpayx
// No authMiddleware — Razorpay sends unsigned server-to-server callbacks.
// Authenticity is verified via HMAC-SHA256 X-Razorpay-Signature header.
router.post('/', handleRazorpayXWebhook);

export default router;
