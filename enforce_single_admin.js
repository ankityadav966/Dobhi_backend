const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanAdmins() {
  console.log('Enforcing SINGLE ADMIN in PostgreSQL database...');
  
  // 1. Ensure user ID 1 is the ONLY Super Admin
  await prisma.user.update({
    where: { phone: '9999999999' },
    data: { role: 'ADMIN', fullName: 'Super Admin' }
  });

  // 2. Demote all other users who were accidentally marked ADMIN to CUSTOMER
  const demoted = await prisma.user.updateMany({
    where: {
      role: 'ADMIN',
      phone: { not: '9999999999' }
    },
    data: { role: 'CUSTOMER' }
  });

  console.log(`Demoted ${demoted.count} non-admin users to CUSTOMER.`);

  // 3. Verify total admins in database
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, phone: true, fullName: true, role: true }
  });

  console.log(`Total ADMIN users in system: ${admins.length}`);
  console.table(admins);

  await prisma.$disconnect();
}

cleanAdmins().catch(e => {
  console.error(e);
  process.exit(1);
});
