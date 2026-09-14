-- Migration: add_payout_retry_fields
-- Safe additive-only migration for production.
-- Adds retry tracking columns to Booking.
-- All columns are nullable / default 0 — existing rows remain untouched.
-- Idempotent: IF NOT EXISTS prevents failure on re-run.

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "retryCount"   INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastRetryAt"  TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "nextRetryAt"  TIMESTAMPTZ(3);

-- Index to speed up the cron filter: payoutStatus = PENDING AND nextRetryAt <= now
CREATE INDEX IF NOT EXISTS "Booking_nextRetryAt_idx" ON "Booking" ("nextRetryAt");
