-- Add blockedReason column to User table for admin block tracking
ALTER TABLE "User" ADD COLUMN "blockedReason" TEXT;
