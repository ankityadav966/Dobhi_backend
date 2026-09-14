const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const commands = [
    'ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION',
    'ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION',
    'ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "dailyOrderLimit" INTEGER DEFAULT 10',
    'ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "ordersToday" INTEGER DEFAULT 0',
    'ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "lastOrderDate" TIMESTAMP(3)',
    'ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "subscriptionPlan" TEXT DEFAULT \'FREE\'',
    'ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "isPro" BOOLEAN DEFAULT false',

    'ALTER TABLE "SellerOrder" ADD COLUMN IF NOT EXISTS "customerLat" DOUBLE PRECISION',
    'ALTER TABLE "SellerOrder" ADD COLUMN IF NOT EXISTS "customerLng" DOUBLE PRECISION',
    'ALTER TABLE "SellerOrder" ADD COLUMN IF NOT EXISTS "storeLat" DOUBLE PRECISION',
    'ALTER TABLE "SellerOrder" ADD COLUMN IF NOT EXISTS "storeLng" DOUBLE PRECISION',
    'ALTER TABLE "SellerOrder" ADD COLUMN IF NOT EXISTS "dispatchRadiusKm" DOUBLE PRECISION DEFAULT 3.0'
  ];

  for (const cmd of commands) {
    await prisma.$executeRawUnsafe(cmd);
  }
  console.log('Database columns added successfully to Seller & SellerOrder tables');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
