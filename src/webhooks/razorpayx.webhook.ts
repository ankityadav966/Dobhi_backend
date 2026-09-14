/**
 * razorpayx.webhook.ts
 *
 * Handles inbound RazorpayX payout webhook events.
 *
 * Supported events:
 *   payout.processed  → booking PROCESSING → PAID, escrow LOCKED → RELEASED
 *   payout.failed     → booking PROCESSING → FAILED, escrow stays LOCKED
 *
 * Security:
 *   HMAC-SHA256 signature verification using X-Razorpay-Signature header.
 *   Raw body required — route must use express.raw() before JSON parser.
 *
 * Safety:
 *   Idempotent: already-PAID or already-FAILED bookings are silently ignored.
 *   Missing booking → 200 (do not crash).
 *   Malformed payload → 400.
 */

import { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '../prisma.client';
import logger from '../utils/logger';
import { EscrowStatus } from '@prisma/client';
import { createLedgerEntry } from '../services/ledger.service';

// ─── Signature verification ───────────────────────────────────────────────────

function verifyRazorpaySignature(rawBody: Buffer, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    logger.error('RazorpayX Webhook: RAZORPAY_KEY_SECRET not set');
    return false;
  }

  const expected = createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  try {
    return timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(signature, 'utf8')
    );
  } catch {
    return false;
  }
}

// ─── Webhook handler ──────────────────────────────────────────────────────────

export const handleRazorpayXWebhook = async (
  req: Request,
  res: Response
): Promise<void> => {
  // ── 1. Signature check ───────────────────────────────────────────────────
  const signature = req.headers['x-razorpay-signature'] as string | undefined;

  if (!signature) {
    logger.warn('RazorpayX Webhook: Missing X-Razorpay-Signature header');
    res.status(401).json({ success: false, message: 'Missing signature' });
    return;
  }

  // req.body is a raw Buffer (express.raw middleware applied on this route)
  const rawBody: Buffer = req.body as Buffer;

  if (!rawBody || !Buffer.isBuffer(rawBody)) {
    logger.error('RazorpayX Webhook: Raw body not available — check middleware order');
    res.status(400).json({ success: false, message: 'Invalid request body' });
    return;
  }

  if (!verifyRazorpaySignature(rawBody, signature)) {
    logger.warn('RazorpayX Webhook: Invalid signature — rejecting request');
    res.status(401).json({ success: false, message: 'Invalid signature' });
    return;
  }

  // ── 2. Parse payload ─────────────────────────────────────────────────────
  let payload: any;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    logger.error('RazorpayX Webhook: Failed to parse JSON body', { error: (err as Error).message });
    res.status(400).json({ success: false, message: 'Malformed JSON body' });
    return;
  }

  const event: string = payload?.event;
  const payoutEntity = payload?.payload?.payout?.entity;
  const razorpayPayoutId: string | undefined = payoutEntity?.id;
  const amountPaise: number | undefined = payoutEntity?.amount;

  logger.info('RazorpayX Webhook: Received event', {
    event,
    payoutId: razorpayPayoutId,
    amountPaise,
  });

  // Acknowledge receipt immediately — Razorpay expects 200 within a few seconds
  res.status(200).json({ success: true });

  // ── 3. Idempotency guard — skip unknown or unsupported events ────────────
  if (event !== 'payout.processed' && event !== 'payout.failed') {
    logger.info('RazorpayX Webhook: Ignoring unhandled event', { event });
    return;
  }

  if (!razorpayPayoutId) {
    logger.warn('RazorpayX Webhook: Missing payout ID in payload', { event, payload });
    return;
  }

  // ── 4. Find the booking tied to this payout ──────────────────────────────
  const booking = await prisma.booking.findFirst({
    where: { payoutId: razorpayPayoutId },
    select: { id: true, payoutStatus: true, helperPayoutAmount: true },
  });

  if (!booking) {
    logger.warn('RazorpayX Webhook: No booking found for payoutId — ignoring', {
      event,
      payoutId: razorpayPayoutId,
    });
    return;
  }

  const bookingId = booking.id;

  // ── 5. Handle payout.processed ───────────────────────────────────────────
  if (event === 'payout.processed') {
    // Idempotent: already PAID → ignore
    if (booking.payoutStatus === 'PAID') {
      logger.info('RazorpayX Webhook: payout.processed — booking already PAID, ignoring', {
        bookingId,
        payoutId: razorpayPayoutId,
      });
      return;
    }

    if (booking.payoutStatus !== 'PROCESSING') {
      logger.warn('RazorpayX Webhook: payout.processed — unexpected payoutStatus', {
        bookingId,
        payoutId: razorpayPayoutId,
        payoutStatus: booking.payoutStatus,
      });
      return;
    }

    // Fetch the payment to release escrow
    const payment = await prisma.payment.findFirst({
      where: { bookingId },
      select: { id: true, escrowStatus: true },
    });

    if (!payment) {
      logger.error('RazorpayX Webhook: payout.processed — no payment record found', {
        bookingId,
        payoutId: razorpayPayoutId,
      });
      return;
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: bookingId },
          data: {
            payoutStatus: 'PAID',
            payoutAt: new Date(),
          },
        });

        await tx.payment.update({
          where: { id: payment.id },
          data: { escrowStatus: EscrowStatus.RELEASED },
        });

        // ── Record payout disbursement in ledger ──────────────────────────────────
        // CRITICAL: This is the ONLY place where HELPER_PAYOUT DEBIT entries are created.
        // 
        // Entry is created when payoutStatus becomes PAID (successful disbursement).
        // Ledger balance must match:
        //   CREDIT:  booking-{bookingId}  (from booking completion)
        //   DEBIT:   payout-{bookingId}   (from payout processing)
        //
        // If webhook is retried:
        // - Booking already has payoutStatus === 'PAID'
        // - Unique constraint [type, referenceId] prevents duplicate DEBIT entries
        // ────────────────────────────────────────────────────────────────────────
        const payoutAmount = booking.helperPayoutAmount ?? 0;
        if (payoutAmount > 0) {
          await createLedgerEntry(
            {
              type:        'HELPER_PAYOUT',
              direction:   'DEBIT',
              amount:      payoutAmount,
              referenceId: `payout-${bookingId}`,
              bookingId:   bookingId,
              metadata:    { razorpayPayoutId, amountPaise, event: 'payout_processed' },
            },
            tx,
          );
        }
      });

      logger.info('RazorpayX Webhook: payout.processed — booking marked PAID, escrow RELEASED', {
        bookingId,
        payoutId: razorpayPayoutId,
        amountPaise,
      });
    } catch (err) {
      logger.error('RazorpayX Webhook: payout.processed — DB transaction failed', {
        bookingId,
        payoutId: razorpayPayoutId,
        error: (err as Error).message,
      });
    }

    return;
  }

  // ── 6. Handle payout.failed ──────────────────────────────────────────────
  if (event === 'payout.failed') {
    // Idempotent: already FAILED → ignore
    if (booking.payoutStatus === 'FAILED') {
      logger.info('RazorpayX Webhook: payout.failed — already FAILED, ignoring', {
        bookingId,
        payoutId: razorpayPayoutId,
      });
      return;
    }

    if (booking.payoutStatus !== 'PROCESSING') {
      logger.warn('RazorpayX Webhook: payout.failed — unexpected payoutStatus', {
        bookingId,
        payoutId: razorpayPayoutId,
        payoutStatus: booking.payoutStatus,
      });
      return;
    }

    try {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { payoutStatus: 'FAILED' },
        // escrow intentionally left LOCKED — manual review required
      });

      logger.warn('RazorpayX Webhook: payout.failed — booking marked FAILED, escrow remains LOCKED', {
        bookingId,
        payoutId: razorpayPayoutId,
        amountPaise,
        failureReason: payoutEntity?.failure_reason ?? 'unknown',
      });
    } catch (err) {
      logger.error('RazorpayX Webhook: payout.failed — DB update failed', {
        bookingId,
        payoutId: razorpayPayoutId,
        error: (err as Error).message,
      });
    }
  }
};
