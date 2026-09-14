const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  console.log('🚀 Running Complete Category System Migration...');

  // 1. FAQ Table
  console.log('1. Creating FAQ table...');
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FAQ" (
      "id" SERIAL PRIMARY KEY,
      "question" TEXT NOT NULL,
      "answer" TEXT NOT NULL,
      "categoryId" INTEGER REFERENCES "PlatformCategory"("id") ON DELETE SET NULL,
      "category" TEXT,
      "isActive" BOOLEAN DEFAULT true,
      "sortOrder" INTEGER DEFAULT 0,
      "createdAt" TIMESTAMPTZ(3) DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ(3) DEFAULT NOW()
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_faq_cat_id" ON "FAQ"("categoryId");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_faq_category" ON "FAQ"("category");`);

  // 2. Coupon Table Enhancement
  console.log('2. Updating Coupon table with categoryId...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Coupon" 
    ADD COLUMN IF NOT EXISTS "categoryId" INTEGER REFERENCES "PlatformCategory"("id") ON DELETE SET NULL;
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_coupon_category_id" ON "Coupon"("categoryId");`);

  // 3. ServiceCategory Table Enhancement
  console.log('3. Updating ServiceCategory table with platformCategoryId...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "ServiceCategory" 
    ADD COLUMN IF NOT EXISTS "platformCategoryId" INTEGER REFERENCES "PlatformCategory"("id") ON DELETE SET NULL;
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_service_cat_platform_id" ON "ServiceCategory"("platformCategoryId");`);

  // 4. Dispute Table Enhancement
  console.log('4. Updating Dispute table with categoryId...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Dispute" 
    ADD COLUMN IF NOT EXISTS "categoryId" INTEGER REFERENCES "PlatformCategory"("id") ON DELETE SET NULL;
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_dispute_category_id" ON "Dispute"("categoryId");`);

  // 5. Link ServiceCategories to PlatformCategory 5 (Home Services)
  console.log('5. Linking default ServiceCategories to Home Services (PlatformCategory 5)...');
  await prisma.$executeRawUnsafe(`
    UPDATE "ServiceCategory" SET "platformCategoryId" = 5 WHERE "platformCategoryId" IS NULL;
  `);

  // Link services to PlatformCategory where possible
  await prisma.$executeRawUnsafe(`
    UPDATE "Service" SET "categoryId" = 2, "category" = 'Laundry' WHERE LOWER("name") LIKE '%laundry%' OR LOWER("name") LIKE '%dry clean%';
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "Service" SET "categoryId" = 1, "category" = 'Grocery' WHERE LOWER("name") LIKE '%milk%' OR LOWER("name") LIKE '%grocery%';
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "Service" SET "categoryId" = 5, "category" = 'Home Services' WHERE "categoryId" IS NULL;
  `);

  // 6. Link initial Coupons
  console.log('6. Assigning categories to initial coupons...');
  await prisma.$executeRawUnsafe(`
    UPDATE "Coupon" SET "categoryId" = 2 WHERE "code" = 'FIRST50';
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "Coupon" SET "categoryId" = 1 WHERE "code" = 'WELCOME100';
  `);

  // 7. Seed Initial FAQs if empty
  console.log('7. Seeding initial FAQs for Laundry, Grocery, Home Services & General...');
  const existingFaqs = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM "FAQ"`);
  if (existingFaqs[0].count === 0) {
    const faqs = [
      {
        question: 'How long does standard laundry and dry cleaning take?',
        answer: 'Standard wash and fold takes 24 hours. Premium dry cleaning and steam press typically take 24 to 48 hours with doorstep pickup and delivery.',
        categoryId: 2, // Laundry
        category: 'laundry',
        sortOrder: 1,
      },
      {
        question: 'What detergents and processes are used for delicate garments?',
        answer: 'We use certified hypoallergenic, eco-friendly European liquid detergents and separate all whites, darks, and delicate fabrics.',
        categoryId: 2, // Laundry
        category: 'laundry',
        sortOrder: 2,
      },
      {
        question: 'Is express or same-day laundry delivery available?',
        answer: 'Yes, our Steam Press Only service offers an express 12-hour turnaround option in select pin codes.',
        categoryId: 2, // Laundry
        category: 'laundry',
        sortOrder: 3,
      },
      {
        question: 'What is the minimum order value for Grocery / Kirana delivery?',
        answer: 'There is no strict minimum order value, but orders above ₹499 qualify for free express delivery.',
        categoryId: 1, // Grocery
        category: 'grocery',
        sortOrder: 1,
      },
      {
        question: 'How fast will my grocery order be delivered?',
        answer: 'Local kirana and fresh items are delivered within 30 to 60 minutes directly from verified neighborhood partner stores.',
        categoryId: 1, // Grocery
        category: 'grocery',
        sortOrder: 2,
      },
      {
        question: 'Are home service professionals background-checked and verified?',
        answer: 'All cooks, maids, drivers, electricians, and plumbers undergo strict 100% government ID, police, and background verification.',
        categoryId: 5, // Home Services
        category: 'home_services',
        sortOrder: 1,
      },
      {
        question: 'Can I reschedule or cancel a booked service?',
        answer: 'Yes, you can cancel or reschedule your booking at zero penalty up to 2 hours before the scheduled time slot.',
        categoryId: 5, // Home Services
        category: 'home_services',
        sortOrder: 2,
      },
      {
        question: 'How do I reach 24/7 customer support for dispute resolution?',
        answer: 'You can raise a support ticket directly from the Admin or Customer dashboard, or contact our helpline.',
        categoryId: null, // General
        category: 'general',
        sortOrder: 1,
      },
    ];

    for (const f of faqs) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "FAQ" ("question", "answer", "categoryId", "category", "sortOrder", "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())`,
        f.question,
        f.answer,
        f.categoryId,
        f.category,
        f.sortOrder
      );
    }
    console.log(`✓ Seeded ${faqs.length} initial FAQs.`);
  }

  console.log('✅ Migration completed successfully!');
  await prisma.$disconnect();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
