const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Adding payment columns to SellerOrder...');
  await prisma.$executeRawUnsafe(`ALTER TABLE "SellerOrder" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT DEFAULT 'PENDING';`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "SellerOrder" ADD COLUMN IF NOT EXISTS "razorpayOrderId" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "SellerOrder" ADD COLUMN IF NOT EXISTS "razorpayPaymentId" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "SellerOrder" ADD COLUMN IF NOT EXISTS "razorpaySignature" TEXT;`);
  console.log('Successfully added payment columns to SellerOrder!');
  await prisma.$disconnect();
}
main().catch(err => {
  console.error(err);
  process.exit(1);
});
