/**
 * payout.reconciliation.service.ts
 *
 * Daily reconciliation against RazorpayX.
 * Compares DB payoutStatus with the actual payout status from Razorpay API and
 * corrects any discrepancies caused by missed webhooks or network failures.
 *
 * State corrections:
 *   Razorpay "processed" + DB not PAID  → mark PAID, release escrow (atomic tx)
 *   Razorpay "failed"    + DB not FAILED → mark FAILED (escrow stays LOCKED)
 *   Razorpay "queued"|"processing"       → no action
 */

import Razorpay from 'razorpay';
import { prisma } from '../prisma.client';
import logger from '../utils/logger';
import { EscrowStatus } from '@prisma/client';
import { sendAlert } from './alert.service';

// ─── Env validation (fail fast at module load) ────────────────────────────────

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Payout Reconciliation: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set');
  } else {
    logger.warn('Payout Reconciliation: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET not set (running in dev mode)');
  }
}
if (!process.env.RAZORPAYX_ACCOUNT_NUMBER) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Payout Reconciliation: RAZORPAYX_ACCOUNT_NUMBER must be set');
  } else {
    logger.warn('Payout Reconciliation: RAZORPAYX_ACCOUNT_NUMBER not set (running in dev mode)');
  }
}

const razorpay = new Razorpay({
  key_id:    process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder',
});

// ─── Constants ────────────────────────────────────────────────────────────────

/** Look back this many days to avoid a full-table scan */
const LOOKBACK_DAYS = 7;

/** Payouts stuck in PROCESSING beyond this threshold are alerted (ms) */
const STUCK_THRESHOLD_MS = 12 * 60 * 60 * 1000; // 12 hours

/** Small delay between Razorpay API calls to respect rate limits (ms) */
const INTER_CALL_DELAY_MS = 300;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface ReconciliationResult {
  checkedCount:   number;
  fixedPaid:      number;
  fixedFailed:    number;
  skippedCount:   number;
  errorCount:     number;
  errors:         string[];
}

export async function reconcilePayouts(): Promise<ReconciliationResult> {
  logger.info('Payout Reconciliation: started');

  const result: ReconciliationResult = {
    checkedCount: 0,
    fixedPaid:    0,
    fixedFailed:  0,
    skippedCount: 0,
    errorCount:   0,
    errors:       [],
  };

  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - LOOKBACK_DAYS);

  // Fetch PROCESSING + FAILED bookings that have a payoutId, within the lookback window
  const bookings = await prisma.booking.findMany({
    where: {
      payoutStatus: { in: ['PROCESSING', 'FAILED'] },
      payoutId:     { not: null },
      createdAt:    { gte: lookbackDate },
    },
    select: {
      id:           true,
      payoutId:     true,
      payoutStatus: true,
      payoutAt:     true,
      createdAt:    true,
    },
  });

  logger.info(`Payout Reconciliation: found ${bookings.length} bookings to check`);

  for (const booking of bookings) {
    result.checkedCount++;

    const bookingId  = booking.id;
    const payoutId   = booking.payoutId!; // non-null: guaranteed by query filter

    try {
      // ── Fetch live payout status from Razorpay ───────────────────────────
      const payout = await (razorpay as any).payouts.fetch(payoutId);
      const razorpayStatus: string = payout?.status ?? '';

      logger.info('Payout Reconciliation: checked booking', {
        bookingId,
        payoutId,
        dbStatus:       booking.payoutStatus,
        razorpayStatus,
      });

      // ── processed → ensure PAID + escrow RELEASED ───────────────────────
      if (razorpayStatus === 'processed') {
        if (booking.payoutStatus === 'PAID') {
          // Already correct — idempotent skip
          result.skippedCount++;
        } else {
          const payment = await prisma.payment.findFirst({
            where:  { bookingId },
            select: { id: true },
          });

          if (!payment) {
            const msg = `Booking ${bookingId}: no payment record found — cannot release escrow`;
            logger.error(`Payout Reconciliation: ${msg}`);
            result.errors.push(msg);
            result.errorCount++;
          } else {
            // processed_at from Razorpay is a Unix timestamp (seconds)
            const payoutAt = payout.processed_at
              ? new Date(payout.processed_at * 1000)
              : new Date();

            await prisma.$transaction([
              prisma.booking.update({
                where: { id: bookingId },
                data:  { payoutStatus: 'PAID', payoutAt },
              }),
              prisma.payment.update({
                where: { id: payment.id },
                data:  { escrowStatus: EscrowStatus.RELEASED },
              }),
            ]);

            logger.info('Payout Reconciliation: fixed → PAID + escrow RELEASED', {
              bookingId,
              payoutId,
              payoutAt,
              previousDbStatus: booking.payoutStatus,
            });
            result.fixedPaid++;
          }
        }
      }

      // ── failed → ensure FAILED (escrow stays LOCKED) ────────────────────
      else if (razorpayStatus === 'failed') {
        if (booking.payoutStatus === 'FAILED') {
          result.skippedCount++;
        } else {
          await prisma.booking.update({
            where: { id: bookingId },
            data:  { payoutStatus: 'FAILED' },
          });

          logger.warn('Payout Reconciliation: fixed → FAILED (escrow remains LOCKED)', {
            bookingId,
            payoutId,
            previousDbStatus:   booking.payoutStatus,
            failureReason:      payout?.failure_reason ?? 'unknown',
          });
          result.fixedFailed++;
        }
      }

      // ── queued / processing → no action, but alert if stuck ────────────────
      else {
        logger.info('Payout Reconciliation: payout still in-flight, no action', {
          bookingId,
          payoutId,
          razorpayStatus,
        });

        // Alert if PROCESSING with no payoutAt and created > 12 hours ago
        if (
          booking.payoutStatus === 'PROCESSING' &&
          !(booking as any).payoutAt &&
          (booking as any).createdAt &&
          Date.now() - new Date((booking as any).createdAt as Date).getTime() > STUCK_THRESHOLD_MS
        ) {
          sendAlert('PAYOUT_STUCK', {
            bookingId,
            payoutId,
            payoutStatus:   booking.payoutStatus,
            createdAt:      (booking as any).createdAt,
            stuckForHours:  Math.floor((Date.now() - new Date((booking as any).createdAt as Date).getTime()) / 3600000),
          }).catch(() => {});
        }

        result.skippedCount++;
      }
    } catch (err) {
      const msg = `Booking ${bookingId} (payoutId: ${payoutId}): ${
        err instanceof Error ? err.message : String(err)
      }`;
      logger.error('Payout Reconciliation: error checking booking', {
        bookingId,
        payoutId,
        error: (err as Error).message,
      });
      result.errors.push(msg);
      result.errorCount++;
    }

    // Throttle to avoid hitting Razorpay rate limits
    if (result.checkedCount < bookings.length) {
      await sleep(INTER_CALL_DELAY_MS);
    }
  }

  logger.info('Payout Reconciliation: completed', {
    checkedCount: result.checkedCount,
    fixedPaid:    result.fixedPaid,
    fixedFailed:  result.fixedFailed,
    skippedCount: result.skippedCount,
    errorCount:   result.errorCount,
  });

  return result;
}
