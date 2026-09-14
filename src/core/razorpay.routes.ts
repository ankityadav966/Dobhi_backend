import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import {
  verifyRazorpaySignature,
  handlePaymentCaptured,
  handlePaymentFailed,
} from '../services/razorpay.service';

const router = Router();

/**
 * Razorpay Webhook Endpoint
 * POST /webhook/razorpay
 *
 * CRITICAL SECURITY:
 * - Uses raw body buffer for signature verification (NOT JSON string)
 * - Verifies Razorpay signature using HMAC-SHA256
 * - Rejects invalid signatures with 401
 *
 * Handles:
 * - payment.captured: Successful payment
 * - payment.failed: Failed payment
 *
 * Design:
 * - Returns 200 immediately (async processing safe)
 * - Logs all payloads for debugging
 * - Idempotent webhook handlers
 */
router.post('/razorpay', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    // Use raw body buffer from middleware (CRITICAL for signature verification)
    const rawBody = (req as any).rawBody as Buffer;

    if (!rawBody) {
      logger.error('Razorpay webhook: Raw body not available', {
        hasRawBody: !!(req as any).rawBody,
      });
      return res.status(400).json({
        success: false,
        message: 'Raw body buffer not available - middleware misconfigured',
      });
    }

    // ⚠️ CRITICAL: Verify signature first using raw buffer
    if (!signature || !verifyRazorpaySignature(rawBody, signature)) {
      logger.error('Razorpay webhook: Signature verification FAILED', {
        signature: signature ? signature.substring(0, 20) + '...' : 'missing',
        bodyLength: rawBody.length,
        timestamp: new Date(),
      });

      // Return 401 for invalid signature (fraud prevention)
      return res.status(401).json({
        success: false,
        message: 'Invalid signature - webhook rejected',
      });
    }

    // Parse JSON body after signature verification
    const body = JSON.parse(rawBody.toString('utf-8'));

    logger.info('Razorpay webhook: Signature verified successfully', {
      event: body.event,
      orderId: body.order?.id,
      timestamp: new Date(),
    });

    // Log webhook payload (for debugging)
    logger.debug('Razorpay webhook payload', {
      event: body.event,
      orderId: body.order?.id,
      paymentId: body.payment?.id,
      amount: body.payment?.amount,
    });

    // Handle different events
    const event = body.event;

    if (event === 'payment.captured') {
      // Successful payment
      await handlePaymentCaptured(body);
      logger.info('Razorpay webhook: payment.captured processed successfully');
    } else if (event === 'payment.failed') {
      // Failed payment
      await handlePaymentFailed(body);
      logger.info('Razorpay webhook: payment.failed processed successfully');
    } else {
      // Ignore other events
      logger.info('Razorpay webhook: Event ignored (not payment.captured or payment.failed)', {
        event,
      });
    }

    // Return 200 OK immediately
    // Razorpay will retry if we don't respond with 200 within 5s
    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    logger.error('Razorpay webhook: Error processing webhook', {
      error: errorMsg,
      event: req.body?.event,
      orderId: req.body?.order?.id,
    });

    // Return 500 to signal failure (Razorpay will retry)
    return res.status(500).json({
      success: false,
      message: 'Webhook processing failed - will retry',
      error: errorMsg,
    });
  }
});

export default router;
