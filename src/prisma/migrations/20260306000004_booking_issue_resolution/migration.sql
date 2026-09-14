-- AlterTable: add resolution tracking columns to BookingIssue
ALTER TABLE "BookingIssue"
    ADD COLUMN "resolved"   BOOLEAN      NOT NULL DEFAULT false,
    ADD COLUMN "resolvedAt" TIMESTAMPTZ(3),
    ADD COLUMN "resolvedBy" TEXT;

-- CreateIndex: speed up filtering by unresolved issues
CREATE INDEX "BookingIssue_resolved_idx" ON "BookingIssue"("resolved");
