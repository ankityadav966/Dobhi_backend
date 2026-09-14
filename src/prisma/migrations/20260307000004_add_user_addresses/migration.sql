-- CreateTable
CREATE TABLE "UserAddress" (
    "id"        SERIAL NOT NULL,
    "userId"    INTEGER NOT NULL,
    "label"     TEXT,
    "address"   TEXT NOT NULL,
    "city"      TEXT NOT NULL,
    "pinCode"   TEXT NOT NULL,
    "latitude"  DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAddress_userId_idx" ON "UserAddress"("userId");

-- AddForeignKey
ALTER TABLE "UserAddress" ADD CONSTRAINT "UserAddress_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
