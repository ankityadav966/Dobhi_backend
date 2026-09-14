const { PrismaClient } = require('E:/ankit/app\'s/Dobhi_backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Creating PlatformOtp table...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PlatformOtp" (
      "id" SERIAL PRIMARY KEY,
      "email" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "purpose" TEXT NOT NULL,
      "expiresAt" TIMESTAMPTZ(3) NOT NULL,
      "isVerified" BOOLEAN DEFAULT false,
      "attempts" INTEGER DEFAULT 0,
      "createdAt" TIMESTAMPTZ(3) DEFAULT NOW()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "idx_platform_otp_email_purpose" ON "PlatformOtp"("email", "purpose");
  `);

  console.log('PlatformOtp table created successfully!');
}

run()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
