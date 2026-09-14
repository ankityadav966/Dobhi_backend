-- Migration: 20260306000001_add_booking_work_photos
-- Adds WorkPhotoType enum and BookingWorkPhoto table for before/after job photos.

-- Create WorkPhotoType enum
CREATE TYPE "WorkPhotoType" AS ENUM ('BEFORE', 'AFTER');

-- Create BookingWorkPhoto table
CREATE TABLE "BookingWorkPhoto" (
  "id"        SERIAL          PRIMARY KEY,
  "bookingId" INTEGER         NOT NULL,
  "photoUrl"  TEXT            NOT NULL,
  "type"      "WorkPhotoType" NOT NULL,
  "createdAt" TIMESTAMPTZ(3)  NOT NULL DEFAULT NOW(),

  CONSTRAINT "BookingWorkPhoto_bookingId_fkey"
    FOREIGN KEY ("bookingId")
    REFERENCES "Booking" ("id")
    ON DELETE CASCADE
);

-- Indexes
CREATE INDEX "BookingWorkPhoto_bookingId_idx"      ON "BookingWorkPhoto" ("bookingId");
CREATE INDEX "BookingWorkPhoto_bookingId_type_idx" ON "BookingWorkPhoto" ("bookingId", "type");
