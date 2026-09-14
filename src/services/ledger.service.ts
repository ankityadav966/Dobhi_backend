/**
 * ledger.service.ts
 *
 * Immutable double-entry financial ledger.
 *
 * Rules:
 *  - Entries are INSERT-only — never updated or deleted.
 *  - Amount must be > 0 (enforced at service layer).
 *  - @@unique([type, referenceId]) provides database-level idempotency.
 *    Duplicate inserts (same type + referenceId) are silently swallowed
 *    via Prisma P2002 unique-constraint handling — safe for webhook retries.
 *  - Accepts an optional `tx` (Prisma.TransactionClient) so callers can
 *    include ledger writes inside their existing atomic transactions.
 *
 * Usage:
 *   // Outside a transaction
 *   await createLedgerEntry({ type: 'PAYMENT_CAPTURED', direction: 'CREDIT', ... });
 *
 *   // Inside a prisma.$transaction(async tx => { ... })
 *   await createLedgerEntry({ ... }, tx);
 */

import { Prisma, LedgerType, LedgerDirection } from '@prisma/client';
import { prisma } from '../prisma.client';
import logger from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateLedgerEntryParams {
  type: LedgerType;
  direction: LedgerDirection;
  /** Must be > 0. Accepts number or Prisma.Decimal. */
  amount: number | Prisma.Decimal;
  /** Unique reference for idempotency (e.g. razorpayPaymentId, razorpayPayoutId). */
  referenceId?: string;
  bookingId?: number;
  userId?: number;
  /** Optional structured metadata stored as JSON. */
  metadata?: Record<string, unknown>;
}

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Creates a single immutable ledger entry.
 *
 * @param params   Entry parameters
 * @param tx       Optional Prisma transaction client — pass when calling inside
 *                 an existing `prisma.$transaction(async tx => {...})` block.
 *
 * @throws Error   If `amount` ≤ 0 (programming error — always hard-fail).
 * @returns        The created LedgerEntry, or null if a duplicate was silently
 *                 swallowed (idempotence).
 */
export async function createLedgerEntry(
  params: CreateLedgerEntryParams,
  tx?: Prisma.TransactionClient,
): Promise<Prisma.LedgerEntryGetPayload<object> | null> {
  const { type, direction, amount, referenceId, bookingId, userId, metadata } = params;

  // ── Validation ────────────────────────────────────────────────────────────
  const numericAmount = amount instanceof Prisma.Decimal
    ? amount.toNumber()
    : Number(amount);

  if (!isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error(
      `[ledger] createLedgerEntry: amount must be > 0 (got ${String(amount)}) — type=${type}`,
    );
  }

  const decimalAmount = new Prisma.Decimal(numericAmount);

  // ── Write ─────────────────────────────────────────────────────────────────
  const client = tx ?? prisma;

  try {
    const entry = await client.ledgerEntry.create({
      data: {
        type,
        direction,
        amount: decimalAmount,
        referenceId: referenceId ?? null,
        bookingId:   bookingId   ?? null,
        userId:      userId      ?? null,
        metadata:    metadata    ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });

    logger.info('[ledger] entry created', {
      id:          entry.id,
      type:        entry.type,
      direction:   entry.direction,
      amount:      entry.amount.toFixed(2),
      referenceId: entry.referenceId,
      bookingId:   entry.bookingId,
    });

    return entry;
  } catch (err) {
    // P2002 = unique constraint violation → duplicate entry → idempotent swallow
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      logger.warn('[ledger] duplicate entry swallowed (idempotent)', {
        type,
        referenceId,
        bookingId,
      });
      return null;
    }

    // All other errors are re-thrown so the caller's transaction can roll back.
    logger.error('[ledger] createLedgerEntry failed', {
      type,
      referenceId,
      bookingId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
