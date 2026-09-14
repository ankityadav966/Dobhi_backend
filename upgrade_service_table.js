const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Altering Service table to add missing fields (imageUrl, icon, description, etc.)...');
  
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Service" 
    ADD COLUMN IF NOT EXISTS "imageUrl" TEXT,
    ADD COLUMN IF NOT EXISTS "icon" TEXT,
    ADD COLUMN IF NOT EXISTS "description" TEXT,
    ADD COLUMN IF NOT EXISTS "price" DOUBLE PRECISION DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "originalPrice" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "duration" INTEGER,
    ADD COLUMN IF NOT EXISTS "category" TEXT,
    ADD COLUMN IF NOT EXISTS "categoryId" INTEGER;
  `);

  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Service';
  `);

  console.log('Updated columns in Service table:');
  console.log(cols.map(c => `${c.column_name} (${c.data_type})`));

  await prisma.$disconnect();
}

main().catch(console.error);
