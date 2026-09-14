-- Migration: add_razorpay_fund_account_id
-- Safe additive-only migration for production.
-- Adds a nullable TEXT column to HelperBank with no unique constraint.
-- Existing rows remain untouched (column defaults to NULL).
-- Idempotent: IF NOT EXISTS prevents failure on re-run.

ALTER TABLE "HelperBank"
  ADD COLUMN IF NOT EXISTS "razorpayFundAccountId" TEXT;
