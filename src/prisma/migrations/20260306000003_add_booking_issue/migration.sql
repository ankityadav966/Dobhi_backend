-- CreateTable
CREATE TABLE "BookingIssue" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "helperId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingIssue_bookingId_idx" ON "BookingIssue"("bookingId");

-- CreateIndex
CREATE INDEX "BookingIssue_helperId_idx" ON "BookingIssue"("helperId");

-- AddForeignKey
ALTER TABLE "BookingIssue" ADD CONSTRAINT "BookingIssue_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
