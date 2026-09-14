const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const services = await prisma.service.findMany({ include: { plans: true } });
  console.log('Services:', services.length, services.map(s => ({ id: s.id, name: s.name, plans: s.plans.length })));
  
  const users = await prisma.user.findMany({ take: 5, select: { id: true, fullName: true, phone: true, role: true } });
  console.log('Users:', users);
  
  const bookings = await prisma.booking.findMany({ take: 5 });
  console.log('Bookings:', bookings.length);
  
  const tables = await prisma.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log('Tables in DB:', tables.map(t => t.table_name));
  
  await prisma.$disconnect();
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
