import { prisma } from '../prisma.client';
import logger from '../utils/logger';
import { BookingStatus, EscrowStatus, PaymentStatus } from '@prisma/client';
import Razorpay from 'razorpay';
import { sendAlert } from './alert.service';

// Validate required env vars at module load — fail fast before first cron tick in production
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Payout Service: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set');
  } else {
    logger.warn('Payout Service: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET not set (running in dev mode)');
  }
}
if (!process.env.RAZORPAYX_ACCOUNT_NUMBER) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Payout Service: RAZORPAYX_ACCOUNT_NUMBER must be set');
  } else {
    logger.warn('Payout Service: RAZORPAYX_ACCOUNT_NUMBER not set (running in dev mode)');
  }
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_placeholder',
});

// ─── Retry configuration ──────────────────────────────────────────────────────

const MAX_RETRIES = 3;

/**
 * Exponential backoff schedule:
 *   attempt 1 → +10 minutes
 *   attempt 2 → +1 hour
 *   attempt 3 → +6 hours
 *   beyond    → FAILED (should not reach here; caller guards with MAX_RETRIES)
 */
function calculateBackoff(attempt: number): Date {
  const offsets: Record<number, number> = {
    1: 10 * 60 * 1000,         // 10 minutes
    2: 60 * 60 * 1000,         // 1 hour
    3: 6 * 60 * 60 * 1000,     // 6 hours
  };
  const offsetMs = offsets[attempt] ?? 6 * 60 * 60 * 1000;
  return new Date(Date.now() + offsetMs);
}

/** Returns true for transient network / server-side errors that are safe to retry. */
function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  // Network-level errors
  if (/ECONNRESET|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|socket hang up/i.test(msg)) return true;
  // Razorpay 5xx responses typically include the status code in the message
  if (/\b5\d{2}\b/.test(msg)) return true;
  // RazorpayX-specific transient messages
  if (/request timeout|service unavailable|temporarily unavailable/i.test(msg)) return true;
  return false;
}

/**
 * Initiates a RazorpayX payout to a helper's fund account.
 * Uses bookingId as idempotency key to prevent duplicate payouts on retry.
 *
 * @throws on API error — caller distinguishes transient vs permanent failures
 */
async function initiateRazorpayPayout(params: {
  bookingId: number;
  fundAccountId: string;   // pre-registered RazorpayX fund_account_id for this helper
  amountPaise: number;
  description: string;
}): Promise<string> {
  logger.info('Payout Service: Initiating RazorpayX payout', {
    bookingId: params.bookingId,
    fundAccountId: params.fundAccountId,
    amountPaise: params.amountPaise,
  });

  // razorpay.payouts exists at runtime; cast because SDK types omit it
  const payout = await (razorpay as any).payouts.create(
    {
      account_number: process.env.RAZORPAYX_ACCOUNT_NUMBER!,
      fund_account_id: params.fundAccountId,
      amount: params.amountPaise,
      currency: 'INR',
      mode: 'IMPS',
      purpose: 'payout',
      narration: params.description,
      queue_if_low_balance: false,
    },
    { idempotency_key: `booking-payout-${params.bookingId}` }
  );

  logger.info('Payout Service: RazorpayX payout created', {
    bookingId: params.bookingId,
    razorpayPayoutId: payout.id,
    status: payout.status,
  });

  return payout.id as string;
}

/**
 * Process pending payouts for completed bookings - PRODUCTION GRADE CONCURRENCY SAFE
 * Called by a cron job every 5 minutes
 *
 * State machine: PENDING → PROCESSING → PAID
 *                PENDING → PROCESSING → FAILED
 *
 * - payoutEligibleAt gate enforces the 2-hour hold
 * - PROCESSING lock prevents double payout from parallel cron instances
 * - Validates payment captured + escrow locked + helperBank exists before calling payout API
 * - Temporary failures revert to PENDING; permanent failures set FAILED
 * - Escrow released only inside the final atomic transaction
 */
export async function processPendingPayouts() {
  logger.info('processPendingPayouts: started');
  const result = {
    processedCount: 0,
    successCount: 0,
    failureCount: 0,
    skippedCount: 0,
    errors: [] as string[],
  };

  try {
    const now = new Date();

    // Commission rate is NOT fetched here.
    // Each booking carries its own frozen snapshot set at completion time.

    // Find all bookings past the 2-hour hold window that are ready for payout.
    // Also enforce nextRetryAt: skip bookings that are cooling down after a transient failure.
    const eligibleBookings = await prisma.booking.findMany({
      where: {
        status: BookingStatus.COMPLETED,
        payoutStatus: 'PENDING',
        payoutEligibleAt: { lte: now }, // Mandatory: enforce 2-hour hold
        // Only pick up bookings whose retry delay has elapsed (or which have never been retried)
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: now } },
        ],
      } as any, // nextRetryAt not yet in generated Prisma types — cast until `prisma generate` runs
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    logger.info('processPendingPayouts: eligible bookings count', { count: eligibleBookings.length });
    logger.info(`Payout Service: Found ${eligibleBookings.length} eligible bookings for payout`);

    for (const booking of eligibleBookings) {
      try {
        // STEP 1: CRITICAL - Try to acquire lock by transitioning PENDING → PROCESSING
        // This prevents double payout if another cron instance is processing same booking
        const lockedBooking = await prisma.booking.updateMany({
          where: {
            id: booking.id,
            payoutStatus: 'PENDING', // Only lock if still PENDING
          },
          data: {
            payoutStatus: 'PROCESSING', // Lock acquired
          },
        });

        // If count === 0, another instance already locked this booking
        if (lockedBooking.count === 0) {
          logger.info(`Payout Service: Booking ${booking.id} already locked by another instance, skipping`);
          result.skippedCount++;
          continue;
        }

        logger.info(`Payout Service: Acquired lock for booking ${booking.id}, processing payout`);

        // SAFETY: if payoutId is already set, the previous attempt may have partially succeeded.
        // Do NOT re-initiate — the reconciliation cron will detect the real status from Razorpay.
        if (booking.payoutId) {
          logger.warn(`Payout Service: Booking ${booking.id} has payoutId '${booking.payoutId}' but status PENDING — skipping retry, reconciliation will fix`, {
            bookingId: booking.id,
            payoutId: booking.payoutId,
          });
          // Keep status as PROCESSING (already locked above) so reconciliation notices it
          result.skippedCount++;
          continue;
        }

        // STEP 2: Fetch payment record for this booking
        const payment = await prisma.payment.findFirst({
          where: { bookingId: booking.id },
        });

        if (!payment) {
          const errorMsg = `Booking ${booking.id}: No payment record found`;
          logger.warn(`Payout Service: ${errorMsg}`);
          result.errors.push(errorMsg);

          // Revert lock back to PENDING - this is a temporary state (payment may be processing)
          try {
            await prisma.booking.update({
              where: { id: booking.id },
              data: { payoutStatus: 'PENDING' },
            });
            logger.info(`Payout Service: Reverted booking ${booking.id} to PENDING (temporary error)`);
          } catch (revertError) {
            logger.error(`Payout Service: Failed to revert booking ${booking.id}:`, revertError);
          }
          continue;
        }

        // STEP 3: Validate payment status and escrow before payout
        // PaymentStatus.CAPTURED is the Razorpay-confirmed payment status
        if (payment.status !== PaymentStatus.CAPTURED) {
          const errorMsg = `Booking ${booking.id}: Payment status is '${payment.status}', expected 'CAPTURED' — reverting to PENDING`;
          logger.warn(`Payout Service: ${errorMsg}`);
          result.errors.push(errorMsg);

          // Temporary — payment may still be confirming
          try {
            await prisma.booking.update({
              where: { id: booking.id },
              data: { payoutStatus: 'PENDING' },
            });
          } catch (revertError) {
            logger.error(`Payout Service: Failed to revert booking ${booking.id}:`, revertError);
          }
          continue;
        }

        if (payment.escrowStatus !== EscrowStatus.LOCKED) {
          const errorMsg = `Booking ${booking.id}: Escrow status is '${payment.escrowStatus}', expected LOCKED — reverting to PENDING`;
          logger.warn(`Payout Service: ${errorMsg}`);
          result.errors.push(errorMsg);

          // Temporary — escrow state may still be settling
          try {
            await prisma.booking.update({
              where: { id: booking.id },
              data: { payoutStatus: 'PENDING' },
            });
          } catch (revertError) {
            logger.error(`Payout Service: Failed to revert booking ${booking.id}:`, revertError);
          }
          continue;
        }

        // STEP 4: Fetch helper and bank details — permanent failure if missing
        const helper = booking.helperId
          ? await prisma.helper.findUnique({ where: { id: booking.helperId } })
          : null;

        if (!helper) {
          const errorMsg = `Booking ${booking.id}: Helper not found — marking FAILED (permanent)`;
          logger.warn(`Payout Service: ${errorMsg}`);
          result.errors.push(errorMsg);
          result.failureCount++;
          await prisma.booking.update({ where: { id: booking.id }, data: { payoutStatus: 'FAILED' } });
          sendAlert('PAYOUT_FAILED', {
            bookingId: booking.id,
            reason:    'Helper not found (permanent)',
          }).catch(() => {});
          continue;
        }

        // Guard: never attempt payout when Razorpay fund account is not yet registered.
        // payoutEnabled = false means the registration cron is pending — revert to PENDING
        // so this booking stays queued and is retried after registration succeeds.
        const helperPayoutEnabled = (helper as any).payoutEnabled as boolean | undefined;
        if (!helperPayoutEnabled) {
          logger.warn(`Payout Service: Booking ${booking.id} — Helper ${helper.id} payoutEnabled=false, fund account not yet registered. Reverting to PENDING until registration completes.`, {
            bookingId:         booking.id,
            helperId:          helper.id,
            payoutSetupStatus: (helper as any).payoutSetupStatus,
          });
          await prisma.booking.update({
            where: { id: booking.id },
            data:  { payoutStatus: 'PENDING' },
          });
          result.skippedCount++;
          continue;
        }

        const helperBank = await prisma.helperBank.findUnique({
          where: { helperId: helper.id },
        });

        if (!helperBank) {
          const errorMsg = `Booking ${booking.id}: Helper bank details not found — marking FAILED (permanent)`;
          logger.warn(`Payout Service: ${errorMsg}`);
          result.errors.push(errorMsg);
          result.failureCount++;
          await prisma.booking.update({ where: { id: booking.id }, data: { payoutStatus: 'FAILED' } });
          sendAlert('PAYOUT_FAILED', {
            bookingId: booking.id,
            helperId:  helper.id,
            reason:    'Helper bank details not found (permanent)',
          }).catch(() => {});
          continue;
        }

        // Validate that a RazorpayX fund account has been registered for this helper.
        // Without it we cannot initiate a payout — permanent failure.
        // Cast: Prisma client is regenerated after `prisma generate`; field is String? in schema.
        const fundAccountId: string | null =
          (helperBank as Record<string, unknown>).razorpayFundAccountId as string | null ?? null;
        if (!fundAccountId) {
          const errorMsg = `Booking ${booking.id}: Helper ${helper.id} has no razorpayFundAccountId — marking FAILED (permanent). Register the helper's bank account on RazorpayX first.`;
          logger.warn(`Payout Service: ${errorMsg}`);
          result.errors.push(errorMsg);
          result.failureCount++;
          await prisma.booking.update({ where: { id: booking.id }, data: { payoutStatus: 'FAILED' } });
          sendAlert('PAYOUT_FAILED', {
            bookingId: booking.id,
            helperId:  helper.id,
            reason:    'No Razorpay fund account ID (permanent) — manual registration required',
          }).catch(() => {});
          continue;
        }

        // STEP 5: Use frozen commission snapshot set at booking completion
        // Never recalculate using current global commission rate
        const totalAmount = booking.totalAmount;
        const platformCommission = booking.platformCommissionAmount;
        const helperPayoutAmount = booking.helperPayoutAmount;

        if (platformCommission == null || helperPayoutAmount == null) {
          const errorMsg = `Booking ${booking.id}: Commission snapshot missing (old booking without snapshot) — marking FAILED`;
          logger.error(`Payout Service: ${errorMsg}`);
          result.errors.push(errorMsg);
          result.failureCount++;
          await prisma.booking.update({ where: { id: booking.id }, data: { payoutStatus: 'FAILED' } });
          sendAlert('PAYOUT_FAILED', {
            bookingId: booking.id,
            helperId:  helper.id,
            reason:    'Commission snapshot missing (permanent)',
          }).catch(() => {});
          continue;
        }

        // STEP 5b: Call RazorpayX payout API — must happen BEFORE the final transaction
        // Uses bookingId as idempotency key to prevent duplicate payouts on retry
        const razorpayPayoutId = await initiateRazorpayPayout({
          bookingId: booking.id,
          fundAccountId: fundAccountId,  // non-null guaranteed by guard above
          amountPaise: Math.round(helperPayoutAmount * 100),
          description: `Zynexx payout for booking ${booking.id}`,
        });

        // STEP 6: Persist payoutId — keep status as PROCESSING.
        // DO NOT mark PAID here. DO NOT release escrow here.
        // Final PAID state + escrow release happen via the /webhook/razorpayx
        // payout.processed event to ensure the money actually arrived.
        await prisma.booking.update({
          where: { id: booking.id },
          data: { payoutId: razorpayPayoutId },
        });

        logger.info(`Payout Service: Payout initiated for booking ${booking.id} — awaiting webhook confirmation`, {
          payoutId: razorpayPayoutId,
          totalAmount: totalAmount,
          platformCommission: platformCommission,
          helperPayout: helperPayoutAmount,
        });

        result.successCount++;
        result.processedCount++;
      } catch (error) {
        result.processedCount++;

        const errorMsg = `Booking ${booking.id}: ${error instanceof Error ? error.message : String(error)}`;
        logger.error(`Payout Service: Error processing payout for booking ${booking.id}:`, error);
        result.errors.push(errorMsg);

        const transient = isTransientError(error);
        // retryCount may not be in TS types yet — cast until prisma generate is run
        const currentRetryCount: number = ((booking as any).retryCount as number) ?? 0;
        const nextAttempt = currentRetryCount + 1;

        if (transient && currentRetryCount < MAX_RETRIES) {
          // Transient failure within retry budget — schedule next attempt
          const nextRetryAt = calculateBackoff(nextAttempt);
          try {
            await prisma.booking.update({
              where: { id: booking.id },
              data: {
                payoutStatus: 'PENDING',
                ...({ retryCount: nextAttempt, lastRetryAt: now, nextRetryAt } as any),
              },
            });
            logger.warn(`Payout Service: Booking ${booking.id} — transient error, scheduled retry ${nextAttempt}/${MAX_RETRIES}`, {
              bookingId:    booking.id,
              retryCount:   nextAttempt,
              errorType:    'transient',
              nextRetryAt:  nextRetryAt.toISOString(),
              error:        error instanceof Error ? error.message : String(error),
            });
          } catch (updateError) {
            logger.error(`Payout Service: Failed to schedule retry for booking ${booking.id}:`, updateError);
          }
        } else {
          // Permanent error OR retry budget exhausted → mark FAILED
          const reason = transient ? `retry budget exhausted (${MAX_RETRIES} attempts)` : 'permanent error';
          try {
            await prisma.booking.update({
              where: { id: booking.id },
              data: {
                payoutStatus: 'FAILED',
                ...({ lastRetryAt: now } as any),
              },
            });
            logger.warn(`Payout Service: Booking ${booking.id} marked FAILED — ${reason}`, {
              bookingId:    booking.id,
              retryCount:   currentRetryCount,
              errorType:    transient ? 'transient-exhausted' : 'permanent',
              error:        error instanceof Error ? error.message : String(error),
            });
            sendAlert('PAYOUT_FAILED', {
              bookingId:  booking.id,
              retryCount: currentRetryCount,
              reason,
              error:      error instanceof Error ? error.message : String(error),
            }).catch(() => {});
          } catch (updateError) {
            logger.error(`Payout Service: Failed to mark booking ${booking.id} as FAILED:`, updateError);
          }
          result.failureCount++;
        }
      }
    }

    logger.info('Payout Service: Cron job completed', {
      processedCount: result.processedCount,
      successCount: result.successCount,
      skippedCount: result.skippedCount,
      failureCount: result.failureCount,
    });

    return result;
  } catch (error) {
    logger.error('Payout Service: Fatal error in processPendingPayouts:', error);
    result.errors.push(error instanceof Error ? error.message : String(error));
    return result;
  }
}
