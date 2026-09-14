/*
  Warnings:

  - The values [PENDING_PROFILE] on the enum `OnboardingStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `phone` on the `Helper` table. All the data in the column will be lost.
  - You are about to drop the column `averageRating` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `isOnline` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `latitude` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `User` table. All the data in the column will be lost.
  - The `role` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[userId]` on the table `Helper` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `Helper` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('HELPER', 'ADMIN');

-- AlterEnum
BEGIN;
CREATE TYPE "OnboardingStatus_new" AS ENUM ('PENDING_KYC', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');
ALTER TABLE "Helper" ALTER COLUMN "onboardingStatus" DROP DEFAULT;
ALTER TABLE "Helper" ALTER COLUMN "onboardingStatus" TYPE "OnboardingStatus_new" USING ("onboardingStatus"::text::"OnboardingStatus_new");
ALTER TYPE "OnboardingStatus" RENAME TO "OnboardingStatus_old";
ALTER TYPE "OnboardingStatus_new" RENAME TO "OnboardingStatus";
DROP TYPE "OnboardingStatus_old";
ALTER TABLE "Helper" ALTER COLUMN "onboardingStatus" SET DEFAULT 'PENDING_KYC';
COMMIT;

-- DropIndex
DROP INDEX "Helper_phone_key";

-- AlterTable
ALTER TABLE "Helper" DROP COLUMN "phone",
ADD COLUMN     "userId" INTEGER NOT NULL,
ALTER COLUMN "onboardingStatus" SET DEFAULT 'PENDING_KYC';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "averageRating",
DROP COLUMN "isOnline",
DROP COLUMN "latitude",
DROP COLUMN "longitude",
DROP COLUMN "role",
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'HELPER';

-- CreateIndex
CREATE UNIQUE INDEX "Helper_userId_key" ON "Helper"("userId");

-- CreateIndex
CREATE INDEX "Helper_userId_idx" ON "Helper"("userId");

-- CreateIndex
CREATE INDEX "Helper_onboardingStatus_idx" ON "Helper"("onboardingStatus");

-- CreateIndex
CREATE INDEX "Helper_isAvailable_idx" ON "Helper"("isAvailable");

-- CreateIndex
CREATE INDEX "Helper_isOnline_idx" ON "Helper"("isOnline");

-- AddForeignKey
ALTER TABLE "Helper" ADD CONSTRAINT "Helper_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
