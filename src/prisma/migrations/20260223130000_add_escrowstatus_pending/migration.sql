-- Migration: add_escrowstatus_pending
-- Adds PENDING as the initial escrow state (pre-capture).
-- Escrow lifecycle: PENDING → LOCKED (on capture) → RELEASED (on payout) / REFUNDED (on cancel)

-- Step 1: Add PENDING value to the EscrowStatus enum (already added)

-- Step 2: Change the column default from LOCKED to PENDING
ALTER TABLE "Payment" ALTER COLUMN "escrowStatus" SET DEFAULT 'PENDING'::"EscrowStatus";

-- Step 3: Correct any existing Payment rows that were created before this fix.
--   Rows with status = CREATED (pre-capture) should never have had escrowStatus = LOCKED.
--   Reset them to PENDING so the lifecycle is consistent.
UPDATE "Payment"
SET "escrowStatus" = 'PENDING'::"EscrowStatus"
WHERE "status" = 'CREATED'::"PaymentStatus"
  AND "escrowStatus" = 'LOCKED'::"EscrowStatus";
