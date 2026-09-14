import { prisma } from '../prisma.client';
import { UserRole } from '@prisma/client';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt';

async function main() {
  const allUsers = await prisma.user.findMany();
  console.log('ALL USERS IN DB:');
  console.log(JSON.stringify(allUsers, null, 2));

  let admin = allUsers.find(u => u.role === UserRole.ADMIN);
  if (!admin) {
    console.log('No Admin user found, creating default Admin user...');
    admin = await prisma.user.create({
      data: {
        phone: '9999999999',
        fullName: 'Super Admin',
        role: UserRole.ADMIN,
        isActive: true
      }
    });
    console.log('Admin user created:', admin);
  } else {
    console.log('Found Admin user:', admin);
  }

  // Generate valid test JWT token for Admin
  const token = generateAccessToken({
    userId: String(admin.id),
    phone: admin.phone,
    role: 'ADMIN'
  });
  console.log('ADMIN_TOKEN_START');
  console.log(token);
  console.log('ADMIN_TOKEN_END');
}

main().catch(console.error).finally(() => prisma.$disconnect());
