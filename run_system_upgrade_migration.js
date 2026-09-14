const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function runMigration() {
  console.log('🚀 Starting Complete System Database Upgrade Migration...');

  // 1. Admin Email & Password in User Table
  console.log('1. Checking & updating User table for Admin credentials...');
  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "password" TEXT;`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_email_unique" ON "User"("email") WHERE "email" IS NOT NULL;`);

  // 2. Platform Category Model
  console.log('2. Checking & creating PlatformCategory table...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PlatformCategory" (
      "id" SERIAL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "slug" TEXT UNIQUE NOT NULL,
      "description" TEXT,
      "icon" TEXT DEFAULT 'Package',
      "image" TEXT,
      "isActive" BOOLEAN DEFAULT true,
      "sortOrder" INTEGER DEFAULT 0,
      "createdAt" TIMESTAMPTZ(3) DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ(3) DEFAULT NOW()
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_platform_cat_slug" ON "PlatformCategory"("slug");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_platform_cat_active" ON "PlatformCategory"("isActive");`);

  // 3. Seller Enhancements
  console.log('3. Updating Seller table...');
  await prisma.$executeRawUnsafe(`ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "categoryId" INTEGER;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "otp" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "otpExpiresAt" TIMESTAMPTZ(3);`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "Seller" ADD COLUMN IF NOT EXISTS "otpAttempts" INTEGER DEFAULT 0;`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_seller_category_id" ON "Seller"("categoryId");`);

  // 4. SellerWorker Enhancements
  console.log('4. Updating SellerWorker table...');
  await prisma.$executeRawUnsafe(`ALTER TABLE "SellerWorker" ADD COLUMN IF NOT EXISTS "email" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "SellerWorker" ADD COLUMN IF NOT EXISTS "otp" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "SellerWorker" ADD COLUMN IF NOT EXISTS "otpExpiresAt" TIMESTAMPTZ(3);`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "SellerWorker" ADD COLUMN IF NOT EXISTS "otpAttempts" INTEGER DEFAULT 0;`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_worker_email" ON "SellerWorker"("email");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_worker_seller_id" ON "SellerWorker"("sellerId");`);

  // 5. SellerOrder Delivery & OTP Fields
  console.log('5. Updating SellerOrder table for arrival, customer OTP & category...');
  await prisma.$executeRawUnsafe(`ALTER TABLE "SellerOrder" ADD COLUMN IF NOT EXISTS "customerEmail" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "SellerOrder" ADD COLUMN IF NOT EXISTS "deliveryOtp" TEXT;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "SellerOrder" ADD COLUMN IF NOT EXISTS "deliveryOtpExpiresAt" TIMESTAMPTZ(3);`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "SellerOrder" ADD COLUMN IF NOT EXISTS "deliveryOtpVerified" BOOLEAN DEFAULT false;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "SellerOrder" ADD COLUMN IF NOT EXISTS "deliveryOtpAttempts" INTEGER DEFAULT 0;`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "SellerOrder" ADD COLUMN IF NOT EXISTS "arrivedAt" TIMESTAMPTZ(3);`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "SellerOrder" ADD COLUMN IF NOT EXISTS "categoryId" INTEGER;`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_seller_order_cat_id" ON "SellerOrder"("categoryId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_seller_order_worker_id" ON "SellerOrder"("assignedWorkerId");`);

  // 6. Platform Announcements Table
  console.log('6. Creating PlatformAnnouncement table...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PlatformAnnouncement" (
      "id" SERIAL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "targetUsers" TEXT NOT NULL DEFAULT 'ALL_SELLERS',
      "categoryId" INTEGER,
      "emailSent" BOOLEAN DEFAULT false,
      "createdAt" TIMESTAMPTZ(3) DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ(3) DEFAULT NOW()
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_announcement_created" ON "PlatformAnnouncement"("createdAt");`);

  // 7. Platform Notifications Table for history
  console.log('7. Creating PlatformNotification table for in-app and email history...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PlatformNotification" (
      "id" SERIAL PRIMARY KEY,
      "userId" INTEGER,
      "recipientType" TEXT NOT NULL DEFAULT 'SELLER',
      "recipientEmail" TEXT,
      "title" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "type" TEXT NOT NULL DEFAULT 'GENERAL',
      "isRead" BOOLEAN DEFAULT false,
      "metadata" JSONB,
      "createdAt" TIMESTAMPTZ(3) DEFAULT NOW()
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_notification_recip" ON "PlatformNotification"("recipientType", "recipientEmail");`);

  // 8. Seed Default Dynamic Categories if empty
  console.log('8. Seeding initial categories into PlatformCategory...');
  const initialCategories = [
    { name: 'Grocery', slug: 'grocery', description: 'Fresh vegetables, daily essentials, and packaged goods', icon: 'ShoppingCart', sortOrder: 1 },
    { name: 'Laundry', slug: 'laundry', description: 'Professional wash, fold, dry clean & fabric care', icon: 'Shirt', sortOrder: 2 },
    { name: 'Bakery', slug: 'bakery', description: 'Artisan breads, fresh pastries, and custom cakes', icon: 'Croissant', sortOrder: 3 },
    { name: 'General Store', slug: 'general-store', description: 'Convenience store products and general household goods', icon: 'Store', sortOrder: 4 },
    { name: 'Home Services', slug: 'home-services', description: 'Cleaning, electrical, plumbing, and home repairs', icon: 'Wrench', sortOrder: 5 },
  ];

  for (const cat of initialCategories) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "PlatformCategory" ("name", "slug", "description", "icon", "isActive", "sortOrder", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, true, $5, NOW(), NOW())
      ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name", "description" = EXCLUDED."description", "icon" = EXCLUDED."icon";
    `, cat.name, cat.slug, cat.description, cat.icon, cat.sortOrder);
  }

  // Link existing sellers to PlatformCategory
  const cats = await prisma.$queryRawUnsafe(`SELECT id, slug, name FROM "PlatformCategory"`);
  const catMap = {};
  for (const c of cats) {
    catMap[c.slug] = c.id;
    catMap[c.name.toLowerCase()] = c.id;
  }

  const sellers = await prisma.$queryRawUnsafe(`SELECT id, "businessType" FROM "Seller"`);
  for (const s of sellers) {
    const type = (s.businessType || 'grocery').toLowerCase();
    const matchedCatId = catMap[type] || catMap['grocery'] || cats[0]?.id;
    if (matchedCatId) {
      await prisma.$executeRawUnsafe(`UPDATE "Seller" SET "categoryId" = $1 WHERE id = $2`, matchedCatId, s.id);
    }
  }

  // Link existing SellerOrders to PlatformCategory
  await prisma.$executeRawUnsafe(`
    UPDATE "SellerOrder" so
    SET "categoryId" = s."categoryId"
    FROM "Seller" s
    WHERE so."sellerId" = s.id AND so."categoryId" IS NULL AND s."categoryId" IS NOT NULL;
  `);

  // 9. Seed/Update Super Admin with email & hashed password
  console.log('9. Ensuring Super Admin credentials in User table...');
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('admin123', salt);

  // Check if admin with phone 9999999999 exists
  const existingAdminRows = await prisma.$queryRawUnsafe(`SELECT id FROM "User" WHERE role = 'ADMIN' OR phone = '9999999999' LIMIT 1`);
  if (existingAdminRows && existingAdminRows.length > 0) {
    const adminId = existingAdminRows[0].id;
    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET email = $1, password = $2, "fullName" = 'Super Admin', role = 'ADMIN', "isActive" = true WHERE id = $3`,
      'admin@gmail.com',
      hashedPassword,
      adminId
    );
    console.log(`Updated existing Admin (User ID: ${adminId}) with email admin@gmail.com and secure password.`);
  } else {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "User" (phone, email, password, "fullName", role, "isActive", "createdAt", "updatedAt")
      VALUES ('9999999999', 'admin@gmail.com', $1, 'Super Admin', 'ADMIN', true, NOW(), NOW())
    `, hashedPassword);
    console.log(`Created new Super Admin with email admin@gmail.com.`);
  }

  // 10. Link or create default test seller & test worker for instant testing
  console.log('10. Setting up test seller & worker records...');
  const sellerRows = await prisma.$queryRawUnsafe(`SELECT id FROM "Seller" WHERE email = 'seller@example.com' LIMIT 1`);
  let testSellerId;

  if (sellerRows && sellerRows.length > 0) {
    testSellerId = sellerRows[0].id;
  } else {
    const inserted = await prisma.$queryRawUnsafe(`
      INSERT INTO "Seller" ("businessName", "ownerName", phone, email, address, city, pincode, "businessType", "categoryId", status, "isVerified", "dailyOrderLimit", "deliveryRadiusKm", "createdAt", "updatedAt")
      VALUES ('Apex Grocery Store', 'Apex Owner', '9829099999', 'seller@example.com', 'Malviya Nagar, Jaipur, Rajasthan', 'Jaipur', '302017', 'grocery', $1, 'APPROVED', true, 50, 10.0, NOW(), NOW())
      RETURNING id;
    `, catMap['grocery'] || 1);
    testSellerId = inserted[0].id;
    console.log(`Created test seller: seller@example.com (ID: ${testSellerId})`);
  }

  // Ensure test worker exists for test seller
  const testWorker = await prisma.$queryRawUnsafe(`SELECT * FROM "SellerWorker" WHERE email = 'worker@example.com' LIMIT 1`);
  if (!testWorker || testWorker.length === 0) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "SellerWorker" ("workerId", "sellerId", "name", "phone", "email", "role", "passcode", "isActive", "assignedOrdersCount", "createdAt", "updatedAt")
      VALUES ('WRK-GRC-101', $1, 'Ravi Verma', '9829088888', 'worker@example.com', 'Delivery Executive', '1234', true, 0, NOW(), NOW())
      ON CONFLICT DO NOTHING;
    `, testSellerId);
    console.log(`Created test worker: worker@example.com linked to seller #${testSellerId}`);
  }

  console.log('✅ Complete System Database Upgrade Migration finished successfully!');
  await prisma.$disconnect();
}

runMigration().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
