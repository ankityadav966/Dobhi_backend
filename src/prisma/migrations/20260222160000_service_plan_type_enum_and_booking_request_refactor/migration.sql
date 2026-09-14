-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('HOURLY', 'PER_DAY', 'MONTHLY');

-- DropIndex: Service.category
DROP INDEX IF EXISTS "Service_category_idx";

-- DropIndex: Service.name unique
DROP INDEX IF EXISTS "Service_name_key";

-- AlterTable Service: drop fields removed from model
ALTER TABLE "Service"
  DROP COLUMN IF EXISTS "title",
  DROP COLUMN IF EXISTS "category",
  DROP COLUMN IF EXISTS "description",
  DROP COLUMN IF EXISTS "hourlyRate",
  DROP COLUMN IF EXISTS "minimumHours",
  DROP COLUMN IF EXISTS "maximumHours",
  DROP COLUMN IF EXISTS "isAvailable";

-- AlterTable ServicePlan: drop old unique constraint
ALTER TABLE "ServicePlan" DROP CONSTRAINT IF EXISTS "ServicePlan_serviceId_planType_key";

-- AlterTable ServicePlan: drop isActive
ALTER TABLE "ServicePlan" DROP COLUMN IF EXISTS "isActive";

-- AlterTable ServicePlan: add type column (PlanType enum), migrate planType values
ALTER TABLE "ServicePlan" ADD COLUMN "type" "PlanType";
UPDATE "ServicePlan" SET "type" = 'HOURLY'  WHERE UPPER("planType") = 'HOURLY';
UPDATE "ServicePlan" SET "type" = 'PER_DAY' WHERE UPPER("planType") = 'PER_DAY';
UPDATE "ServicePlan" SET "type" = 'MONTHLY' WHERE UPPER("planType") = 'MONTHLY';
-- Default remaining rows (dev only)
UPDATE "ServicePlan" SET "type" = 'HOURLY' WHERE "type" IS NULL;
ALTER TABLE "ServicePlan" ALTER COLUMN "type" SET NOT NULL;
ALTER TABLE "ServicePlan" DROP COLUMN IF EXISTS "planType";

-- AlterTable ServicePlan: rename duration -> durationHours
ALTER TABLE "ServicePlan" RENAME COLUMN "duration" TO "durationHours";

-- AlterTable ServicePlan: add new unique constraint
ALTER TABLE "ServicePlan"
  ADD CONSTRAINT "ServicePlan_serviceId_type_key" UNIQUE ("serviceId", "type");

-- AlterTable BookingRequest: remove serviceCategory, estimatedBudget
ALTER TABLE "BookingRequest"
  DROP COLUMN IF EXISTS "serviceCategory",
  DROP COLUMN IF EXISTS "estimatedBudget";

-- AlterTable BookingRequest: add servicePlanId (NOT NULL, FK to ServicePlan)
ALTER TABLE "BookingRequest" ADD COLUMN "servicePlanId" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "BookingRequest" ALTER COLUMN "servicePlanId" DROP DEFAULT;
ALTER TABLE "BookingRequest"
  ADD CONSTRAINT "BookingRequest_servicePlanId_fkey"
  FOREIGN KEY ("servicePlanId") REFERENCES "ServicePlan"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
