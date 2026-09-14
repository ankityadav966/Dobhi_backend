-- Migration: 20260306000002_add_booking_job_timer
-- Adds jobTimerStarted flag and jobStartedAt timestamp to Booking for job timer tracking.

ALTER TABLE "Booking"
  ADD COLUMN "jobTimerStarted" BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN "jobStartedAt"    TIMESTAMPTZ(3);
