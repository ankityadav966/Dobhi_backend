-- Migration: add_payment_status_enum
-- Replaces the raw TEXT column Payment.status with a proper PaymentStatus enum.
-- Data-safe: normalises every existing value (including the former 'completed' bug)
-- before casting the column type.

-- Step 1: Create the enum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED');

-- Step 2: Normalise existing string values to valid enum members.
--   'pending'   → CREATED  (initial state before Razorpay capture)
--   'completed' → CAPTURED  (old buggy value written by verifyPayment controller)
--   'captured'  → CAPTURED
--   'authorized'→ AUTHORIZED
--   'failed'    → FAILED
--   'refunded'  → REFUNDED
--   anything else → CREATED  (safe fallback)
UPDATE "Payment"
SET "status" = CASE LOWER("status")
  WHEN 'pending'    THEN 'CREATED'
  WHEN 'created'    THEN 'CREATED'
  WHEN 'authorized' THEN 'AUTHORIZED'
  WHEN 'captured'   THEN 'CAPTURED'
  WHEN 'completed'  THEN 'CAPTURED'
  WHEN 'failed'     THEN 'FAILED'
  WHEN 'refunded'   THEN 'REFUNDED'
  ELSE 'CREATED'
END;

-- Step 3: Drop the string default before changing the column type
ALTER TABLE "Payment" ALTER COLUMN "status" DROP DEFAULT;

-- Step 4: Cast the column in-place (no data loss — all values are now valid enum members)
ALTER TABLE "Payment"
  ALTER COLUMN "status" TYPE "PaymentStatus" USING "status"::"PaymentStatus";

-- Step 5: Re-apply the default using the enum type
ALTER TABLE "Payment" ALTER COLUMN "status" SET DEFAULT 'CREATED'::"PaymentStatus";
