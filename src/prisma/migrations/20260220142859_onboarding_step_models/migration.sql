/*
  Warnings:

  - You are about to drop the column `experience` on the `Helper` table. All the data in the column will be lost.
  - You are about to drop the column `lat` on the `Helper` table. All the data in the column will be lost.
  - You are about to drop the column `lng` on the `Helper` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Helper` table. All the data in the column will be lost.
  - You are about to drop the column `helperId` on the `Service` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Helper" DROP COLUMN "experience",
DROP COLUMN "lat",
DROP COLUMN "lng",
DROP COLUMN "name";

-- AlterTable
ALTER TABLE "Service" DROP COLUMN "helperId";

-- CreateTable
CREATE TABLE "HelperProfile" (
    "id" SERIAL NOT NULL,
    "helperId" INTEGER NOT NULL,
    "gender" TEXT,
    "address" TEXT,
    "city" TEXT,
    "pinCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "workType" TEXT,
    "experienceYears" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelperProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelperKyc" (
    "id" SERIAL NOT NULL,
    "helperId" INTEGER NOT NULL,
    "selfieUrl" TEXT,
    "panUrl" TEXT,
    "policeUrl" TEXT,
    "panNumber" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelperKyc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelperBank" (
    "id" SERIAL NOT NULL,
    "helperId" INTEGER NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelperBank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelperAvailability" (
    "id" SERIAL NOT NULL,
    "helperId" INTEGER NOT NULL,
    "monday" BOOLEAN NOT NULL DEFAULT false,
    "tuesday" BOOLEAN NOT NULL DEFAULT false,
    "wednesday" BOOLEAN NOT NULL DEFAULT false,
    "thursday" BOOLEAN NOT NULL DEFAULT false,
    "friday" BOOLEAN NOT NULL DEFAULT false,
    "saturday" BOOLEAN NOT NULL DEFAULT false,
    "sunday" BOOLEAN NOT NULL DEFAULT false,
    "startTime" TEXT,
    "endTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelperAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HelperProfile_helperId_key" ON "HelperProfile"("helperId");

-- CreateIndex
CREATE INDEX "HelperProfile_helperId_idx" ON "HelperProfile"("helperId");

-- CreateIndex
CREATE UNIQUE INDEX "HelperKyc_helperId_key" ON "HelperKyc"("helperId");

-- CreateIndex
CREATE INDEX "HelperKyc_helperId_idx" ON "HelperKyc"("helperId");

-- CreateIndex
CREATE UNIQUE INDEX "HelperBank_helperId_key" ON "HelperBank"("helperId");

-- CreateIndex
CREATE INDEX "HelperBank_helperId_idx" ON "HelperBank"("helperId");

-- CreateIndex
CREATE UNIQUE INDEX "HelperAvailability_helperId_key" ON "HelperAvailability"("helperId");

-- CreateIndex
CREATE INDEX "HelperAvailability_helperId_idx" ON "HelperAvailability"("helperId");

-- AddForeignKey
ALTER TABLE "HelperProfile" ADD CONSTRAINT "HelperProfile_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES "Helper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelperKyc" ADD CONSTRAINT "HelperKyc_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES "Helper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelperBank" ADD CONSTRAINT "HelperBank_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES "Helper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelperAvailability" ADD CONSTRAINT "HelperAvailability_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES "Helper"("id") ON DELETE CASCADE ON UPDATE CASCADE;
