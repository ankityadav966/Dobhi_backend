const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const services = await prisma.$queryRawUnsafe('SELECT id, name, category, "categoryId" FROM "Service"');
  console.log('All services:', services);
  await prisma.$disconnect();
}
run();
