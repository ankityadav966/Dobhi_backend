-- Migration: add_helper_location
-- Creates the HelperLocation table for dedicated live-location tracking.
-- One row per helper (unique on helperId). Managed via upsert; existing
-- HelperProfile lat/lng fields are unchanged.

CREATE TABLE "HelperLocation" (
  "id"        SERIAL       NOT NULL,
  "helperId"  INTEGER      NOT NULL,
  "latitude"  DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "heading"   DOUBLE PRECISION,
  "accuracy"  DOUBLE PRECISION,
  "speed"     DOUBLE PRECISION,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),

  CONSTRAINT "HelperLocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HelperLocation_helperId_key" ON "HelperLocation"("helperId");
CREATE INDEX "HelperLocation_helperId_idx"     ON "HelperLocation"("helperId");

ALTER TABLE "HelperLocation"
  ADD CONSTRAINT "HelperLocation_helperId_fkey"
  FOREIGN KEY ("helperId") REFERENCES "Helper"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
