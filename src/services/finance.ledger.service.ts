/**
 * finance.ledger.service.ts
 *
 * Ledger-based financial aggregations.
 *
 * All figures are derived from the immutable LedgerEntry table — not from
 * raw booking/payment fields.  This is the single source of truth for
 * financial reporting.
 *
 * Functions return Prisma.Decimal so callers can format to arbitrary precision.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.client';
import logger from '../utils/logger';

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Returns the aggregate SUM of `amount` matching the given where clause. */
async function sumLedger(
  where: Prisma.LedgerEntryWhereInput,
): Promise<Prisma.Decimal> {
  const result = await prisma.ledgerEntry.aggregate({
    _sum: { amount: true },
    where,
  });
  return result._sum.amount ?? new Prisma.Decimal(0);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface LedgerSummary {
  totalRevenue:      Prisma.Decimal; // PAYMENT_CAPTURED CREDIT
  totalCommission:   Prisma.Decimal; // COMMISSION_EARNED CREDIT
  totalHelperPayout: Prisma.Decimal; // HELPER_PAYOUT DEBIT
  totalRefunds:      Prisma.Decimal; // REFUND_ISSUED DEBIT
  netRevenue:        Prisma.Decimal; // totalRevenue - totalRefunds
}

/**
 * Returns total gross revenue collected from customers.
 * (Sum of all PAYMENT_CAPTURED CREDIT entries.)
 */
export async function getTotalRevenue(): Promise<Prisma.Decimal> {
  return sumLedger({ type: 'PAYMENT_CAPTURED', direction: 'CREDIT' });
}

/**
 * Returns total platform commission earned.
 * (Sum of all COMMISSION_EARNED CREDIT entries.)
 */
export async function getTotalCommission(): Promise<Prisma.Decimal> {
  return sumLedger({ type: 'COMMISSION_EARNED', direction: 'CREDIT' });
}

/**
 * Returns total amount paid out to helpers.
 * (Sum of all HELPER_PAYOUT DEBIT entries.)
 */
export async function getTotalHelperPayout(): Promise<Prisma.Decimal> {
  return sumLedger({ type: 'HELPER_PAYOUT', direction: 'DEBIT' });
}

/**
 * Returns total refunds issued to customers.
 * (Sum of all REFUND_ISSUED DEBIT entries.)
 */
export async function getTotalRefunds(): Promise<Prisma.Decimal> {
  return sumLedger({ type: 'REFUND_ISSUED', direction: 'DEBIT' });
}

/**
 * Returns a full ledger-based financial summary in one round-trip.
 */
export async function getLedgerSummary(): Promise<LedgerSummary> {
  const [totalRevenue, totalCommission, totalHelperPayout, totalRefunds] =
    await Promise.all([
      getTotalRevenue(),
      getTotalCommission(),
      getTotalHelperPayout(),
      getTotalRefunds(),
    ]);

  const netRevenue = totalRevenue.minus(totalRefunds);

  logger.info('[finance-ledger] summary computed', {
    totalRevenue:      totalRevenue.toFixed(2),
    totalCommission:   totalCommission.toFixed(2),
    totalHelperPayout: totalHelperPayout.toFixed(2),
    totalRefunds:      totalRefunds.toFixed(2),
    netRevenue:        netRevenue.toFixed(2),
  });

  return { totalRevenue, totalCommission, totalHelperPayout, totalRefunds, netRevenue };
}

/**
 * Returns the ledger balance for a specific booking.
 * Useful for per-booking audit trails.
 */
export async function getBookingLedger(
  bookingId: number,
): Promise<{ credits: Prisma.Decimal; debits: Prisma.Decimal; net: Prisma.Decimal }> {
  const [credits, debits] = await Promise.all([
    sumLedger({ bookingId, direction: 'CREDIT' }),
    sumLedger({ bookingId, direction: 'DEBIT' }),
  ]);

  return {
    credits,
    debits,
    net: credits.minus(debits),
  };
}
