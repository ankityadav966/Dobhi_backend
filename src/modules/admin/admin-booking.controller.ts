/**
 * admin-booking.controller.ts
 *
 * Admin-only booking override operations.
 * Provides the ability to cancel a booking at any stage,
 * typically after reviewing a partner-reported issue.
 *
 * Route:  POST /api/admin/bookings/:bookingId/cancel
 * Auth:   Admin only (enforced by requireAdmin middleware on the router)
 */
import { Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { prisma } from '../../prisma.client';
import { BookingStatus, PaymentStatus, EscrowStatus, PayoutStatus } from '@prisma/client';
import logger from '../../utils/logger';

// ── Validation chain ─────────────────────────────────────────────────────────

export const validateAdminCancelBooking = [
  param('bookingId')
    .isInt({ min: 1 })
    .withMessage('bookingId must be a positive integer'),
  body('reason')
    .isString()
    .notEmpty()
    .isLength({ max: 500 })
    .withMessage('reason is required (max 500 characters)'),
  body('overridePayout')
    .optional()
    .isBoolean()
    .withMessage('overridePayout must be a boolean'),
];

// ── Handler ──────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/bookings/:bookingId/cancel
 *
 * Admin override cancellation. Works on any non-terminal booking status.
 *
 * Logic:
 *  1. Fetch booking + payment record
 *  2. If already CANCELLED — return 200 (idempotent, no-op)
 *  3. Reject if in a terminal state other than CANCELLED (COMPLETED, EXPIRED)
 *  4. Atomically set:
 *       Booking.status      = CANCELLED
 *       Booking.cancelledBy = 'ADMIN'
 *       Booking.cancelReason = reason
 *  5. If payment was CAPTURED:
 *       Payment.status      = REFUNDED
 *       Payment.escrowStatus = REFUNDED
 *       Payment.refundReason = admin cancel reason
 *  6. If payout already PAID:
 *       Flag payoutReversalRequired = true in response
 *       Log prominently — finance team must perform manual reversal
 *  7. Attach open BookingIssue id (if any) for audit trail
 *
 * overridePayout (body, boolean, optional):
 *   When true, caller acknowledges a PAID payout will need manual reversal.
 *   When false (default), proceeds but still flags the reversal need.
 *   Either way, post-PAID payout reversal is a manual finance operation.
 *
 * Errors:
 *  400 — validation failure
 *  401 — unauthenticated / not admin (handled by middleware)
 *  404 — booking not found
 *  422 — booking is in a non-cancellable terminal state (COMPLETED / EXPIRED)
 *  500 — unexpected server error
 */
export const adminCancelBookingHandler = async (
  req: Request,
  res: Response
): Promise<any> => {
  // ── 1. Validate input ────────────────────────────────────────────────────
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const bookingId = parseInt(req.params.bookingId, 10);
  const { reason, overridePayout = false } = req.body as {
    reason: string;
    overridePayout?: boolean;
  };

  try {
    // ── 2. Fetch booking ───────────────────────────────────────────────────
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        cancelledBy: true,
        payoutStatus: true,
        payment: {
          select: {
            id: true,
            status: true,
            escrowStatus: true,
          },
        },
        issues: {
          select: { id: true, reason: true, notes: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // ── 3. Idempotency — already cancelled ────────────────────────────────
    if (booking.status === BookingStatus.CANCELLED) {
      logger.info('adminCancelBooking: Booking already cancelled — no-op', { bookingId });
      return res.status(200).json({
        success: true,
        message: 'Booking is already cancelled.',
        alreadyCancelled: true,
      });
    }

    // ── 4. Block terminal states that are not CANCELLED ───────────────────
    const nonCancellableStatuses: BookingStatus[] = [
      BookingStatus.COMPLETED,
      BookingStatus.EXPIRED,
    ];
    if (nonCancellableStatuses.includes(booking.status)) {
      return res.status(422).json({
        success: false,
        message: `Cannot cancel a booking with status ${booking.status}`,
      });
    }

    // ── 5. Determine payment + payout mutations ───────────────────────────
    const paymentCaptured =
      booking.payment?.status === PaymentStatus.CAPTURED;
    const payoutAlreadyPaid =
      booking.payoutStatus === PayoutStatus.PAID;

    if (payoutAlreadyPaid) {
      logger.warn(
        'adminCancelBooking: Payout already PAID — manual bank reversal required',
        { bookingId, overridePayout }
      );
    }

    // ── 6. Atomic DB update ───────────────────────────────────────────────
    await prisma.$transaction(async (tx) => {
      // Race-condition guard: only update if still in the expected non-terminal state
      const updated = await tx.booking.updateMany({
        where: {
          id: bookingId,
          status: { notIn: [BookingStatus.CANCELLED] },
        },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledBy: 'ADMIN',
          cancelReason: reason,
        },
      });

      if (updated.count === 0) {
        // Another concurrent request won the race
        throw new Error('ALREADY_CANCELLED');
      }

      // If payment was captured, mark as refunded
      if (paymentCaptured && booking.payment) {
        await tx.payment.update({
          where: { id: booking.payment.id },
          data: {
            status: PaymentStatus.REFUNDED,
            escrowStatus: EscrowStatus.REFUNDED,
            refundReason: `Admin override cancellation: ${reason}`,
          },
        });
      }

      // Auto-resolve any open issue linked to this booking
      await tx.bookingIssue.updateMany({
        where:  { bookingId, resolved: false },
        data: {
          resolved:   true,
          resolvedAt: new Date(),
          resolvedBy: 'ADMIN',
        },
      });
    });

    // ── 7. Logging ────────────────────────────────────────────────────────
    logger.info('adminCancelBooking: Booking cancelled by admin', {
      bookingId,
      reason,
      previousStatus: booking.status,
      paymentRefunded: paymentCaptured,
      payoutAlreadyPaid,
      overridePayout,
      linkedIssue: booking.issues[0] ?? null,
    });

    if (payoutAlreadyPaid) {
      logger.warn(
        'adminCancelBooking: ⚠ PAYOUT REVERSAL REQUIRED — finance team must reverse payout manually',
        { bookingId, reason }
      );
    }

    // ── 8. Response ───────────────────────────────────────────────────────
    return res.status(200).json({
      success: true,
      message: 'Booking cancelled by admin.',
      bookingId,
      previousStatus: booking.status,
      paymentRefunded: paymentCaptured,
      payoutReversalRequired: payoutAlreadyPaid,
      linkedIssue: booking.issues[0] ?? null,
    });
  } catch (error: any) {
    // Concurrent cancellation (race condition lost mid-transaction)
    if (error?.message === 'ALREADY_CANCELLED') {
      return res.status(200).json({
        success: true,
        message: 'Booking is already cancelled.',
        alreadyCancelled: true,
      });
    }

    logger.error('adminCancelBookingHandler: Unexpected error', { bookingId, error });
    return res.status(500).json({ success: false, message: 'Failed to cancel booking' });
  }
};
