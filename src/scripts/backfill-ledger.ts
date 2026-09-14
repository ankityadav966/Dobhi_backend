/**
 * backfill-ledger.ts
 *
 * Idempotent backfill script that creates LedgerEntry rows for all historical
 * bookings that predate the ledger system.
 *
 * Safe to run multiple times — duplicate inserts are silently swallowed via the
 * @@unique([type, referenceId]) constraint (Prisma P2002 handling in ledger.service.ts).
 *
 * Entries created per booking:
 *   - PAYMENT_CAPTURED (CREDIT)  — for every CAPTURED payment
 *   - ESCROW_LOCK      (DEBIT)   — mirrors PAYMENT_CAPTURED
 *   - COMMISSION_EARNED(CREDIT)  — if platformCommissionAmount > 0
 *   - HELPER_PAYOUT    (DEBIT)   — if payoutStatus = PAID and helperPayoutAmount > 0
 *
 * Usage:
 *   npx ts-node src/scripts/backfill-ledger.ts
 *   # or after build:
 *   node dist/scripts/backfill-ledger.js
 */

import '../app';   // Ensures env vars are loaded via app module
import { prisma } from '../prisma.client';
import { createLedgerEntry } from '../services/ledger.service';
import logger from '../utils/logger';

// ─── Config ───────────────────────────────────────────────────────────────────

/** Number of bookings processed per database round-trip. */
const BATCH_SIZE = 100;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function backfill(): Promise<void> {
  logger.info('[backfill-ledger] starting');

  let processed   = 0;
  let skipped     = 0;
  let created     = 0;
  let cursor: number | undefined;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const bookings = await prisma.booking.findMany({
      where: {
        ...(cursor !== undefined ? { id: { gt: cursor } } : {}),
        payment: {
          status: 'CAPTURED',
        },
      },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      select: {
        id:                      true,
        customerId:              true,
        payoutStatus:            true,
        platformCommissionAmount: true,
        helperPayoutAmount:       true,
        commissionRateSnapshot:   true,
        payment: {
          select: {
            id:                true,
            amount:            true,
            razorpayPaymentId: true,
          },
        },
      },
    });

    if (bookings.length === 0) break;
    cursor = bookings[bookings.length - 1]!.id;

    for (const booking of bookings) {
      const payment = booking.payment;

      if (!payment) {
        skipped++;
        continue;
      }

      const paymentAmount  = payment.amount;
      const referenceId    = payment.razorpayPaymentId ?? `legacy-${payment.id}`;

      // 1. PAYMENT_CAPTURED
      const r1 = await createLedgerEntry({
        type:        'PAYMENT_CAPTURED',
        direction:   'CREDIT',
        amount:      paymentAmount,
        referenceId,
        bookingId:   booking.id,
        userId:      booking.customerId,
        metadata:    { source: 'backfill' },
      });
      if (r1) created++;

      // 2. ESCROW_LOCK
      const r2 = await createLedgerEntry({
        type:        'ESCROW_LOCK',
        direction:   'DEBIT',
        amount:      paymentAmount,
        referenceId,
        bookingId:   booking.id,
        metadata:    { source: 'backfill' },
      });
      if (r2) created++;

      // 3. COMMISSION_EARNED
      const commission = booking.platformCommissionAmount;
      if (commission !== null && commission !== undefined && commission > 0) {
        const r3 = await createLedgerEntry({
          type:        'COMMISSION_EARNED',
          direction:   'CREDIT',
          amount:      commission,
          referenceId: String(booking.id),
          bookingId:   booking.id,
          metadata:    {
            commissionRateSnapshot: booking.commissionRateSnapshot,
            source: 'backfill',
          },
        });
        if (r3) created++;
      }

      // 4. HELPER_PAYOUT — only for already-paid bookings
      // Use same referenceId format as production: payout-{bookingId}
      const helperPayout = booking.helperPayoutAmount;
      if (
        booking.payoutStatus === 'PAID' &&
        helperPayout !== null &&
        helperPayout !== undefined &&
        helperPayout > 0
      ) {
        const r4 = await createLedgerEntry({
          type:        'HELPER_PAYOUT',
          direction:   'DEBIT',
          amount:      helperPayout,
          referenceId: `payout-${booking.id}`,
          bookingId:   booking.id,
          metadata:    { source: 'backfill' },
        });
        if (r4) created++;
      }

      processed++;
    }

    logger.info(`[backfill-ledger] batch done — processed=${processed} created=${created} skipped=${skipped}`);
  }

  logger.info('[backfill-ledger] complete', { processed, created, skipped });
}

backfill()
  .catch((err) => {
    logger.error('[backfill-ledger] fatal error', {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
