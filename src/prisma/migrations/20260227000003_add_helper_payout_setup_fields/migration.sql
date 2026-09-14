-- Migration: 20260227000003_add_helper_payout_setup_fields
-- Adds payout registration state fields to Helper table.
-- All columns are nullable / have defaults → fully safe for production (no table rewrite).

ALTER TABLE "Helper"
  ADD COLUMN IF NOT EXISTS "payoutEnabled"     BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "payoutSetupStatus" TEXT         NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN IF NOT EXISTS "payoutRetryCount"  INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastPayoutRetryAt" TIMESTAMPTZ(3);

-- Index for the retry cron: quickly finds helpers needing fund-account registration
CREATE INDEX IF NOT EXISTS "Helper_payoutSetupStatus_idx" ON "Helper" ("payoutSetupStatus");
