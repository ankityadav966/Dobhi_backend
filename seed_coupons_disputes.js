const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding initial Coupons and Disputes via SQL...');

  // 1. Coupons
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Coupon" ("code", "title", "description", "discountType", "discountValue", "minOrderValue", "maxDiscount", "usageLimit", "usedCount", "validFrom", "validUntil", "bgColor", "textColor", "isActive", "isFirstUserOnly", "createdAt", "updatedAt")
    VALUES
      ('FIRST50', 'Flat 50% Off First Order', 'Get 50% discount on your first grocery or laundry booking.', 'PERCENT', 50, 199, 100, 500, 0, NOW(), NOW() + INTERVAL '90 days', '#0B2239', '#ffffff', true, true, NOW(), NOW()),
      ('WELCOME100', 'Flat ₹100 Off', 'Instant ₹100 savings on orders above ₹499.', 'FLAT', 100, 499, 100, 1000, 0, NOW(), NOW() + INTERVAL '60 days', '#16a34a', '#ffffff', true, false, NOW(), NOW()),
      ('FREESHIP', 'Zero Delivery Fee', 'Free home delivery on all weekend orders.', 'FLAT', 49, 99, 49, 2000, 0, NOW(), NOW() + INTERVAL '30 days', '#7c3aed', '#ffffff', true, false, NOW(), NOW())
    ON CONFLICT ("code") DO NOTHING
  `);
  console.log('Coupons seeded.');

  // 2. Disputes
  await prisma.$executeRawUnsafe(`
    INSERT INTO "Dispute" ("ticketId", "orderId", "type", "reportedBy", "against", "issue", "description", "status", "priority", "hasProof", "createdAt", "updatedAt")
    VALUES
      ('DIS001', 'GL-GRC-89124', 'customer', 'Ananya Sharma', 'GreenFarm Organics', 'Missing 1 Item in Grocery Basket', 'Organic Spinach was not included in the bag delivered.', 'open', 'high', true, NOW(), NOW()),
      ('DIS002', 'GL-LND-2026-44101', 'partner', 'CleanWave Laundry', 'Kunal Singhania', 'Customer Not Responding on Pickup', 'Rider reached the gate but phone was switched off.', 'in-progress', 'medium', false, NOW(), NOW()),
      ('DIS003', 'HB001', 'customer', 'Vikram Patel', 'Sunita Devi', 'Late Arrival for Cooking', 'Helper arrived 45 minutes late, but issue resolved mutually.', 'resolved', 'low', false, NOW(), NOW())
    ON CONFLICT ("ticketId") DO NOTHING
  `);
  console.log('Disputes seeded.');

  const couponsCount = await prisma.$queryRawUnsafe(`SELECT count(*) FROM "Coupon"`);
  const disputesCount = await prisma.$queryRawUnsafe(`SELECT count(*) FROM "Dispute"`);
  console.log('Total Coupons in DB:', couponsCount[0].count);
  console.log('Total Disputes in DB:', disputesCount[0].count);

  await prisma.$disconnect();
}

seed().catch(console.error);
