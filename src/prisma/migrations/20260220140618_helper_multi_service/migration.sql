/*
  Warnings:

  - You are about to drop the column `serviceId` on the `Helper` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Helper" DROP CONSTRAINT "Helper_serviceId_fkey";

-- DropIndex
DROP INDEX "Helper_serviceId_idx";

-- AlterTable
ALTER TABLE "Helper" DROP COLUMN "serviceId";

-- CreateTable
CREATE TABLE "HelperService" (
    "id" SERIAL NOT NULL,
    "helperId" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelperService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HelperService_helperId_idx" ON "HelperService"("helperId");

-- CreateIndex
CREATE INDEX "HelperService_serviceId_idx" ON "HelperService"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "HelperService_helperId_serviceId_key" ON "HelperService"("helperId", "serviceId");

-- AddForeignKey
ALTER TABLE "HelperService" ADD CONSTRAINT "HelperService_helperId_fkey" FOREIGN KEY ("helperId") REFERENCES "Helper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HelperService" ADD CONSTRAINT "HelperService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
