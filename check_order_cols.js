const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cols = await prisma.$queryRawUnsafe("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_name IN ('SellerWorker', 'Seller', 'User', 'ServiceCategory') ORDER BY table_name, ordinal_position");
  console.log('Columns:', JSON.stringify(cols, null, 2));
  await prisma.$disconnect();
}
main().catch(console.error);
