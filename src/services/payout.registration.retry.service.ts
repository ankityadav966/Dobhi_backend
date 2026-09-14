/**
 * payout.registration.retry.service.ts
 *
 * Background service that retries Razorpay Contact + Fund Account registration
 * for helpers who failed during onboarding bank submission.
 *
 * Invoked every 30 minutes by the payout registration retry cron.
 *
 * Logic:
 *  - Queries helpers with payoutEnabled=false AND payoutSetupStatus IN (PENDING, FAILED)
 *    AND payoutRetryCount < MAX_REGISTRATION_RETRIES
 *  - If HelperBank.razorpayFundAccountId already set → mark ACTIVE (idempotent recovery)
 *  - Otherwise → attempt Razorpay contact + fund account creation
 *  - Success → payoutEnabled=true, payoutSetupStatus=ACTIVE
 *  - Failure  → increment payoutRetryCount + update lastPayoutRetryAt
 *  - After MAX_REGISTRATION_RETRIES failures → payoutSetupStatus=FAILED (manual intervention)
 */

import { prisma } from '../prisma.client';
import logger from '../utils/logger';
import { createRazorpayContactAndFundAccount } from './razorpay.contact.service';
import { sendAlert } from './alert.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_REGISTRATION_RETRIES = 5;
/** Throttle between Razorpay API calls to avoid rate-limit bursts (ms) */
const INTER_CALL_DELAY_MS = 500;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main export ─────────────────────────────────────────────────────────────

export interface RegistrationRetryResult {
  checkedCount:  number;
  activatedCount: number;
  failedCount:   number;
  skippedCount:  number;
  exhaustedCount: number;
  errors:        string[];
}

export async function retryFailedFundRegistrations(): Promise<RegistrationRetryResult> {
  logger.info('PayoutRegistrationRetry: started');

  const result: RegistrationRetryResult = {
    checkedCount:   0,
    activatedCount: 0,
    failedCount:    0,
    skippedCount:   0,
    exhaustedCount: 0,
    errors:         [],
  };

  // Fetch helpers pending registration, excluding those already at max retries
  const helpers = (await prisma.helper.findMany({
    where: {
      payoutEnabled:     false,
      payoutSetupStatus: { in: ['PENDING', 'FAILED'] },
      payoutRetryCount:  { lt: MAX_REGISTRATION_RETRIES },
    } as any, // fields not yet in generated Prisma types; safe after migrate + generate
    select: {
      id:                true,
      userId:            true,
      payoutRetryCount:  true,
      payoutSetupStatus: true,
      bank: {
        select: {
          accountName:          true,
          accountNumber:        true,
          ifsc:                 true,
          razorpayFundAccountId: true,
        },
      },
      user: {
        select: {
          fullName: true,
          phone:    true,
        },
      },
    } as any,
  }) as unknown) as Array<{
    id:                number;
    userId:            number;
    payoutRetryCount:  number;
    payoutSetupStatus: string;
    bank: {
      accountName:           string;
      accountNumber:         string;
      ifsc:                  string;
      razorpayFundAccountId: string | null;
    } | null;
    user: { fullName: string; phone: string };
  }>;

  result.checkedCount = helpers.length;
  logger.info('PayoutRegistrationRetry: helpers to process', { count: helpers.length });

  for (const helper of helpers) {
    try {
      // ── Guard: bank details must exist ──────────────────────────────────────
      if (!helper.bank) {
        logger.warn('PayoutRegistrationRetry: No bank details found — skipping', {
          helperId: helper.id,
        });
        result.skippedCount++;
        continue;
      }

      // ── Idempotency: fund account already created but flag not set ───────────
      if (helper.bank.razorpayFundAccountId) {
        logger.info('PayoutRegistrationRetry: Fund account already exists — marking ACTIVE', {
          helperId:      helper.id,
          fundAccountId: helper.bank.razorpayFundAccountId,
        });

        await prisma.helper.update({
          where: { id: helper.id },
          data: {
            payoutEnabled:     true,
            payoutSetupStatus: 'ACTIVE',
            payoutRetryCount:  0,
          } as any,
        });

        result.activatedCount++;
        continue;
      }

      // ── Attempt Razorpay registration ────────────────────────────────────────
      logger.info('PayoutRegistrationRetry: Attempting fund account registration', {
        helperId:    helper.id,
        retryCount:  helper.payoutRetryCount,
      });

      await createRazorpayContactAndFundAccount({
        helperId:      helper.id,
        fullName:      helper.user.fullName,
        phone:         helper.user.phone,
        accountName:   helper.bank.accountName,
        accountNumber: helper.bank.accountNumber,
        ifsc:          helper.bank.ifsc,
      });

      // Success
      await prisma.helper.update({
        where: { id: helper.id },
        data: {
          payoutEnabled:     true,
          payoutSetupStatus: 'ACTIVE',
          payoutRetryCount:  0,
          lastPayoutRetryAt: new Date(),
        } as any,
      });

      logger.info('PayoutRegistrationRetry: Fund account registered successfully', {
        helperId: helper.id,
      });

      result.activatedCount++;
    } catch (err) {
      const newRetryCount = (helper.payoutRetryCount ?? 0) + 1;
      const exhausted     = newRetryCount >= MAX_REGISTRATION_RETRIES;
      const newStatus     = exhausted ? 'FAILED' : 'PENDING';
      const errorMsg      = `helperId=${helper.id}: ${(err as Error).message}`;

      logger.error('PayoutRegistrationRetry: Registration attempt failed', {
        helperId:     helper.id,
        attempt:      newRetryCount,
        maxRetries:   MAX_REGISTRATION_RETRIES,
        exhausted,
        newStatus,
        error:        (err as Error).message,
      });

      if (exhausted) {
        logger.warn('PayoutRegistrationRetry: Max retries reached — marking FAILED for manual intervention', {
          helperId: helper.id,
        });
        sendAlert('FUND_REGISTRATION_FAILED', {
          helperId:   helper.id,
          retryCount: newRetryCount,
          error:      (err as Error).message,
        }).catch(() => {});
        result.exhaustedCount++;
      } else {
        result.failedCount++;
      }

      result.errors.push(errorMsg);

      await prisma.helper.update({
        where: { id: helper.id },
        data: {
          payoutRetryCount:  newRetryCount,
          lastPayoutRetryAt: new Date(),
          payoutSetupStatus: newStatus,
        } as any,
      }).catch((dbErr: unknown) =>
        logger.error('PayoutRegistrationRetry: Failed to persist retry state', {
          helperId: helper.id,
          error:    (dbErr as Error).message,
        }),
      );
    }

    // Throttle between Razorpay API calls
    await sleep(INTER_CALL_DELAY_MS);
  }

  logger.info('PayoutRegistrationRetry: completed', {
    checkedCount:   result.checkedCount,
    activatedCount: result.activatedCount,
    failedCount:    result.failedCount,
    skippedCount:   result.skippedCount,
    exhaustedCount: result.exhaustedCount,
    errorCount:     result.errors.length,
  });

  return result;
}
