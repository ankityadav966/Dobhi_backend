import { Request, Response } from 'express';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';
import { BookingStatus, PayoutStatus, PaymentStatus, EscrowStatus } from '@prisma/client';

/**
 * POST /api/admin/payout/:bookingId/mark-paid
 *
 * Manually marks a payout as PAID and releases escrow.
 * Admin-only. No Razorpay calls — pure DB state transition.
 */
export const markPayoutPaid = async (req: Request, res: Response): Promise<any> => {
  const bookingId = parseInt(req.params.bookingId, 10);

  if (isNaN(bookingId)) {
    return res.status(400).json({ success: false, message: 'Invalid bookingId' });
  }

  try {
    // ── 1. Fetch booking ────────────────────────────────────────────────────
    const booking = await prisma.booking.findUnique({
      where:  { id: bookingId },
      select: { id: true, status: true, payoutStatus: true },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // ── 2. Validate booking state ───────────────────────────────────────────
    if (booking.status !== BookingStatus.COMPLETED) {
      return res.status(422).json({
        success: false,
        message: `Booking must be COMPLETED to mark payout paid (current: ${booking.status})`,
      });
    }

    if (booking.payoutStatus !== PayoutStatus.PENDING) {
      return res.status(422).json({
        success: false,
        message: `Payout is already ${booking.payoutStatus} — cannot mark as PAID`,
      });
    }

    // ── 3. Fetch payment record ─────────────────────────────────────────────
    const payment = await prisma.payment.findFirst({
      where:  { bookingId },
      select: { id: true, status: true, escrowStatus: true },
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    // ── 4. Validate payment state ───────────────────────────────────────────
    if (payment.status !== PaymentStatus.CAPTURED) {
      return res.status(422).json({
        success: false,
        message: `Payment must be CAPTURED to release escrow (current: ${payment.status})`,
      });
    }

    if (payment.escrowStatus !== EscrowStatus.LOCKED) {
      return res.status(422).json({
        success: false,
        message: `Escrow must be LOCKED to release (current: ${payment.escrowStatus})`,
      });
    }

    // ── 5. Atomic transaction ───────────────────────────────────────────────
    await prisma.$transaction([
      prisma.booking.update({
        where: { id: bookingId },
        data:  { payoutStatus: PayoutStatus.PAID, payoutAt: new Date() },
      }),
      prisma.payment.update({
        where: { id: payment.id },
        data:  { escrowStatus: EscrowStatus.RELEASED },
      }),
    ]);

    logger.info('Admin: payout manually marked as PAID', { bookingId, paymentId: payment.id });

    return res.status(200).json({
      success: true,
      message: 'Payout marked as paid successfully',
    });
  } catch (error) {
    logger.error('markPayoutPaid: unexpected error', {
      bookingId,
      error: (error as Error).message,
    });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
