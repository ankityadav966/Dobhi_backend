-- Migration: add_notification_is_read
-- Adds isRead flag to NotificationLog for full read/unread tracking.

ALTER TABLE "NotificationLog" ADD COLUMN "isRead" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "NotificationLog_isRead_idx" ON "NotificationLog"("isRead");
