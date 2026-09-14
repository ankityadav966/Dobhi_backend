import { prisma } from '../prisma.client';
import logger from '../utils/logger';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { recordNoShow } from './helper-discipline.service';

const NO_SHOW_GRACE_PERIOD_MS = 30 * 60 * 1000; // 30 minutes after scheduled start time

/**
 * Auto-cancel CONFIRMED bookings that are not started within 30 minutes
 * Helper discipline: Records no-show and applies suspension if threshold reached
 * Transaction-safe: Atomic booking + payment (discipline recorded separately via recordNoShow)
 */
export async function autoCancelNoShowBookings(): Promise<{
  processedCount: number;
  cancelledCount: number;
  disciplineAppliedCount: number;
  errors: string[];
}> {
  const result = {
    processedCount: 0,
    cancelledCount: 0,
    disciplineAppliedCount: 0,
    errors: [] as string[],
  };

  try {
    const now = new Date();
    const noShowThresholdTime = new Date(now.getTime() - NO_SHOW_GRACE_PERIOD_MS);

    // Find CONFIRMED bookings where bookingDate < now - 30 minutes
    const noShowBookings = await prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        bookingDate: {
          lt: noShowThresholdTime, // Booking scheduled for more than 30 minutes ago
        },
        startedAt: null, // startBooking was never called
      },
      include: {
        payment: true,
        helper: {
          select: {
            id: true,
          },
        },
      },
    });

    logger.info('autoCancelNoShowBookings: Found no-show bookings', {
      count: noShowBookings.length,
    });

    result.processedCount = noShowBookings.length;

    for (const booking of noShowBookings) {
      try {
        // CRITICAL: Do NOT cancel if payment is already CAPTURED
        // Captured payments must complete the booking flow
        if (booking.payment && booking.payment.status === PaymentStatus.CAPTURED) {
          logger.warn('autoCancelNoShowBookings: Skipping booking with CAPTURED payment', {
            bookingId: booking.id,
            helperId: booking.helperId,
            paymentStatus: booking.payment.status,
          });
          continue;
        }

        // Transaction: Cancel booking + refund (if not captured) + record discipline
        await prisma.$transaction(async (tx) => {
          // Update booking status
          const updated = await tx.booking.updateMany({
            where: {
              id: booking.id,
              status: BookingStatus.CONFIRMED, // Double-check still CONFIRMED
            },
            data: {
              status: BookingStatus.CANCELLED,
              cancelReason: 'No-show: Helper did not start booking within 30 minutes',
            },
          });

          if (updated.count === 0) {
            throw new Error('Booking status changed - already cancelled or started');
          }

          // Only refund if payment exists and is NOT captured
          if (booking.payment && booking.payment.status !== PaymentStatus.CAPTURED) {
            await tx.payment.update({
              where: { id: booking.payment.id },
              data: {
                status: PaymentStatus.REFUNDED,
              },
            });
          }
        });

        // Record discipline AFTER transaction (separate operation)
        try {
          const disciplineResult = await recordNoShow(booking.helperId);
          if (disciplineResult.suspended) {
            result.disciplineAppliedCount++;
          }
        } catch (error) {
          // If discipline recording fails, don't fail the whole operation
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push(`Discipline recording failed for helper ${booking.helperId}: ${errorMsg}`);
        }

        result.cancelledCount++;

        logger.info('autoCancelNoShowBookings: Booking cancelled', {
          bookingId: booking.id,
          helperId: booking.helperId,
          startTime: booking.startTime,
          totalAmount: booking.totalAmount,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Booking ${booking.id}: ${errorMsg}`);
        logger.error('autoCancelNoShowBookings: Failed to cancel booking', {
          bookingId: booking.id,
          helperId: booking.helperId,
          error: errorMsg,
        });
      }
    }

    logger.info('autoCancelNoShowBookings: Completed', {
      processedCount: result.processedCount,
      cancelledCount: result.cancelledCount,
      disciplineAppliedCount: result.disciplineAppliedCount,
      errorCount: result.errors.length,
    });

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('autoCancelNoShowBookings: Fatal error', { error: errorMsg });
    result.errors.push(`Fatal error: ${errorMsg}`);
    return result;
  }
}
