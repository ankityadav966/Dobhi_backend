import * as cron from 'node-cron';
import logger from '../utils/logger';
import { processExpiredRequests, processPaymentExpirations } from '../services/booking-dispatch.service';
import { processPendingPayouts } from '../services/payout.service';
import { autoCancelInactiveConfirmedBookings } from '../services/booking-lifecycle.service';
import { autoCancelStaleInProgressBookings } from '../services/inProgressTimeout.service';
import { autoCancelNoShowBookings } from '../services/noShowAutoCancel.service';
import { registerPayoutReconciliationCron } from '../cron/payout.cron';
import { registerPayoutRegistrationRetryCron } from '../cron/payout.cron';

/**
 * Initialize cron jobs for the application
 * This should be called once when the application starts
 */
export function initializeCronJobs(): void {
  logger.info('Initializing cron jobs...');

  // Combined 5-second scheduler: processExpiredRequests + processPaymentExpirations
  // Runs both tasks sequentially every 5 seconds in a single scheduler
  // Format: "*/5 * * * * *" = every 5 seconds
  cron.schedule('*/5 * * * * *', async () => {
    logger.info('Cron: 5-second scheduler triggered');
    try {
      await processExpiredRequests();
      await processPaymentExpirations();
    } catch (error) {
      logger.error('Cron: Error in 5-second scheduler', error);
    }
  });

  logger.info('Cron job initialized: 5-second scheduler (processExpiredRequests + processPaymentExpirations)');

  // Process pending payouts every 5 minutes
  // Checks for COMPLETED bookings where payoutStatus = PENDING and payoutEligibleAt <= NOW
  // Then triggers Razorpay payout and updates payout status
  // Format: "0 */5 * * * *" = every 5 minutes (6-field seconds mode)
  cron.schedule('0 */5 * * * *', async () => {
    logger.info('PAYOUT CRON TRIGGERED');
    try {
      const result = await processPendingPayouts();
      logger.info('PAYOUT CRON RESULT', result);

      if (result.processedCount > 0) {
        logger.info('Cron: Processed pending payouts', {
          processedCount: result.processedCount,
          successCount: result.successCount,
          failureCount: result.failureCount,
        });
      }

      if (result.failureCount > 0) {
        logger.warn('Cron: Errors occurred while processing payouts', {
          failures: result.failureCount,
          errors: result.errors,
        });
      }
    } catch (error) {
      logger.error('Cron: Error in processPendingPayouts task', error);
    }
  });

  logger.info('Cron job initialized: processPendingPayouts (every 5 minutes)');

  // Auto-cancel inactive confirmed bookings every 5 minutes
  // Checks for CONFIRMED bookings created more than 30 minutes ago without payment
  // Format: "0 */5 * * * *" = every 5 minutes (6-field seconds mode)
  cron.schedule('0 */5 * * * *', async () => {
    try {
      const result = await autoCancelInactiveConfirmedBookings();

      if (result.processedCount > 0) {
        logger.info('Cron: Processed inactive confirmed bookings', {
          processedCount: result.processedCount,
          cancelledCount: result.cancelledCount,
          errorCount: result.errors.length,
        });
      }

      if (result.errors.length > 0) {
        logger.warn('Cron: Errors occurred while cancelling inactive bookings', {
          errors: result.errors,
        });
      }
    } catch (error) {
      logger.error('Cron: Error in autoCancelInactiveConfirmedBookings task', error);
    }
  });

  logger.info('Cron job initialized: autoCancelInactiveConfirmedBookings (every 5 minutes)');

  // Auto-cancel stale in-progress bookings every 5 minutes
  // Checks for IN_PROGRESS bookings that have exceeded 8-hour timeout
  // Format: "0 */5 * * * *" = every 5 minutes (6-field seconds mode)
  cron.schedule('0 */5 * * * *', async () => {
    try {
      const result = await autoCancelStaleInProgressBookings();

      if (result.processedCount > 0) {
        logger.info('Cron: Processed stale in-progress bookings', {
          processedCount: result.processedCount,
          cancelledCount: result.cancelledCount,
          disciplineAppliedCount: result.disciplineAppliedCount,
          errorCount: result.errors.length,
        });
      }

      if (result.errors.length > 0) {
        logger.warn('Cron: Errors occurred while processing in-progress timeouts', {
          errors: result.errors,
        });
      }
    } catch (error) {
      logger.error('Cron: Error in autoCancelStaleInProgressBookings task', error);
    }
  });

  logger.info('Cron job initialized: autoCancelStaleInProgressBookings (every 5 minutes)');

  // Auto-cancel bookings with no-show helpers every 2 minutes
  // Checks for CONFIRMED bookings where helper hasn't started within 30 minutes
  // Format: "0 */2 * * * *" = every 2 minutes (6-field seconds mode)
  cron.schedule('0 */2 * * * *', async () => {
    try {
      const result = await autoCancelNoShowBookings();

      if (result.processedCount > 0) {
        logger.info('Cron: Processed no-show bookings', {
          processedCount: result.processedCount,
          cancelledCount: result.cancelledCount,
          disciplineAppliedCount: result.disciplineAppliedCount,
          errorCount: result.errors.length,
        });
      }

      if (result.errors.length > 0) {
        logger.warn('Cron: Errors occurred while processing no-show bookings', {
          errors: result.errors,
        });
      }
    } catch (error) {
      logger.error('Cron: Error in autoCancelNoShowBookings task', error);
    }
  });

  logger.info('Cron job initialized: autoCancelNoShowBookings (every 2 minutes)');

  // Daily payout reconciliation — corrects missed webhooks and stale PROCESSING states
  registerPayoutReconciliationCron();
  registerPayoutRegistrationRetryCron();
}

/**
 * Stop all cron jobs (for graceful shutdown)
 */
export function stopCronJobs(): void {
  logger.info('Stopping all cron jobs...');
  cron.getTasks().forEach(task => {
    task.stop();
  });
  logger.info('All cron jobs stopped');
}
