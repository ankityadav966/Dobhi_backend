-- ================= DEVICE TOKENS =================

CREATE TABLE "DeviceToken" (
    "id"        SERIAL          NOT NULL,
    "userId"    INTEGER         NOT NULL,
    "token"     TEXT            NOT NULL,
    "platform"  TEXT            NOT NULL,
    "createdAt" TIMESTAMPTZ(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");
CREATE INDEX "DeviceToken_userId_idx" ON "DeviceToken"("userId");

ALTER TABLE "DeviceToken"
    ADD CONSTRAINT "DeviceToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ================= NOTIFICATION LOG =================

CREATE TABLE "NotificationLog" (
    "id"        SERIAL          NOT NULL,
    "userId"    INTEGER         NOT NULL,
    "title"     TEXT            NOT NULL,
    "body"      TEXT            NOT NULL,
    "type"      TEXT            NOT NULL,
    "data"      JSONB,
    "createdAt" TIMESTAMPTZ(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotificationLog_userId_idx" ON "NotificationLog"("userId");
CREATE INDEX "NotificationLog_type_idx"   ON "NotificationLog"("type");

ALTER TABLE "NotificationLog"
    ADD CONSTRAINT "NotificationLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
