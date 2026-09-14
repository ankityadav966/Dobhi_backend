/**
 * ledger.validation.service.ts
 *
 * Validates ledger creation workflows to ensure:
 * - No duplicate entries (via referenceId uniqueness)
 * - Only service-approved flows can create entries
 * - Correct entry types for each business event
 */

import { prisma } from '../prisma.client';
import logger from '../utils/logger';

/**
 * Validate CREDIT entry can be created for booking completion
 * Rules:
 * - Booking must be COMPLETED
 * - Helper must exist and be approved
 * - CREDIT entry must not already exist (check referenceId)
 */
export async function validateCreditEntryCreation(
  bookingId: number,
  helperId: number,
): Promise<{ valid: boolean; reason?: string }> {
  // 1. Verify booking is COMPLETED
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { status: true, helperId: true, helperPayoutAmount: true },
  });

  if (!booking) {
    return { valid: false, reason: 'Booking not found' };
  }

  if (booking.status !== 'COMPLETED') {
    return { valid: false, reason: `Booking status is ${booking.status}, must be COMPLETED` };
  }

  if (booking.helperId !== helperId) {
    return { valid: false, reason: 'Booking not assigned to this helper' };
  }

  if (!booking.helperPayoutAmount || booking.helperPayoutAmount <= 0) {
    return { valid: false, reason: 'Invalid helper payout amount' };
  }

  // 2. Verify helper is approved
  const helper = await prisma.helper.findUnique({
    where: { id: helperId },
    select: { onboardingStatus: true, isAvailable: true },
  });

  if (!helper) {
    return { valid: false, reason: 'Helper not found' };
  }

  if (helper.onboardingStatus !== 'APPROVED') {
    return { valid: false, reason: `Helper status is ${helper.onboardingStatus}` };
  }

  // 3. Check CREDIT entry doesn't already exist
  const existingCredit = await prisma.ledgerEntry.findUnique({
    where: {
      type_referenceId: {
        type: 'HELPER_PAYOUT',
        referenceId: `booking-${bookingId}`,
      },
    },
  });

  if (existingCredit) {
    return { valid: false, reason: 'CREDIT entry already exists for this booking' };
  }

  return { valid: true };
}

/**
 * Validate DEBIT entry can be created for payout processed
 * Rules:
 * - Booking must have payoutStatus === PAID
 * - Must have helperPayoutAmount
 * - DEBIT entry must not already exist (check referenceId)
 */
export async function validateDebitEntryCreation(
  bookingId: number,
): Promise<{ valid: boolean; reason?: string }> {
  // 1. Verify booking is PAID
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { payoutStatus: true, helperPayoutAmount: true, helperId: true },
  });

  if (!booking) {
    return { valid: false, reason: 'Booking not found' };
  }

  if (booking.payoutStatus !== 'PAID') {
    return { valid: false, reason: `Booking payout status is ${booking.payoutStatus}, must be PAID` };
  }

  if (!booking.helperPayoutAmount || booking.helperPayoutAmount <= 0) {
    return { valid: false, reason: 'Invalid helper payout amount' };
  }

  // 2. Check DEBIT entry doesn't already exist
  const existingDebit = await prisma.ledgerEntry.findUnique({
    where: {
      type_referenceId: {
        type: 'HELPER_PAYOUT',
        referenceId: `payout-${bookingId}`,
      },
    },
  });

  if (existingDebit) {
    return { valid: false, reason: 'DEBIT entry already exists for this booking payout' };
  }

  return { valid: true };
}

/**
 * Detect and report duplicate ledger entries per booking
 * Useful for identifying data consistency issues
 */
export async function detectDuplicateEntries(): Promise<
  Array<{
    bookingId: number;
    creditCount: number;
    debitCount: number;
    creditIds: number[];
    debitIds: number[];
  }>
> {
  const duplicates = (await prisma.$queryRaw`
    SELECT
      "bookingId",
      SUM(CASE WHEN direction = 'CREDIT' THEN 1 ELSE 0 END) as "creditCount",
      SUM(CASE WHEN direction = 'DEBIT' THEN 1 ELSE 0 END) as "debitCount",
      ARRAY_AGG(CASE WHEN direction = 'CREDIT' THEN id ELSE NULL END) FILTER (WHERE direction = 'CREDIT') as "creditIds",
      ARRAY_AGG(CASE WHEN direction = 'DEBIT' THEN id ELSE NULL END) FILTER (WHERE direction = 'DEBIT') as "debitIds"
    FROM "LedgerEntry"
    WHERE type = 'HELPER_PAYOUT' AND "bookingId" IS NOT NULL
    GROUP BY "bookingId"
    HAVING SUM(CASE WHEN direction = 'CREDIT' THEN 1 ELSE 0 END) > 1
      OR SUM(CASE WHEN direction = 'DEBIT' THEN 1 ELSE 0 END) > 1
    ORDER BY "bookingId"
  `) as Array<{
    bookingId: number;
    creditCount: number;
    debitCount: number;
    creditIds: number[];
    debitIds: number[];
  }>;

  if (duplicates && duplicates.length > 0) {
    logger.warn('[ledger-validation] Duplicate entries detected', {
      count: duplicates.length,
    });
  }

  return duplicates || [];
}

/**
 * Validate reference IDs follow correct format
 * Returns bookings with incorrect reference IDs
 */
export async function validateReferenceIdFormat(): Promise<
  Array<{
    id: number;
    type: string;
    direction: string;
    referenceId: string | null;
    bookingId: number | null;
  }>
> {
  const invalidEntries = await prisma.ledgerEntry.findMany({
    where: {
      type: 'HELPER_PAYOUT',
      bookingId: { not: null },
      AND: [
        {
          NOT: {
            referenceId: { in: null }, // Will be overridden by OR below
          },
        },
      ],
    },
    select: { id: true, type: true, direction: true, referenceId: true, bookingId: true },
  });

  // Manual filtering for correct format
  const invalid = invalidEntries.filter((entry) => {
    if (!entry.referenceId || !entry.bookingId) return true;

    if (entry.direction === 'CREDIT') {
      return !entry.referenceId.startsWith(`booking-`);
    } else if (entry.direction === 'DEBIT') {
      return !entry.referenceId.startsWith(`payout-`);
    }

    return true;
  });

  if (invalid.length > 0) {
    logger.warn('[ledger-validation] Invalid reference ID format detected', {
      count: invalid.length,
      samples: invalid.slice(0, 5),
    });
  }

  return invalid;
}
