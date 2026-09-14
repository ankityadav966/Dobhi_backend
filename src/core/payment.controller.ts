import { Response } from 'express';
import { prisma } from '../prisma.client';
import { BookingStatus, EscrowStatus, PaymentStatus } from '@prisma/client';
import logger from '../utils/logger';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { createRazorpayOrder } from '../services/razorpay.service';
import { createLedgerEntry } from '../services/ledger.service';

export const createRazorpayOrderController = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { bookingId } = req.body;
    const bookingIdNum = parseInt(bookingId, 10);
    const currentUserId = parseInt(req.user.userId, 10);

    const booking = await prisma.booking.findUnique({ where: { id: bookingIdNum } });

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.customerId !== currentUserId) return res.status(403).json({ success: false, message: 'Unauthorized - booking does not belong to you' });

    logger.info('createRazorpayOrderController: Creating Razorpay order', {
      bookingId: bookingIdNum,
      customerId: currentUserId,
      amount: booking.totalAmount,
    });

    const orderData = await createRazorpayOrder(String(bookingIdNum));

    logger.info('createRazorpayOrderController: Order created successfully', {
      bookingId: bookingIdNum,
      orderId: orderData.orderId,
      amount: orderData.amount,
    });

    return res.json({
      success: true,
      message: 'Razorpay order created successfully',
      data: {
        paymentId: bookingIdNum,
        orderId: orderData.orderId,
        amount: orderData.amount,
        currency: 'INR',
        keyId: orderData.keyId,
      },
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('createRazorpayOrderController: Error creating order', {
      error: errorMsg,
    });
    return res.status(400).json({ success: false, message: errorMsg });
  }
};

export const initiatePayment = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { bookingId } = req.body;
    const bookingIdNum = parseInt(bookingId, 10);
    const currentUserId = parseInt(req.user.userId, 10);

    const booking = await prisma.booking.findUnique({ where: { id: bookingIdNum } });

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.customerId !== currentUserId) return res.status(403).json({ success: false, message: 'Unauthorized' });

    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      return res.status(400).json({ success: false, message: `Cannot initiate payment for booking with status: ${booking.status}` });
    }

    const payment = await prisma.payment.findUnique({ where: { bookingId: bookingIdNum } });

    if (!payment) {
      logger.error('initiatePayment: Payment row missing for booking — data integrity issue', { bookingId: bookingIdNum });
      return res.status(500).json({ success: false, message: 'Payment record missing for this booking — data integrity issue. Contact support.' });
    }
    if (payment.status === PaymentStatus.CAPTURED) return res.status(400).json({ success: false, message: 'Cannot re-initiate payment that is already captured' });

    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.CREATED },
    });

    return res.json({ success: true, message: 'Payment initiated', data: { orderId: updatedPayment.id, amount: updatedPayment.amount, currency: 'INR' } });
  } catch (error) {
    logger.error('Initiate payment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to initiate payment' });
  }
};

export const verifyPayment = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { paymentId, razorpayOrderId, razorpayPaymentId } = req.body;
    const currentUserId = parseInt(req.user.userId, 10);

    // Find payment by razorpayOrderId
    const payment = await prisma.payment.findFirst({
      where: { razorpayOrderId },
    });

    if (!payment) {
      logger.error('verifyPayment: Payment not found', { razorpayOrderId });
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    // Fetch booking to validate state
    const booking = await prisma.booking.findUnique({
      where: { id: payment.bookingId },
    });

    if (!booking) {
      logger.error('verifyPayment: Booking not found', { bookingId: payment.bookingId });
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // CRITICAL: Check customer authorization
    if (booking.customerId !== currentUserId) {
      logger.warn('verifyPayment: Unauthorized access attempt', {
        razorpayOrderId,
        customerId: booking.customerId,
        userId: currentUserId,
      });
      return res.status(403).json({ success: false, message: 'Unauthorized: You can only verify your own payments' });
    }

    // Check if already captured
    if (payment.status === PaymentStatus.CAPTURED) {
      logger.info('verifyPayment: Payment already captured (idempotent)', { razorpayOrderId });
      return res.json({ success: true, message: 'Payment already verified', data: payment });
    }

    // ── STRICT BOOKING STATE VALIDATION ──
    // Before capturing ANY payment, booking must be PENDING_PAYMENT
    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      logger.warn('verifyPayment: Booking state invalid - cannot capture payment', {
        razorpayOrderId,
        bookingId: payment.bookingId,
        bookingStatus: booking.status,
        paymentId: payment.id,
      });

      // Mark payment as FAILED if booking state is invalid
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          refundReason: `Booking status is ${booking.status}, expected PENDING_PAYMENT`,
        },
      });

      return res.status(400).json({
        success: false,
        message: `Cannot capture payment: Booking must be in PENDING_PAYMENT status. Current status: ${booking.status}`,
        errorCode: 'INVALID_BOOKING_STATE',
      });
    }

    // ── ATOMIC TRANSACTION: Update payment + booking ──
    let updatedPayment: any = null;
    await prisma.$transaction(async (tx) => {
      // Update payment status (race condition check with CREATED status)
      const paymentResult = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: PaymentStatus.CREATED, // Must be CREATED (pending)
        },
        data: {
          status: PaymentStatus.CAPTURED,
          escrowStatus: EscrowStatus.LOCKED, // Funds captured → lock escrow
          razorpayPaymentId,
        },
      });

      if (paymentResult.count === 0) {
        // Race: another process already captured
        logger.warn('verifyPayment: Race condition - payment already updated', { razorpayOrderId });
        updatedPayment = await tx.payment.findUnique({ where: { id: payment.id } });
        return;
      }

      // Update booking status to CONFIRMED (race condition check)
      const bookingResult = await tx.booking.updateMany({
        where: {
          id: payment.bookingId,
          status: BookingStatus.PENDING_PAYMENT, // Race-condition guard
        },
        data: {
          status: BookingStatus.CONFIRMED,
          startOtp: String(Math.floor(1000 + Math.random() * 9000)),
          otpGeneratedAt: new Date(),
          otpAttempts: 0,
        },
      });

      if (bookingResult.count === 0) {
        // Booking state changed during transaction
        logger.error('verifyPayment: Booking state changed during transaction', {
          razorpayOrderId,
          bookingId: payment.bookingId,
        });
        throw new Error('Booking status changed during payment verification. Please try again.');
      }

      updatedPayment = await tx.payment.findUnique({ where: { id: payment.id } });
    });

    logger.info('verifyPayment: Payment captured and booking confirmed', {
      razorpayOrderId,
      razorpayPaymentId,
      bookingId: payment.bookingId,
      amount: payment.amount,
    });

    return res.json({ success: true, message: 'Payment verified successfully', data: updatedPayment });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('verifyPayment: Error verifying payment', { error: errorMsg });
    return res.status(500).json({ success: false, message: 'Failed to verify payment' });
  }
};

export const getPaymentDetails = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { paymentId } = req.params;
    const paymentIdNum = parseInt(paymentId, 10);
    const currentUserId = parseInt(req.user.userId, 10);

    const payment = await prisma.payment.findUnique({
      where: { id: paymentIdNum },
      include: {
        booking: {
          include: {
            customer: true,
            service: { select: { name: true } },
          },
        },
      },
    });

    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });

    const user = await prisma.user.findUnique({ where: { id: currentUserId }, select: { role: true } });

    if (payment.booking.customerId !== currentUserId && user?.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Unauthorized: You can only view your own payment details' });
    }

    return res.json({ success: true, data: payment });
  } catch (error) {
    logger.error('Get payment details error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch payment details' });
  }
};

export const getPaymentHistory = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const currentUserId = parseInt(req.user.userId, 10);
    const { status, page = 1, limit = 10 } = req.query;

    const where: any = {
      booking: { customerId: currentUserId },
    };

    if (status) where.status = status as string;

    const skip = (Number(page) - 1) * Number(limit);

    const payments = await prisma.payment.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        booking: {
          include: { service: { select: { name: true } } },
        },
      },
    });

    const total = await prisma.payment.count({ where });

    return res.json({
      success: true,
      data: payments,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    logger.error('Get payment history error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch payment history' });
  }
};

export const refundPayment = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { paymentId } = req.params;
    const paymentIdNum = parseInt(paymentId, 10);
    const currentUserId = parseInt(req.user.userId, 10);

    const payment = await prisma.payment.findUnique({
      where: { id: paymentIdNum },
      include: { booking: true },
    });

    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });

    const user = await prisma.user.findUnique({ where: { id: currentUserId }, select: { role: true } });

    if (payment.booking.customerId !== currentUserId && user?.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Unauthorized: Only payment owner or admin can refund' });
    }

    if (payment.status !== PaymentStatus.CAPTURED) {
      return res.status(400).json({ success: false, message: 'Only captured payments can be refunded' });
    }

    let refundedPayment;
    await prisma.$transaction(async (tx) => {
      refundedPayment = await tx.payment.update({
        where: { id: paymentIdNum },
        data: { status: PaymentStatus.REFUNDED },
      });

      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { status: BookingStatus.CANCELLED },
      });

      // Ledger: record refund disbursement
      const refundRef = `refund-${payment.razorpayPaymentId ?? payment.id}`;
      await createLedgerEntry(
        {
          type:        'REFUND_ISSUED',
          direction:   'DEBIT',
          amount:      payment.amount,
          referenceId: refundRef,
          bookingId:   payment.bookingId,
          userId:      payment.booking.customerId,
          metadata:    { paymentId: payment.id, reason: payment.refundReason ?? 'manual' },
        },
        tx,
      );

      // If helper was already paid out, record the reversal
      if (payment.booking.payoutStatus === 'PAID') {
        await createLedgerEntry(
          {
            type:        'PAYOUT_REVERSAL',
            direction:   'CREDIT',
            amount:      payment.amount,
            referenceId: `reversal-${payment.razorpayPaymentId ?? payment.id}`,
            bookingId:   payment.bookingId,
            metadata:    { paymentId: payment.id, trigger: 'refund_after_payout' },
          },
          tx,
        );
      }
    });

    return res.json({ success: true, message: 'Payment refunded successfully', data: refundedPayment });
  } catch (error) {
    logger.error('Refund payment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to refund payment' });
  }
};
