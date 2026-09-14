/**
 * ledger.integrity.service.ts
 *
 * Daily balance checks for the financial ledger.
 *
 * Checks performed:
 *   1. Global credit/debit balance — verifies no money was created or destroyed.
 *      Formula: SUM(CREDIT) should be >= SUM(DEBIT)   (platform always holds float)
 *      Alert if delta is negative (debit > credit — impossible under normal ops).
 *
 *   2. Helper payout reconciliation — verifies HELPER_PAYOUT ledger entries
 *      match the sum of helperPayoutAmount on bookings where payoutStatus = PAID.
 *      A mismatch indicates a missed ledger write or a double-write.
 *
 * Designed to be called from a daily cron job.
 * Sends a FINANCE_MISMATCH alert if any discrepancy is found.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.client';
import logger from '../utils/logger';
import { sendAlert } from './alert.service';

// ─── Tolerance ────────────────────────────────────────────────────────────────

/** Acceptable rounding tolerance in rupees (0.01 = 1 paisa). */
const TOLERANCE = new Prisma.Decimal('0.01');

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sumLedgerDirection(direction: 'CREDIT' | 'DEBIT'): Promise<Prisma.Decimal> {
  const result = await prisma.ledgerEntry.aggregate({
    _sum: { amount: true },
    where: { direction },
  });
  return result._sum.amount ?? new Prisma.Decimal(0);
}

async function sumLedgerType(type: string): Promise<Prisma.Decimal> {
  const result = await prisma.ledgerEntry.aggregate({
    _sum: { amount: true },
    where: { type: type as Prisma.EnumLedgerTypeFilter['equals'] },
  });
  return result._sum.amount ?? new Prisma.Decimal(0);
}

async function sumBookingHelperPayouts(): Promise<Prisma.Decimal> {
  const result = await prisma.booking.aggregate({
    _sum: { helperPayoutAmount: true },
    where: { payoutStatus: 'PAID' },
  });
  const raw = result._sum.helperPayoutAmount ?? 0;
  return new Prisma.Decimal(raw);
}

// ─── Main integrity check ─────────────────────────────────────────────────────

export interface IntegrityResult {
  passed: boolean;
  creditTotal:           Prisma.Decimal;
  debitTotal:            Prisma.Decimal;
  delta:                 Prisma.Decimal;
  helperPayoutLedger:    Prisma.Decimal;
  helperPayoutBooking:   Prisma.Decimal;
  helperPayoutDelta:     Prisma.Decimal;
  checkedAt:             Date;
}

/**
 * Runs all ledger integrity checks.
 *
 * @returns IntegrityResult — summary of findings.
 * @throws  Never — errors are caught and logged internally.
 */
export async function checkLedgerIntegrity(): Promise<IntegrityResult> {
  const checkedAt = new Date();

  try {
    const [creditTotal, debitTotal, helperPayoutLedger, helperPayoutBooking] =
      await Promise.all([
        sumLedgerDirection('CREDIT'),
        sumLedgerDirection('DEBIT'),
        sumLedgerType('HELPER_PAYOUT'),
        sumBookingHelperPayouts(),
      ]);

    const delta             = creditTotal.minus(debitTotal);
    const helperPayoutDelta = helperPayoutLedger.minus(helperPayoutBooking).abs();

    const balanceOk = delta.greaterThanOrEqualTo(new Prisma.Decimal(0));
    const payoutOk  = helperPayoutDelta.lessThanOrEqualTo(TOLERANCE);
    const passed    = balanceOk && payoutOk;

    const result: IntegrityResult = {
      passed,
      creditTotal,
      debitTotal,
      delta,
      helperPayoutLedger,
      helperPayoutBooking,
      helperPayoutDelta,
      checkedAt,
    };

    if (!passed) {
      logger.error('[ledger-integrity] MISMATCH DETECTED', {
        balanceOk,
        payoutOk,
        creditTotal:         creditTotal.toFixed(2),
        debitTotal:          debitTotal.toFixed(2),
        delta:               delta.toFixed(2),
        helperPayoutLedger:  helperPayoutLedger.toFixed(2),
        helperPayoutBooking: helperPayoutBooking.toFixed(2),
        helperPayoutDelta:   helperPayoutDelta.toFixed(2),
      });

      await sendAlert('FINANCE_MISMATCH', {
        balanceOk,
        payoutOk,
        creditTotal:         creditTotal.toFixed(2),
        debitTotal:          debitTotal.toFixed(2),
        delta:               delta.toFixed(2),
        helperPayoutLedger:  helperPayoutLedger.toFixed(2),
        helperPayoutBooking: helperPayoutBooking.toFixed(2),
        helperPayoutDelta:   helperPayoutDelta.toFixed(2),
        checkedAt:           checkedAt.toISOString(),
      });
    } else {
      logger.info('[ledger-integrity] all checks passed', {
        creditTotal:         creditTotal.toFixed(2),
        debitTotal:          debitTotal.toFixed(2),
        delta:               delta.toFixed(2),
        helperPayoutDelta:   helperPayoutDelta.toFixed(2),
        checkedAt:           checkedAt.toISOString(),
      });
    }

    return result;
  } catch (err) {
    logger.error('[ledger-integrity] check failed with unexpected error', {
      error: err instanceof Error ? err.message : String(err),
    });
    // Return a failure result rather than crashing the cron
    return {
      passed:              false,
      creditTotal:         new Prisma.Decimal(0),
      debitTotal:          new Prisma.Decimal(0),
      delta:               new Prisma.Decimal(0),
      helperPayoutLedger:  new Prisma.Decimal(0),
      helperPayoutBooking: new Prisma.Decimal(0),
      helperPayoutDelta:   new Prisma.Decimal(0),
      checkedAt,
    };
  }
}
