-- Migration: 20260227000004_add_ledger_entry
-- Adds immutable double-entry financial ledger to the database.

-- Create LedgerType enum
CREATE TYPE "LedgerType" AS ENUM (
  'PAYMENT_CAPTURED',
  'ESCROW_LOCK',
  'COMMISSION_EARNED',
  'HELPER_PAYOUT',
  'REFUND_ISSUED',
  'PAYOUT_REVERSAL'
);

-- Create LedgerDirection enum
CREATE TYPE "LedgerDirection" AS ENUM (
  'CREDIT',
  'DEBIT'
);

-- Create LedgerEntry table (immutable — insert only, no FK relations)
CREATE TABLE "LedgerEntry" (
  "id"          SERIAL          PRIMARY KEY,
  "bookingId"   INTEGER,
  "userId"      INTEGER,
  "type"        "LedgerType"    NOT NULL,
  "direction"   "LedgerDirection" NOT NULL,
  "amount"      DECIMAL(14,2)   NOT NULL,
  "referenceId" TEXT,
  "metadata"    JSONB,
  "createdAt"   TIMESTAMPTZ(3)  NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX "LedgerEntry_bookingId_idx" ON "LedgerEntry" ("bookingId");
CREATE INDEX "LedgerEntry_userId_idx"    ON "LedgerEntry" ("userId");
CREATE INDEX "LedgerEntry_type_idx"      ON "LedgerEntry" ("type");
CREATE INDEX "LedgerEntry_createdAt_idx" ON "LedgerEntry" ("createdAt");

-- Idempotency constraint: prevents duplicate entries for the same event
CREATE UNIQUE INDEX "LedgerEntry_type_referenceId_key" ON "LedgerEntry" ("type", "referenceId");
