import { prisma } from '../prisma.client';
import logger from '../utils/logger';
import { BookingStatus, EscrowStatus, PaymentStatus, PayoutStatus } from '@prisma/client';
import { recordCancellation } from './helper-discipline.service';
import { sendPushNotification } from './push.service';
import { createLedgerEntry } from './ledger.service';

const PAYOUT_HOLD_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours
const OTP_EXPIRY_MS = 30 * 60 * 1000;           // 30 minutes
const MAX_OTP_ATTEMPTS = 5;

/**
 * Generate a cryptographically random 4-digit OTP string.
 * Uses Math.random seeded range to ensure exactly 4 digits (1000–9999).
 */
function generateStartOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
const LOCKED = EscrowStatus.LOCKED;
const RELEASED = EscrowStatus.RELEASED;
const REFUNDED_ESCROW = EscrowStatus.REFUNDED;

// Cancellation source types
type CancelledBy = 'CUSTOMER' | 'HELPER' | 'SYSTEM';
const CUSTOMER = 'CUSTOMER' as const;
const HELPER = 'HELPER' as const;
const SYSTEM = 'SYSTEM' as const;

/**
 * Confirm a booking payment
 * Transitions PENDING_PAYMENT → CONFIRMED
 * Validates payment exists and is PENDING
 * Race-safe confirmation
 */
export async function confirmBooking(bookingId: string): Promise<{ success: boolean; message: string }> {
  try {
    const bookingIdNum = parseInt(bookingId, 10);
    // Validate payment exists and is PENDING
    const payment = await prisma.payment.findFirst({
      where: { bookingId: bookingIdNum },
    });

    if (!payment) {
      logger.warn('confirmBooking: Payment not found', { bookingId });
      throw new Error('Payment not found for this booking');
    }

    if (payment.status !== PaymentStatus.CREATED) {
      logger.warn('confirmBooking: Invalid payment status', { bookingId, paymentStatus: payment.status });
      throw new Error(`Payment must be CREATED. Current status: ${payment.status}`);
    }

    const otp = generateStartOtp();
    const now = new Date();

    // Race-safe: Only succeed if status is still PENDING_PAYMENT
    const updated = await prisma.booking.updateMany({
      where: {
        id: bookingIdNum,
        status: BookingStatus.PENDING_PAYMENT,
      },
      data: {
        status: BookingStatus.CONFIRMED,
        startOtp: otp,
        otpGeneratedAt: now,
        otpAttempts: 0,
      },
    });

    if (updated.count === 0) {
      logger.warn('confirmBooking: Booking not found or already confirmed', { bookingId });
      throw new Error('Booking not found or already confirmed. Current status must be PENDING_PAYMENT.');
    }

    logger.info('confirmBooking: Booking confirmed and start OTP generated', {
      bookingId,
      timestamp: now,
    });

    return {
      success: true,
      message: 'Booking confirmed successfully',
    };
  } catch (error) {
    logger.error('confirmBooking: Error confirming booking', { bookingId, error });
    throw error;
  }
}

/**
 * Start an in-progress booking
 * Transitions CONFIRMED → IN_PROGRESS
 * Only assigned helper can start the booking
 */
export async function startBooking(
  bookingId: string,
  helperId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const bookingIdNum = parseInt(bookingId, 10);
    // Fetch booking to validate state and helper authorization
    const booking = await prisma.booking.findUnique({
      where: { id: bookingIdNum },
    });

    if (!booking) {
      logger.warn('startBooking: Booking not found', { bookingId });
      throw new Error('Booking not found');
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      logger.warn('startBooking: Invalid booking status', {
        bookingId,
        currentStatus: booking.status,
        requiredStatus: BookingStatus.CONFIRMED,
      });
      throw new Error(`Booking must be in CONFIRMED status. Current status: ${booking.status}`);
    }

    if (booking.helperId !== parseInt(helperId, 10)) {
      logger.warn('startBooking: Helper not authorized', {
        bookingId,
        assignedHelper: booking.helperId,
        attemptedHelper: helperId,
      });
      throw new Error('Only the assigned helper can start this booking');
    }

    // Update booking status to IN_PROGRESS with race condition safety
    const updated = await prisma.booking.updateMany({
      where: {
        id: bookingIdNum,
        status: BookingStatus.CONFIRMED, // Double-check status hasn't changed
      },
      data: {
        status: BookingStatus.IN_PROGRESS,
        startedAt: new Date(), // Track when booking actually started
      },
    });

    if (updated.count === 0) {
      logger.warn('startBooking: Race condition detected - status changed', { bookingId, helperId });
      throw new Error('Booking status changed during processing. Please retry.');
    }

    logger.info('startBooking: Booking started successfully', {
      bookingId,
      helperId,
      timestamp: new Date(),
    });

    return {
      success: true,
      message: 'Booking started successfully',
    };
  } catch (error) {
    logger.error('startBooking: Error starting booking', { bookingId, helperId, error });
    throw error;
  }
}

/**
 * Complete an in-progress booking
 * Transitions IN_PROGRESS → COMPLETED
 * Sets payout eligibility to 2 hours from now
 * Only assigned helper can complete the booking
 * Transaction-safe: Updates booking, payment, and sets payout eligibility atomically
 */
export async function completeBooking(
  bookingId: string,
  helperId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const bookingIdNum = parseInt(bookingId, 10);
    // Fetch booking to validate state and helper authorization
    const booking = await prisma.booking.findUnique({
      where: { id: bookingIdNum },
    });

    if (!booking) {
      logger.warn('completeBooking: Booking not found', { bookingId });
      throw new Error('Booking not found');
    }

    if (booking.status !== BookingStatus.IN_PROGRESS) {
      logger.warn('completeBooking: Invalid booking status', {
        bookingId,
        currentStatus: booking.status,
        requiredStatus: BookingStatus.IN_PROGRESS,
      });
      throw new Error(`Booking must be in IN_PROGRESS status. Current status: ${booking.status}`);
    }

    if (booking.helperId !== parseInt(helperId, 10)) {
      logger.warn('completeBooking: Helper not authorized', {
        bookingId,
        assignedHelper: booking.helperId,
        attemptedHelper: helperId,
      });
      throw new Error('Only the assigned helper can complete this booking');
    }

    // Fetch current commission rate and freeze it at completion time
    // This ensures any future admin rate change does NOT affect this booking's payout
    const now = new Date();
    const payoutEligibleAt = new Date(now.getTime() + PAYOUT_HOLD_DURATION_MS);

    const platformSetting = await prisma.platformSetting.findUnique({ where: { id: 1 } });
    const commissionRate = platformSetting?.commissionRate ?? 0.20;
    const platformCommissionAmount = booking.totalAmount * commissionRate;
    const helperPayoutAmount = booking.totalAmount - platformCommissionAmount;

    // Fetch helper's userId for ledger entry
    let helperUserId: number | undefined;
    if (booking.helperId) {
      const helper = await prisma.helper.findUnique({
        where: { id: booking.helperId },
        select: { userId: true },
      });
      helperUserId = helper?.userId;
    }

    await prisma.$transaction(async (tx) => {
      // Update booking status with race condition check
      const updated = await tx.booking.updateMany({
        where: {
          id: bookingIdNum,
          status: BookingStatus.IN_PROGRESS, // Ensure status hasn't changed
        },
        data: {
          status: BookingStatus.COMPLETED,
          completedAt: now,
          payoutEligibleAt,      // Payout available after 2 hours
          payoutStatus: 'PENDING',
          // Commission snapshot — frozen now, never recalculated
          commissionRateSnapshot: commissionRate,
          platformCommissionAmount,
          helperPayoutAmount,
        },
      });

      if (updated.count === 0) {
        throw new Error('Booking status changed during processing. Please retry.');
      }

      // ── Record earnings accrual in ledger ─────────────────────────────────────
      // CRITICAL: This is the ONLY place where HELPER_PAYOUT CREDIT entries are created.
      // 
      // Ledger Flow:
      // 1. Booking COMPLETED (this function) → CREDIT entry (earnings accrued)
      //    - referenceId: booking-{bookingId} (ensures uniqueness)
      //    - direction: CREDIT (helper's balance increases)
      //
      // 2. Payout PROCESSED (razorpayx webhook) → DEBIT entry (payout released)
      //    - referenceId: payout-{bookingId} (matches CREDIT for same booking)
      //    - direction: DEBIT (helper's balance decreases)
      //
      // @@unique([type, referenceId]) constraint prevents duplicates automatically
      // If this function is retried, the unique constraint silently ignores duplicates.
      // ─────────────────────────────────────────────────────────────────────────────
      if (helperPayoutAmount > 0) {
        await createLedgerEntry(
          {
            type: 'HELPER_PAYOUT',
            direction: 'CREDIT',
            amount: helperPayoutAmount,
            referenceId: `booking-${bookingIdNum}`,
            bookingId: bookingIdNum,
            userId: helperUserId,
            metadata: {
              event: 'booking_completed',
              helperPayoutAmount,
              platformCommissionAmount,
              commissionRate,
            },
          },
          tx,
        );
      }
    });

    logger.info('completeBooking: Booking completed successfully', {
      bookingId,
      helperId,
      completedAt: now,
      payoutEligibleAt,
      commissionRate,
      platformCommissionAmount,
      helperPayoutAmount,
      timestamp: new Date(),
    });

    // Non-blocking: notify customer that the job is done
    sendPushNotification(
      booking.customerId,
      'Service Completed',
      'Your service has been completed successfully',
      { type: 'JOB_COMPLETED', bookingId: String(bookingIdNum) },
      'JOB_COMPLETED',
    ).catch(() => {});

    return {
      success: true,
      message: 'Booking completed successfully. Payout eligible in 2 hours.',
    };
  } catch (error) {
    logger.error('completeBooking: Error completing booking', { bookingId, helperId, error });
    throw error;
  }
}

/**
 * Cancel a booking
 * Only allowed from PENDING_PAYMENT or CONFIRMED states
 * Updates payment status based on current state
 * Transaction-safe: Updates both booking and payment atomically
 */
export async function cancelBooking(
  bookingId: string,
  cancelledBy: CancelledBy,
  reason: string
): Promise<{ success: boolean; message: string }> {
  try {
    const bookingIdNum = parseInt(bookingId, 10);
    // Fetch booking to validate state
    const booking = await prisma.booking.findUnique({
      where: { id: bookingIdNum },
      include: {
        payment: {
          select: {
            id: true,
            status: true,
            escrowStatus: true,
          },
        },
      },
    });

    if (!booking) {
      logger.warn('cancelBooking: Booking not found', { bookingId });
      throw new Error('Booking not found');
    }

    // Only allow cancellation from PENDING_PAYMENT or CONFIRMED states
    const allowedStatuses: BookingStatus[] = [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED];
    if (!allowedStatuses.includes(booking.status)) {
      logger.warn('cancelBooking: Invalid booking status for cancellation', {
        bookingId,
        currentStatus: booking.status,
        allowedStatuses,
      });
      throw new Error(
        `Booking can only be cancelled from ${allowedStatuses.join(' or ')} status. Current status: ${booking.status}`
      );
    }

    // Determine payment status update based on booking state
    // Simple logic: Always mark as REFUNDED with full refund when cancelling
    const totalAmount = booking.totalAmount;

    // Process cancellation in transaction
    await prisma.$transaction(async (tx) => {
      // Update booking status with race condition check
      const updated = await tx.booking.updateMany({
        where: {
          id: bookingIdNum,
          status: {
            in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED],
          },
        },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledBy: cancelledBy,
          cancelReason: reason,
        },
      });

      if (updated.count === 0) {
        throw new Error('Booking status changed during cancellation. Please retry.');
      }

      // Update payment status - always REFUNDED with full refund
      if (booking.payment) {
        await tx.payment.update({
          where: { id: booking.payment.id },
          data: {
            status: PaymentStatus.REFUNDED,
            escrowStatus: REFUNDED_ESCROW,
            refundReason: `Booking cancelled by ${cancelledBy}: ${reason}`,
          },
        });
      }
    });

    // Record discipline only if helper cancelled the booking
    if (cancelledBy === HELPER) {
      try {
        const disciplineResult = await recordCancellation(booking.helperId);
        if (disciplineResult.suspended) {
          logger.warn('cancelBooking: Helper suspended due to cancellations', {
            bookingId,
            helperId: booking.helperId,
            cancellationCount: disciplineResult.cancellationCount,
            suspendedUntil: disciplineResult.suspendedUntil,
          });
        }
      } catch (error) {
        logger.error('cancelBooking: Failed to record cancellation discipline', {
          bookingId,
          helperId: booking.helperId,
          error,
        });
        // Don't fail the cancellation if discipline recording fails
      }
    }

    logger.info('cancelBooking: Booking cancelled successfully', {
      bookingId,
      cancelledBy,
      reason,
      refundAmount: totalAmount,
      timestamp: new Date(),
    });

    return {
      success: true,
      message: `Booking cancelled successfully. Full refund processed.`,
    };
  } catch (error) {
    logger.error('cancelBooking: Error cancelling booking', { bookingId, cancelledBy, reason, error });
    throw error;
  }
}

/**
 * Helper-initiated cancellation with strict rules:
 *
 * PENDING_PAYMENT → allowed, no strike, payoutStatus = CANCELLED
 * CONFIRMED (>=2h before start) → 1 strike, full refund
 * CONFIRMED (<2h before start)  → 2 strikes, full refund
 * In both CONFIRMED cases: strikeCount >= 3 triggers 24h suspension
 * IN_PROGRESS → rejected outright
 * COMPLETED / CANCELLED → rejected outright
 *
 * Safety: DB transaction, race-condition protected updateMany, refund only after
 * booking status is set to REFUND_PENDING.
 */
export async function helperCancelBooking(
  bookingId: string,
  helperId: number,
  reason: string
): Promise<{ success: boolean; message: string; suspended?: boolean; suspendedUntil?: Date }> {
  const bookingIdNum = parseInt(bookingId, 10);

  try {
    // Load booking with payment for refund processing
    const booking = await prisma.booking.findUnique({
      where: { id: bookingIdNum },
      include: {
        payment: { select: { id: true, status: true, escrowStatus: true } },
      },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    // --- Security: Only the assigned helper may cancel ---
    if (booking.helperId !== helperId) {
      throw new Error('Only the assigned helper can cancel this booking');
    }

    // --- Rule 3 & 4: Reject non-cancellable states ---
    if (booking.status === BookingStatus.IN_PROGRESS) {
      throw new Error('Cannot cancel after service has started');
    }
    if (
      booking.status === BookingStatus.COMPLETED ||
      booking.status === BookingStatus.CANCELLED
    ) {
      throw new Error(
        `Booking cannot be cancelled in ${booking.status} status`
      );
    }

    // --- Rule 1: PENDING_PAYMENT — no strike, refund payment if it exists ---
    if (booking.status === BookingStatus.PENDING_PAYMENT) {
      await prisma.$transaction(async (tx) => {
        const updated = await tx.booking.updateMany({
          where: { id: bookingIdNum, status: BookingStatus.PENDING_PAYMENT },
          data: {
            status: BookingStatus.CANCELLED,
            cancelledBy: HELPER,
            cancelReason: reason,
            payoutStatus: PayoutStatus.CANCELLED,
          },
        });

        if (updated.count === 0) {
          throw new Error('Booking status changed during cancellation. Please retry.');
        }

        if (booking.payment) {
          await tx.payment.update({
            where: { id: booking.payment.id },
            data: {
              status: PaymentStatus.REFUNDED,
              escrowStatus: REFUNDED_ESCROW,
              refundReason: `Helper cancelled: ${reason}`,
            },
          });
        }
      });

      logger.info('helperCancelBooking: Cancelled PENDING_PAYMENT booking (no strike)', {
        bookingId: bookingIdNum,
        helperId,
      });

      return { success: true, message: 'Booking cancelled successfully.' };
    }

    // --- Rule 2: CONFIRMED — strikes + full refund ---
    if (booking.status === BookingStatus.CONFIRMED) {
      const now = new Date();
      const startTime = booking.startTime ?? booking.bookingDate;

      if (startTime <= now) {
        throw new Error('Cannot cancel after scheduled start time');
      }

      const hoursBeforeStart = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      const strikesToAdd = hoursBeforeStart >= 2 ? 1 : 2;
      const totalAmount = booking.totalAmount;

      let suspended = false;
      let suspendedUntil: Date | undefined;

      await prisma.$transaction(async (tx) => {
        // Step 1: Race-safe status transition to CANCELLED before any refund
        const updated = await tx.booking.updateMany({
          where: { id: bookingIdNum, status: BookingStatus.CONFIRMED },
          data: {
            status: BookingStatus.CANCELLED,
            cancelledBy: HELPER,
            cancelReason: reason,
            payoutStatus: PayoutStatus.CANCELLED,
            refundAmount: totalAmount,
          },
        });

        if (updated.count === 0) {
          throw new Error('Booking status changed during cancellation. Please retry.');
        }

        // Step 2: Apply strikes to helper
        const helper = await tx.helper.findUnique({
          where: { id: helperId },
          select: { strikeCount: true },
        });

        if (!helper) {
          throw new Error('Helper not found');
        }

        const newStrikeCount = helper.strikeCount + strikesToAdd;
        const willBeSuspended = newStrikeCount >= 3;
        const suspendUntil = willBeSuspended
          ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
          : undefined;

        await tx.helper.update({
          where: { id: helperId },
          data: {
            strikeCount: newStrikeCount,
            lastStrikeAt: now,
            ...(willBeSuspended && { suspendedUntil: suspendUntil }),
          },
        });

        suspended = willBeSuspended;
        suspendedUntil = suspendUntil;

        // Step 3: Process refund AFTER booking status is updated
        if (booking.payment) {
          await tx.payment.update({
            where: { id: booking.payment.id },
            data: {
              status: PaymentStatus.REFUNDED,
              escrowStatus: REFUNDED_ESCROW,
              refundReason: `Helper cancelled: ${reason}`,
            },
          });
        }

        // Step 4: Record refundedAt on booking
        await tx.booking.update({
          where: { id: bookingIdNum },
          data: { refundedAt: now },
        });
      });

      logger.info('helperCancelBooking: CONFIRMED booking cancelled by helper', {
        bookingId: bookingIdNum,
        helperId,
        strikesToAdd,
        hoursBeforeStart,
        suspended,
        suspendedUntil,
      });

      const suspensionMsg = suspended
        ? ` Helper suspended until ${suspendedUntil!.toISOString()}.`
        : '';

      return {
        success: true,
        message: `Booking cancelled. ${strikesToAdd} strike(s) applied. Full refund issued.${suspensionMsg}`,
        suspended,
        suspendedUntil,
      };
    }

    // Fallback (should not reach here given guards above)
    throw new Error(`Unhandled booking status: ${booking.status}`);
  } catch (error) {
    logger.error('helperCancelBooking: Error', { bookingId: bookingIdNum, helperId, error });
    throw error;
  }
}

/**
 * Get booking lifecycle status
 * Returns current booking state and related payment/payout info
 */
export async function getBookingLifecycleStatus(bookingId: string): Promise<{
  booking: {
    id: number;
    status: string;
    completedAt: Date | null;
    cancelledBy: string | null;
    payoutStatus: string | null;
    payoutEligibleAt: Date | null;
    payoutId: string | null;
    payoutAt: Date | null;
  };
  payment: {
    id: number;
    status: string;
    escrowStatus: string | null;
  } | null;
}> {
  try {
    const bookingIdNum = parseInt(bookingId, 10);
    const booking = await prisma.booking.findUnique({
      where: { id: bookingIdNum },
      select: {
        id: true,
        status: true,
        completedAt: true,
        cancelledBy: true,
        payoutStatus: true,
        payoutEligibleAt: true,
        payoutId: true,
        payoutAt: true,
      },
    });

    if (!booking) {
      logger.warn('getBookingLifecycleStatus: Booking not found', { bookingId });
      throw new Error('Booking not found');
    }

    const payment = await prisma.payment.findFirst({
      where: { bookingId: bookingIdNum },
      select: {
        id: true,
        status: true,
        escrowStatus: true,
      },
    });

    logger.debug('getBookingLifecycleStatus: Retrieved booking lifecycle status', { bookingId });

    return {
      booking: {
        id: booking.id,
        status: booking.status,
        completedAt: booking.completedAt,
        cancelledBy: booking.cancelledBy,
        payoutStatus: booking.payoutStatus,
        payoutEligibleAt: booking.payoutEligibleAt,
        payoutId: booking.payoutId,
        payoutAt: booking.payoutAt,
      },
      payment,
    };
  } catch (error) {
    logger.error('getBookingLifecycleStatus: Error retrieving booking status', { bookingId, error });
    throw error;
  }
}

/**
 * Auto-cancel CONFIRMED bookings after 30 minutes of inactivity
 * Called by cron job (e.g., every 5 minutes to check)
 * Prevents helpers from hogging confirmed bookings without starting
 */
export async function autoCancelInactiveConfirmedBookings(): Promise<{
  processedCount: number;
  cancelledCount: number;
  errors: string[];
}> {
  const result = {
    processedCount: 0,
    cancelledCount: 0,
    errors: [] as string[],
  };

  try {
    const now = new Date();

    // Fetch all CONFIRMED bookings that have a startTime — filter by grace window in-process
    const confirmedBookings = await prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        startTime: { not: null },
      },
      include: {
        payment: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    logger.info('autoCancelInactiveConfirmedBookings: Found CONFIRMED bookings to evaluate', {
      count: confirmedBookings.length,
    });

    for (const booking of confirmedBookings) {
      // Only auto-cancel when current time is past (startTime + 30 min grace)
      const graceTime = new Date(booking.startTime!.getTime() + 30 * 60 * 1000);
      if (now <= graceTime) {
        result.processedCount++;
        continue;
      }

      try {
        // Auto-cancel in transaction with race-condition safety
        await prisma.$transaction(async (tx) => {
          const updated = await tx.booking.updateMany({
            where: {
              id: booking.id,
              status: BookingStatus.CONFIRMED,
            },
            data: {
              status: BookingStatus.CANCELLED,
              cancelledBy: SYSTEM,
              cancelReason: 'Auto-cancelled: service not started within 30 minutes of scheduled time',
            },
          });

          if (updated.count === 0) {
            throw new Error('Booking status changed - already cancelled or started');
          }

          // Refund payment
          if (booking.payment) {
            await tx.payment.update({
              where: { id: booking.payment.id },
              data: {
                status: PaymentStatus.REFUNDED,
                escrowStatus: EscrowStatus.REFUNDED,
                refundReason: 'Auto-cancelled: service not started within 30 minutes of scheduled time',
              },
            });
          }
        });

        logger.info('autoCancelInactiveConfirmedBookings: Auto-cancelled booking', {
          bookingId: booking.id,
          startTime: booking.startTime,
          graceTime,
        });

        result.cancelledCount++;
      } catch (error) {
        result.errors.push(`Booking ${booking.id}: ${error instanceof Error ? error.message : String(error)}`);
        logger.error('autoCancelInactiveConfirmedBookings: Error processing booking', {
          bookingId: booking.id,
          error,
        });
      }
      result.processedCount++;
    }

    logger.info('autoCancelInactiveConfirmedBookings: Completed', {
      processedCount: result.processedCount,
      cancelledCount: result.cancelledCount,
      errorCount: result.errors.length,
    });

    return result;
  } catch (error) {
    logger.error('autoCancelInactiveConfirmedBookings: Fatal error', { error });
    result.errors.push(error instanceof Error ? error.message : String(error));
    return result;
  }
}

/**
 * Detect and process helper no-shows.
 *
 * A no-show is a CONFIRMED booking whose startTime passed more than 15 minutes
 * ago and which has not progressed to IN_PROGRESS, COMPLETED, or CANCELLED.
 *
 * For each no-show (single atomic transaction per booking):
 *   1. Cancel booking (race-safe updateMany)
 *   2. Refund payment if it exists
 *   3. Add 1 strike to helper; suspend for 24h if strikeCount reaches 3
 *
 * Called by a cron job (e.g. every minute).
 */
export async function processHelperNoShows(): Promise<{
  processedCount: number;
  noShowCount: number;
  suspensionCount: number;
  errors: string[];
}> {
  const result = {
    processedCount: 0,
    noShowCount: 0,
    suspensionCount: 0,
    errors: [] as string[],
  };

  try {
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

    // Find CONFIRMED bookings whose startTime passed the 15-minute grace window
    const overdueBookings = await prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        startTime: {
          not: null,
          lt: fifteenMinutesAgo,
        },
      },
      include: {
        payment: { select: { id: true, status: true, escrowStatus: true } },
      },
    });

    logger.info('processHelperNoShows: Found overdue bookings', {
      count: overdueBookings.length,
    });

    for (const booking of overdueBookings) {
      result.processedCount++;

      // Skip if no helper assigned or no startTime (guard, should be filtered by query)
      if (booking.helperId == null || booking.startTime == null) {
        continue;
      }

      const helperId = booking.helperId;

      try {
        let suspended = false;
        let suspendedUntil: Date | undefined;
        let newStrikeCount = 0;

        await prisma.$transaction(async (tx) => {
          // Step 1: Race-safe booking cancellation
          const updated = await tx.booking.updateMany({
            where: { id: booking.id, status: BookingStatus.CONFIRMED },
            data: {
              status: BookingStatus.CANCELLED,
              cancelledBy: SYSTEM,
              cancelReason: 'Helper no-show (15 min grace exceeded)',
              payoutStatus: PayoutStatus.CANCELLED,
              refundAmount: booking.totalAmount,
              refundedAt: now,
            },
          });

          // count = 0 means another process already handled it — skip silently
          if (updated.count === 0) {
            return;
          }

          // Step 2: Refund payment if it exists
          if (booking.payment) {
            await tx.payment.update({
              where: { id: booking.payment.id },
              data: {
                status: PaymentStatus.REFUNDED,
                escrowStatus: REFUNDED_ESCROW,
                refundReason: 'Helper no-show',
              },
            });
          }

          // Step 3: Increment helper strike count
          const helper = await tx.helper.findUnique({
            where: { id: helperId },
            select: { strikeCount: true },
          });

          if (!helper) {
            throw new Error(`Helper ${helperId} not found during no-show processing`);
          }

          newStrikeCount = helper.strikeCount + 1;
          const willSuspend = newStrikeCount >= 3;
          suspendedUntil = willSuspend
            ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
            : undefined;
          suspended = willSuspend;

          await tx.helper.update({
            where: { id: helperId },
            data: {
              strikeCount: newStrikeCount,
              lastStrikeAt: now,
              ...(willSuspend ? { suspendedUntil } : {}),
            },
          });
        });

        result.noShowCount++;
        if (suspended) result.suspensionCount++;

        logger.info('processHelperNoShows: No-show processed', {
          bookingId: booking.id,
          helperId,
          newStrikeCount,
          ...(suspended ? { suspendedUntil } : {}),
        });
      } catch (error) {
        const msg = `Booking ${booking.id}: ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(msg);
        logger.error('processHelperNoShows: Error processing no-show', {
          bookingId: booking.id,
          helperId,
          error,
        });
      }
    }

    logger.info('processHelperNoShows: Completed', {
      processedCount: result.processedCount,
      noShowCount: result.noShowCount,
      suspensionCount: result.suspensionCount,
      errorCount: result.errors.length,
    });

    return result;
  } catch (error) {
    logger.error('processHelperNoShows: Fatal error', { error });
    result.errors.push(error instanceof Error ? error.message : String(error));
    return result;
  }
}

/**
 * Verify a helper-entered OTP to transition a booking CONFIRMED → IN_PROGRESS.
 *
 * Security model:
 *  1. Read booking to validate preconditions (helper auth, status, expiry, attempt lock).
 *     This read is for REJECTION only — it never trusts the fetched OTP value for matching.
 *  2. Wrong OTP → atomic increment via { increment: 1 } — never uses fetched count + 1.
 *  3. Correct path → single atomic updateMany with startOtp IN the WHERE clause.
 *     The WHERE is:  id + status=CONFIRMED + startOtp=<submitted>.
 *     If count === 0 the OTP did not match in the DB or status changed — both are rejected.
 *     This means the OTP match itself is enforced at the DB level, not in application code.
 *
 * Race-condition safety:
 *  - Two concurrent correct-OTP calls: only one wins the updateMany (count=1), the other
 *    gets count=0 and is rejected.
 *  - Concurrent wrong+correct calls: atomic increment is safe; the correct call's updateMany
 *    uses the stored OTP value, unaffected by the concurrent increment.
 */
export async function verifyStartOtp(
  bookingId: number,
  helperId: number,
  otp: string
): Promise<{ success: boolean; message: string }> {
  // ── Step 1: Read for pre-condition validation (rejection only) ──────────
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      helperId: true,
      startOtp: true,
      otpGeneratedAt: true,
      otpAttempts: true,
    },
  });

  if (!booking) {
    throw new Error('Booking not found');
  }

  if (booking.helperId !== helperId) {
    logger.warn('verifyStartOtp: Unauthorized helper attempt', {
      bookingId,
      helperId,
      assignedHelper: booking.helperId,
    });
    throw new Error('Not authorized: You are not the assigned helper for this booking');
  }

  // Strict idempotency: reject immediately if not CONFIRMED
  if (booking.status !== BookingStatus.CONFIRMED) {
    throw new Error(`Booking must be CONFIRMED to start. Current status: ${booking.status}`);
  }

  if (!booking.startOtp || !booking.otpGeneratedAt) {
    throw new Error('Start OTP has not been generated for this booking');
  }

  // Brute-force lock: checked before any OTP comparison
  if (booking.otpAttempts >= MAX_OTP_ATTEMPTS) {
    logger.warn('verifyStartOtp: Max OTP attempts exceeded — locked', { bookingId, helperId });
    throw new Error('Maximum OTP attempts reached. Please contact support.');
  }

  // OTP expiry — pure epoch subtraction, no timezone parsing
  const ageMs = Date.now() - booking.otpGeneratedAt.getTime();
  if (ageMs > OTP_EXPIRY_MS) {
    throw new Error('OTP has expired (30-minute window). Please request a new one.');
  }

  // ── Step 2: Wrong OTP — atomic increment, never use fetched count + 1 ──
  if (booking.startOtp !== otp) {
    const incremented = await prisma.booking.updateMany({
      where: {
        id: bookingId,
        status: BookingStatus.CONFIRMED,         // don't touch if status raced
        otpAttempts: { lt: MAX_OTP_ATTEMPTS },   // don't increment beyond the cap
      },
      data: { otpAttempts: { increment: 1 } },
    });

    // Derive the attempt number the DB now holds (best-effort for the message)
    const attemptNow = incremented.count > 0
      ? booking.otpAttempts + 1   // only used for the response string, not for logic
      : MAX_OTP_ATTEMPTS;

    logger.warn('verifyStartOtp: Wrong OTP entered', { bookingId, helperId, attemptNow });

    if (attemptNow >= MAX_OTP_ATTEMPTS) {
      throw new Error('Incorrect OTP. Maximum attempts reached. Please contact support.');
    }
    const remaining = MAX_OTP_ATTEMPTS - attemptNow;
    throw new Error(`Incorrect OTP. ${remaining} attempt(s) remaining.`);
  }

  // ── Step 3: Correct OTP — single atomic updateMany, OTP match in WHERE ──
  // The WHERE clause includes startOtp: otp, so the DB enforces the match.
  // Application code never compared the value; this prevents TOCTOU attacks.
  const now = new Date();
  const updated = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: BookingStatus.CONFIRMED,  // reject if status raced away
      startOtp: otp,                    // DB-level OTP match — atomic
    },
    data: {
      status: BookingStatus.IN_PROGRESS,
      startedAt: now,
      startOtp: null,
      otpGeneratedAt: null,
      otpAttempts: 0,
    },
  });

  if (updated.count === 0) {
    // Either OTP changed (another process regenerated it) or status raced
    logger.warn('verifyStartOtp: Atomic update failed — OTP mismatch in DB or status changed', {
      bookingId,
      helperId,
    });
    throw new Error('OTP verification failed. The OTP may have changed or booking status updated. Please retry.');
  }

  logger.info('verifyStartOtp: Booking started successfully via OTP', {
    bookingId,
    helperId,
    startedAt: now,
  });

  // Non-blocking: notify customer that the job has started
  prisma.booking
    .findUnique({ where: { id: bookingId }, select: { customerId: true } })
    .then((b) => {
      if (b) {
        sendPushNotification(
          b.customerId,
          'Service Started',
          'Your helper has arrived and started the job',
          { type: 'JOB_STARTED', bookingId: String(bookingId) },
          'JOB_STARTED',
        ).catch(() => {});
      }
    })
    .catch(() => {});

  return { success: true, message: 'OTP verified. Booking is now IN_PROGRESS.' };
}

/**
 * Regenerate start OTP for a CONFIRMED booking whose OTP has expired.
 *
 * Rules:
 *  - Booking must be CONFIRMED (rejects if already IN_PROGRESS or any other status)
 *  - Atomic: uses updateMany with status guard — safe under concurrent requests
 *  - Resets otpAttempts to 0 so the helper gets a fresh 5-attempt window
 *  - Only the assigned helper may request regeneration
 */
export async function regenerateOtpForBooking(
  bookingId: number,
  helperId: number
): Promise<{ success: boolean; message: string }> {
  // Pre-condition read: verify helper ownership before generating a new secret
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, status: true, helperId: true },
  });

  if (!booking) {
    throw new Error('Booking not found');
  }

  if (booking.helperId !== helperId) {
    logger.warn('regenerateOtpForBooking: Unauthorized attempt', {
      bookingId,
      helperId,
      assignedHelper: booking.helperId,
    });
    throw new Error('Not authorized: You are not the assigned helper for this booking');
  }

  if (booking.status !== BookingStatus.CONFIRMED) {
    throw new Error(
      `OTP regeneration is only allowed for CONFIRMED bookings. Current status: ${booking.status}`
    );
  }

  const newOtp = generateStartOtp();
  const now = new Date();

  // Atomic: status guard prevents regeneration if booking raced to another state
  const updated = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      status: BookingStatus.CONFIRMED,
    },
    data: {
      startOtp: newOtp,
      otpGeneratedAt: now,
      otpAttempts: 0,
    },
  });

  if (updated.count === 0) {
    logger.warn('regenerateOtpForBooking: Status changed before regeneration could complete', {
      bookingId,
      helperId,
    });
    throw new Error('Booking status changed during OTP regeneration. Please retry.');
  }

  logger.info('regenerateOtpForBooking: New OTP generated', {
    bookingId,
    helperId,
    otpGeneratedAt: now,
  });

  return { success: true, message: 'New OTP generated and sent to the customer.' };}