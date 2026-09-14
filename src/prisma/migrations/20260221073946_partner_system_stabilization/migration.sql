/*
  Warnings:

  - A unique constraint covering the columns `[panNumber]` on the table `HelperKyc` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[idfyRequestId]` on the table `HelperKyc` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "PayoutStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "commissionRateSnapshot" DOUBLE PRECISION,
ADD COLUMN     "helperPayoutAmount" DOUBLE PRECISION,
ADD COLUMN     "platformCommissionAmount" DOUBLE PRECISION,
ADD COLUMN     "refundAmount" DOUBLE PRECISION,
ADD COLUMN     "refundedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Helper" ADD COLUMN     "lastStrikeAt" TIMESTAMP(3),
ADD COLUMN     "strikeCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "HelperKyc" ADD COLUMN     "idfyRawResponse" JSONB,
ADD COLUMN     "idfyRequestId" TEXT,
ADD COLUMN     "nameMatchScore" DOUBLE PRECISION,
ADD COLUMN     "panNameFromApi" TEXT,
ADD COLUMN     "verificationStatus" TEXT;

-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- CreateTable
CREATE TABLE "OtpSecurity" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastSentAt" TIMESTAMP(3),
    "resendCount" INTEGER NOT NULL DEFAULT 0,
    "resendResetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtpSecurity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthAudit" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "phone" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OtpSecurity_phone_key" ON "OtpSecurity"("phone");

-- CreateIndex
CREATE INDEX "OtpSecurity_phone_idx" ON "OtpSecurity"("phone");

-- CreateIndex
CREATE INDEX "AuthAudit_phone_idx" ON "AuthAudit"("phone");

-- CreateIndex
CREATE INDEX "AuthAudit_userId_idx" ON "AuthAudit"("userId");

-- CreateIndex
CREATE INDEX "AuthAudit_event_idx" ON "AuthAudit"("event");

-- CreateIndex
CREATE INDEX "AuthAudit_createdAt_idx" ON "AuthAudit"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HelperKyc_panNumber_key" ON "HelperKyc"("panNumber");

-- CreateIndex
CREATE UNIQUE INDEX "HelperKyc_idfyRequestId_key" ON "HelperKyc"("idfyRequestId");

-- CreateIndex
CREATE INDEX "HelperKyc_panNumber_idx" ON "HelperKyc"("panNumber");

-- CreateIndex
CREATE INDEX "HelperKyc_idfyRequestId_idx" ON "HelperKyc"("idfyRequestId");
