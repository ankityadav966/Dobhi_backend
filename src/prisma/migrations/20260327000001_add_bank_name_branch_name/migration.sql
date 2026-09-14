-- Migration: add bankName and branchName to HelperBank
-- Both columns are nullable so existing rows are unaffected.

ALTER TABLE "HelperBank"
  ADD COLUMN IF NOT EXISTS "bankName"   TEXT,
  ADD COLUMN IF NOT EXISTS "branchName" TEXT;
