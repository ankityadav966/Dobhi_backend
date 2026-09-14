import { prisma } from '../prisma.client';
import logger from '../utils/logger';
import { BookingStatus, EscrowStatus, PaymentStatus } from '@prisma/client';
import { recordPenalty } from './helper-discipline.service';

const IN_PROGRESS_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours

/**
 * Auto-cancel IN_PROGRESS bookings that exceed 8-hour time limit
 * Prevents helpers from keeping bookings indefinitely
 * Refunds customer if payment exists
 * Helper discipline: Records penalty and applies suspension if threshold reached
 */
export async function autoCancelStaleInProgressBookings(): Promise<{
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
    const eightHoursAgo = new Date(now.getTime() - IN_PROGRESS_TIMEOUT_MS);

    // Find IN_PROGRESS bookings that started > 8 hours ago
    const staleBookings = await prisma.booking.findMany({
      where: {
        status: BookingStatus.IN_PROGRESS,
        startedAt: {
          lt: eightHoursAgo, // Started more than 8 hours ago (implicitly not null)
        },
      },
      include: {
        payment: true,
      },
    });

    logger.info('autoCancelStaleInProgressBookings: Found stale IN_PROGRESS bookings', {
      count: staleBookings.length,
    });

    result.processedCount = staleBookings.length;

    for (const booking of staleBookings) {
      try {
        // Auto-cancel in transaction
        await prisma.$transaction(async (tx) => {
          // Update booking status
          const updated = await tx.booking.updateMany({
            where: {
              id: booking.id,
              status: BookingStatus.IN_PROGRESS, // Double-check still IN_PROGRESS
            },
            data: {
              status: BookingStatus.CANCELLED,
              cancelReason: 'Auto-cancelled due to timeout (8h limit exceeded)',
            },
          });

          if (updated.count === 0) {
            throw new Error('Booking status changed - already cancelled or completed');
          }

          // Refund payment if exists and is eligible for refund
          if (booking.payment && booking.payment.status === PaymentStatus.CAPTURED && booking.payment.escrowStatus === EscrowStatus.LOCKED) {
            await tx.payment.update({
              where: { id: booking.payment.id },
              data: {
                status: PaymentStatus.REFUNDED,
                escrowStatus: EscrowStatus.REFUNDED,
                refundReason: 'Auto-cancelled due to IN_PROGRESS timeout',
              },
            });
          }
        });
// Record penalty AFTER transaction (separate operation)
        try {
          if (booking.helperId) {
            const disciplineResult = await recordPenalty(booking.helperId);
            if (disciplineResult.suspended) {
              result.disciplineAppliedCount++;
            }
          }
        } catch (error) {
          // If discipline recording fails, don't fail the whole operation
          const errorMsg = error instanceof Error ? error.message : String(error);
          result.errors.push(`Penalty recording failed for helper ${booking.helperId}: ${errorMsg}`);
        }

        
        result.cancelledCount++;

        logger.info('autoCancelStaleInProgressBookings: Booking cancelled', {
          bookingId: booking.id,
          startedAt: booking.startedAt,
      disciplineAppliedCount: result.disciplineAppliedCount,
          totalAmount: booking.totalAmount,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Booking ${booking.id}: ${errorMsg}`);
        logger.error('autoCancelStaleInProgressBookings: Failed to cancel booking', {
          bookingId: booking.id,
          error: errorMsg,
        });
      }
    }

    logger.info('autoCancelStaleInProgressBookings: Completed', {
      processedCount: result.processedCount,
      cancelledCount: result.cancelledCount,
      errorCount: result.errors.length,
    });

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('autoCancelStaleInProgressBookings: Fatal error', { error: errorMsg });
    result.errors.push(`Fatal error: ${errorMsg}`);
    return result;
  }
}
