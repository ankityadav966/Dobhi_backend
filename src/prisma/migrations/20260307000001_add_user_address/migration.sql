-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "address"   TEXT,
  ADD COLUMN "city"      TEXT,
  ADD COLUMN "pinCode"   TEXT,
  ADD COLUMN "latitude"  DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION;
