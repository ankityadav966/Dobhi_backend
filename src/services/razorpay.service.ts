import axios from 'axios';
import crypto from 'crypto';
import { prisma } from '../prisma.client';
import logger from '../utils/logger';
import { BookingStatus, EscrowStatus, PaymentStatus, Prisma } from '@prisma/client';
import { createLedgerEntry } from './ledger.service';
import { emitToHelper, emitToCustomer } from '../socket/socket.service';
import { sendPushToHelperIds } from './push.service';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

/**
 * Create a Razorpay order for a booking
 * Returns order ID, amount, and key for frontend
 */
export async function createRazorpayOrder(bookingId: string): Promise<{
  orderId: string;
  amount: number;
  keyId: string;
  bookingId: number;
}> {
  try {
    // Fetch booking
    const booking = await prisma.booking.findUnique({
      where: { id: Number(bookingId) },
      include: { payment: true },
    });

    if (!booking) {
      logger.warn('createRazorpayOrder: Booking not found', { bookingId });
      throw new Error('Booking not found');
    }

    // Validate booking status
    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      logger.warn('createRazorpayOrder: Invalid booking status', {
        bookingId,
        currentStatus: booking.status,
      });
      throw new Error(`Booking must be in PENDING_PAYMENT status. Current: ${booking.status}`);
    }

    // Check if payment already exists (idempotent)
    const existingPayment = booking.payment;
    if (existingPayment?.razorpayOrderId) {
      logger.info('createRazorpayOrder: Existing order found - returning (idempotent)', {
        bookingId,
        existingOrderId: existingPayment.razorpayOrderId,
      });
      return {
        orderId: existingPayment.razorpayOrderId || '',
        amount: Number(booking.totalAmount),
        keyId: RAZORPAY_KEY_ID,
        bookingId: booking.id,
      };
    }

    // Create Razorpay order via API
    let razorpayOrderId: string;
    try {
      const orderResponse = await axios.post(
      'https://api.razorpay.com/v1/orders',
      {
        amount: Math.round(Number(booking.totalAmount) * 100), // Convert to paise
        currency: 'INR',
        receipt: String(booking.id),
        notes: {
          bookingId: booking.id,
          customerId: booking.customerId,
        },
      },
      {
        auth: {
          username: RAZORPAY_KEY_ID,
          password: RAZORPAY_KEY_SECRET,
        },
      }
      );

      razorpayOrderId = orderResponse.data.id;
      logger.info('RAZORPAY ORDER CREATED', {
        bookingId,
        razorpayOrderId,
        amount: Number(booking.totalAmount),
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('createRazorpayOrder: Razorpay API error', {
        bookingId,
        error: errorMsg,
      });
      throw new Error(`Razorpay API error: ${errorMsg}`);
    }

    // Transaction: Save order ID in payment table (race-safe)
    await prisma.$transaction(async (tx) => {
      // Check if payment exists and update
      if (existingPayment) {
        // Update only if razorpayOrderId is still null (race prevention)
        const updated = await tx.payment.updateMany({
          where: {
            id: existingPayment.id,
            razorpayOrderId: null, // Only update if not already set
          },
          data: {
            razorpayOrderId: razorpayOrderId,
          },
        });

        if (updated.count === 0) {
          // Another process already set the order ID - return it
          const latestPayment = await tx.payment.findUnique({
            where: { id: existingPayment.id },
          });

          if (latestPayment?.razorpayOrderId) {
            logger.info('createRazorpayOrder: Race detected - returning newly set order', {
              bookingId,
              newOrderId: latestPayment.razorpayOrderId,
            });
            throw new Error(`RACE_CONDITION_HANDLED:${latestPayment.razorpayOrderId}`);
          }
        } else {
          logger.info('PAYMENT SAVED', {
            paymentId: existingPayment.id,
            razorpayOrderId: razorpayOrderId,
          });
        }
      } else {
        // Payment row must exist — it is always created atomically during booking creation.
        // If we reach here with no payment, it is a data integrity violation.
        logger.error('createRazorpayOrder: Payment row missing for booking — data integrity issue', { bookingId });
        throw new Error(`Payment record missing for booking ${bookingId}. Booking creation may have been incomplete. Contact support.`);
      }
    });

    logger.info('createRazorpayOrder: Order created and saved successfully', {
      bookingId,
      razorpayOrderId,
      amount: Number(booking.totalAmount),
    });

    return {
      orderId: razorpayOrderId,
      amount: Number(booking.totalAmount),
      keyId: RAZORPAY_KEY_ID,
      bookingId: booking.id,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Handle race condition gracefully
    if (errorMsg.startsWith('RACE_CONDITION_HANDLED:')) {
      const raceOrderId = errorMsg.split(':')[1];
      const bookingNum = Number(bookingId);
      const amount = (
        await prisma.booking.findUnique({
          where: { id: bookingNum },
        })
      )?.totalAmount;

      return {
        orderId: raceOrderId,
        amount: Number(amount || 0),
        keyId: RAZORPAY_KEY_ID,
        bookingId: bookingNum,
      };
    }

    logger.error('createRazorpayOrder: Error creating order', {
      bookingId,
      error: errorMsg,
    });
    throw error;
  }
}

/**
 * Verify Razorpay webhook signature
 * ⚠️ CRITICAL: Must use raw body buffer, NOT string
 * Signature = HMAC-SHA256(body, secret)
 */
export function verifyRazorpaySignature(body: Buffer | string, signature: string): boolean {
  try {
    // Ensure body is Buffer for proper HMAC calculation
    const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(body);

    const hash = crypto
      .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
      .update(bodyBuffer)
      .digest('hex');

    const isValid = hash === signature;

    if (!isValid) {
      logger.error('verifyRazorpaySignature: Signature verification FAILED', {
        expectedSignature: hash,
        receivedSignature: signature,
        bodyLength: bodyBuffer.length,
      });
    } else {
      logger.debug('verifyRazorpaySignature: Signature verified successfully');
    }

    return isValid;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('verifyRazorpaySignature: Error verifying signature', {
      error: errorMsg,
    });
    return false;
  }
}

/**
 * Handle payment.captured webhook event
 * FRAUD SAFETY: Verifies amount matches
 * BOOKING SAFETY: Only confirms if status = PENDING_PAYMENT
 * IDEMPOTENT: Safe to call multiple times
 * TRANSACTION SAFE: Payment + Booking updated atomically
 */
export async function handlePaymentCaptured(payload: any): Promise<void> {
  const razorpayOrderId = payload.order?.id;
  const razorpayPaymentId = payload.payment?.id;
  const webhookAmount = payload.payment?.amount ? payload.payment.amount / 100 : 0; // Convert from paise

  if (!razorpayOrderId || !razorpayPaymentId) {
    logger.error('handlePaymentCaptured: Missing order or payment ID', {
      razorpayOrderId,
      razorpayPaymentId,
    });
    throw new Error('Missing razorpayOrderId or razorpayPaymentId in webhook');
  }

  try {
    // Find payment by razorpayOrderId
    const payment = await prisma.payment.findFirst({
      where: { razorpayOrderId },
      include: { booking: true },
    });

    if (!payment) {
      logger.error('handlePaymentCaptured: Payment not found for order', {
        razorpayOrderId,
      });
      throw new Error('Payment not found for this order');
    }

    // FRAUD CHECK: Verify amount matches (prevent amount tampering)
    const paymentAmount = Number(payment.amount);
    if (Math.abs(webhookAmount - paymentAmount) > 0.01) {
      // Allow 1 paisa difference for rounding
      logger.error('handlePaymentCaptured: AMOUNT MISMATCH - POSSIBLE FRAUD', {
        razorpayOrderId,
        expectedAmount: paymentAmount,
        webhookAmount,
        difference: webhookAmount - paymentAmount,
      });
      throw new Error(
        `Amount mismatch: Expected ${paymentAmount}, received ${webhookAmount}. Webhook rejected for fraud prevention.`
      );
    }

    // Check if already processed (idempotent)
    if (payment.status === PaymentStatus.CAPTURED) {
      logger.info('handlePaymentCaptured: Payment already captured - webhook idempotent', {
        razorpayOrderId,
        paymentId: payment.id,
      });
      return;
    }

    // Check if booking status is valid for confirmation
    // Booking is already included from the initial query
    if (payment.booking?.status !== BookingStatus.PENDING_PAYMENT) {
      logger.warn('handlePaymentCaptured: Booking status not PENDING_PAYMENT - marking payment FAILED', {
        razorpayOrderId,
        bookingId: payment.bookingId,
        currentStatus: payment.booking?.status,
      });

      // Mark payment as FAILED if booking state is invalid
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          refundReason: `Booking status is ${payment.booking?.status || 'null'}, expected PENDING_PAYMENT`,
        },
      });

      throw new Error(
        `Booking must be PENDING_PAYMENT to confirm. Current status: ${payment.booking?.status}`
      );
    }

    // Transaction: Update payment + booking atomically
    await prisma.$transaction(async (tx) => {
      // Update payment status (race condition check)
      const updatedPayment = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: PaymentStatus.CREATED, // Must be CREATED (pending)
        },
        data: {
          status: PaymentStatus.CAPTURED,
          escrowStatus: EscrowStatus.LOCKED, // Funds captured → lock escrow
          transactionId: razorpayPaymentId,
        },
      });

      if (updatedPayment.count === 0) {
        throw new Error(
          'Payment status already changed - possibly duplicate webhook or concurrent update'
        );
      }

      // Generate start OTP atomically within this transaction
      const startOtp = String(Math.floor(1000 + Math.random() * 9000));
      const otpGeneratedAt = new Date();

      // Update booking status to CONFIRMED (race condition check)
      const updatedBooking = await tx.booking.updateMany({
        where: {
          id: payment.bookingId,
          status: BookingStatus.PENDING_PAYMENT, // Race-condition guard
        },
        data: {
          status: 'CONFIRMED',
          startOtp,
          otpGeneratedAt,
          otpAttempts: 0,
        },
      });

      if (updatedBooking.count === 0) {
        throw new Error(
          'Booking status already changed - possibly duplicate webhook or manual confirmation'
        );
      }

      // ── Ledger entries (immutable, idempotent) ─────────────────────────────
      const capturedAmount = payment.amount;
      const commission = payment.booking.platformCommissionAmount;

      // 1. Record money received from customer
      await createLedgerEntry(
        {
          type:        'PAYMENT_CAPTURED',
          direction:   'CREDIT',
          amount:      capturedAmount,
          referenceId: razorpayPaymentId,
          bookingId:   payment.bookingId,
          userId:      payment.booking.customerId,
          metadata:    { razorpayPaymentId, razorpayOrderId },
        },
        tx,
      );

      // 2. Lock funds in escrow — mirrors the captured amount
      await createLedgerEntry(
        {
          type:        'ESCROW_LOCK',
          direction:   'DEBIT',
          amount:      capturedAmount,
          referenceId: razorpayPaymentId,
          bookingId:   payment.bookingId,
          metadata:    { razorpayPaymentId },
        },
        tx,
      );

      // 3. Platform commission earned (skip if snapshot is missing)
      if (commission !== null && commission !== undefined && commission > 0) {
        await createLedgerEntry(
          {
            type:        'COMMISSION_EARNED',
            direction:   'CREDIT',
            amount:      commission,
            referenceId: String(payment.bookingId),
            bookingId:   payment.bookingId,
            metadata:    { commissionRateSnapshot: payment.booking.commissionRateSnapshot },
          },
          tx,
        );
      }
    });

    logger.info('handlePaymentCaptured: Payment captured and booking confirmed successfully', {
      razorpayOrderId,
      razorpayPaymentId,
      bookingId: payment.bookingId,
      amount: webhookAmount,
      timestamp: new Date(),
    });

    // ── Post-transaction: real-time notifications ─────────────────────────────
    const bookingId = payment.bookingId;
    const helperId = payment.booking?.helperId;
    const customerId = payment.booking?.customerId;

    if (helperId) {
      emitToHelper(helperId, 'booking:paymentConfirmed', { bookingId, status: 'CONFIRMED' });
      sendPushToHelperIds(
        [helperId],
        'Payment Received',
        'Customer has completed payment. Job confirmed.',
        { type: 'PAYMENT_CONFIRMED', bookingId: String(bookingId) },
        'PAYMENT_CONFIRMED',
      ).catch(() => {});
    }

    if (customerId) {
      emitToCustomer(customerId, 'booking:paymentConfirmed', { bookingId, status: 'CONFIRMED' });
    }

    logger.info('Payment confirmed event emitted', { bookingId, helperId });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('handlePaymentCaptured: Error processing payment captured', {
      razorpayOrderId,
      razorpayPaymentId,
      error: errorMsg,
    });
    throw error;
  }
}

/**
 * Handle payment.failed webhook event
 * Marks payment as FAILED, booking stays PENDING_PAYMENT for retry
 * IDEMPOTENT: Safe to call multiple times
 */
export async function handlePaymentFailed(payload: any): Promise<void> {
  const razorpayOrderId = payload.order?.id;
  const razorpayPaymentId = payload.payment?.id;
  const errorDescription = payload.payment?.error_description || 'Unknown payment error';

  if (!razorpayOrderId) {
    logger.error('handlePaymentFailed: Missing order ID', {
      razorpayPaymentId,
    });
    throw new Error('Missing razorpayOrderId in webhook');
  }

  try {
    // Find payment by transactionId
    const payment = await prisma.payment.findFirst({
      where: { transactionId: razorpayOrderId },
      include: { booking: true },
    });

    if (!payment) {
      logger.error('handlePaymentFailed: Payment not found for order', {
        razorpayOrderId,
      });
      throw new Error('Payment not found for this order');
    }

    // Check if already processed (idempotent)
    if (payment.status === PaymentStatus.FAILED) {
      logger.info(
        'handlePaymentFailed: Payment already marked as FAILED - webhook idempotent',
        {
          razorpayOrderId,
          paymentId: payment.id,
        }
      );
      return;
    }

    // Update payment status only (booking stays for retry)
    const updated = await prisma.payment.updateMany({
      where: {
        id: payment.id,
        status: PaymentStatus.CREATED, // Race condition check
      },
      data: {
        status: PaymentStatus.FAILED,
        transactionId: razorpayPaymentId,
      },
    });

    if (updated.count === 0) {
      logger.warn('handlePaymentFailed: Payment status already changed', {
        razorpayOrderId,
        paymentId: payment.id,
      });
      // Don't fail - could have been processed already
      return;
    }

    // Booking stays PENDING_PAYMENT - customer can retry payment
    logger.info('handlePaymentFailed: Payment marked as FAILED', {
      razorpayOrderId,
      razorpayPaymentId,
      errorDescription,
      bookingId: payment.bookingId,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('handlePaymentFailed: Error processing payment failure', {
      razorpayOrderId,
      error: errorMsg,
    });
    throw error;
  }
}

/**
 * Create a generic Razorpay order for online store / grocery checkout
 */
export async function createGenericRazorpayOrder(
  amount: number,
  receipt: string,
  notes: Record<string, any> = {}
): Promise<{
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}> {
  const amountInPaise = Math.round(Number(amount) * 100);
  if (amountInPaise <= 0) {
    throw new Error('Order amount must be greater than zero');
  }

  const orderResponse = await axios.post(
    'https://api.razorpay.com/v1/orders',
    {
      amount: amountInPaise,
      currency: 'INR',
      receipt: String(receipt).slice(0, 40),
      notes,
    },
    {
      auth: {
        username: RAZORPAY_KEY_ID,
        password: RAZORPAY_KEY_SECRET,
      },
    }
  );

  return {
    orderId: orderResponse.data.id,
    amount: orderResponse.data.amount,
    currency: 'INR',
    keyId: RAZORPAY_KEY_ID,
  };
}
