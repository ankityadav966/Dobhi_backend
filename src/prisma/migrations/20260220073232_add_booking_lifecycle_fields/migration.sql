-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "cancelledBy" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "payoutAt" TIMESTAMP(3),
ADD COLUMN     "payoutEligibleAt" TIMESTAMP(3),
ADD COLUMN     "payoutId" TEXT;
