/**
 * payout.cron.ts
 *
 * Registers the daily payout reconciliation cron job.
 * Call registerPayoutReconciliationCron() from the app's cron initializer.
 *
 * Schedule: every day at 03:00 AM (5-field node-cron format: "0 3 * * *")
 */

import * as cron from 'node-cron';
import logger from '../utils/logger';
import { reconcilePayouts } from '../services/payout.reconciliation.service';
import { retryFailedFundRegistrations } from '../services/payout.registration.retry.service';

export function registerPayoutReconciliationCron(): void {
  // "0 3 * * *"  →  at 03:00 every day
  cron.schedule('0 3 * * *', async () => {
    logger.info('Payout Reconciliation Cron: triggered');
    try {
      const result = await reconcilePayouts();

      logger.info('Payout Reconciliation Cron: completed', {
        checkedCount: result.checkedCount,
        fixedPaid:    result.fixedPaid,
        fixedFailed:  result.fixedFailed,
        skippedCount: result.skippedCount,
        errorCount:   result.errorCount,
      });

      if (result.errorCount > 0) {
        logger.warn('Payout Reconciliation Cron: finished with errors', {
          errorCount: result.errorCount,
          errors:     result.errors,
        });
      }
    } catch (error) {
      logger.error('Payout Reconciliation Cron: fatal error', {
        error: (error as Error).message,
      });
    }
  });

  logger.info('Cron job registered: reconcilePayouts (daily at 03:00)');
}

// ─── Payout Registration Retry Cron ──────────────────────────────────────────

/**
 * Registers the payout fund-account registration retry cron.
 * Runs every 30 minutes to retry Razorpay Contact + Fund Account creation
 * for helpers whose registration failed during onboarding bank submission.
 *
 * Schedule: every 30 minutes  (node-cron: "* /30 * * * *" without the space)
 */
export function registerPayoutRegistrationRetryCron(): void {
  // "*/30 * * * *"  →  every 30 minutes (5-field node-cron format)
  cron.schedule('*/30 * * * *', async () => {
    logger.info('PayoutRegistrationRetry Cron: triggered');
    try {
      const result = await retryFailedFundRegistrations();

      logger.info('PayoutRegistrationRetry Cron: completed', {
        checkedCount:   result.checkedCount,
        activatedCount: result.activatedCount,
        failedCount:    result.failedCount,
        skippedCount:   result.skippedCount,
        exhaustedCount: result.exhaustedCount,
        errorCount:     result.errors.length,
      });

      if (result.exhaustedCount > 0) {
        logger.warn('PayoutRegistrationRetry Cron: some helpers reached max retries — manual intervention required', {
          exhaustedCount: result.exhaustedCount,
        });
      }
    } catch (error) {
      logger.error('PayoutRegistrationRetry Cron: fatal error', {
        error: (error as Error).message,
      });
    }
  });

  logger.info('Cron job registered: retryFailedFundRegistrations (every 30 minutes)');
}
