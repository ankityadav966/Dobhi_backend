-- Drop otpHash and used columns from Otp table (logging-only mode)
ALTER TABLE "Otp" DROP COLUMN IF EXISTS "otpHash";
ALTER TABLE "Otp" DROP COLUMN IF EXISTS "used";
