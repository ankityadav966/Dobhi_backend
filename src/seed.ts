import { PrismaClient, UserRole } from '@prisma/client';
import logger from './utils/logger';

const prisma = new PrismaClient();

async function main() {
  try {
    logger.info('Seeding database...');

    // Ensure a single PlatformSetting row exists (id = 1)
    // upsert prevents duplicates on repeated seed runs
    await prisma.platformSetting.upsert({
      where: { id: 1 },
      update: {}, // never overwrite an admin-changed rate
      create: { id: 1, commissionRate: 0.20 },
    });
    logger.info('PlatformSetting seeded (commissionRate = 0.20 if new)');

    // ── 1. Maid ──────────────────────────────────────────────────────────────
    const maid = await prisma.service.create({ data: { name: 'Maid', isActive: true } });
    await prisma.servicePlan.create({ data: { serviceId: maid.id, name: 'Hourly',   price: 15000,  durationValue: 2,  durationUnit: 'HOUR',  sortOrder: 1 } });
    await prisma.servicePlan.create({ data: { serviceId: maid.id, name: 'Per Day',  price: 80000,  durationValue: 1,  durationUnit: 'DAY',   sortOrder: 2 } });
    await prisma.servicePlan.create({ data: { serviceId: maid.id, name: 'Monthly',  price: 300000, durationValue: 1,  durationUnit: 'MONTH', sortOrder: 3 } });
    logger.info('Seeded: Maid');

    // ── 2. Cook ───────────────────────────────────────────────────────────────
    // PER_MEAL → HOURLY (durationHours: 1)
    const cook = await prisma.service.create({ data: { name: 'Cook', isActive: true } });
    await prisma.servicePlan.create({ data: { serviceId: cook.id, name: 'Hourly',   price: 30000,  durationValue: 1,  durationUnit: 'HOUR',  sortOrder: 1 } });
    await prisma.servicePlan.create({ data: { serviceId: cook.id, name: 'Per Day',  price: 90000,  durationValue: 1,  durationUnit: 'DAY',   sortOrder: 2 } });
    await prisma.servicePlan.create({ data: { serviceId: cook.id, name: 'Monthly',  price: 350000, durationValue: 1,  durationUnit: 'MONTH', sortOrder: 3 } });
    logger.info('Seeded: Cook');

    // ── 3. Shop Helper / Salesman ─────────────────────────────────────────────
    const shopHelper = await prisma.service.create({ data: { name: 'Shop Helper / Salesman', isActive: true } });
    await prisma.servicePlan.create({ data: { serviceId: shopHelper.id, name: 'Per Day',  price: 80000,   durationValue: 1,  durationUnit: 'DAY',   sortOrder: 1 } });
    await prisma.servicePlan.create({ data: { serviceId: shopHelper.id, name: 'Monthly',  price: 1500000, durationValue: 1,  durationUnit: 'MONTH', sortOrder: 2 } });
    logger.info('Seeded: Shop Helper / Salesman');

    // ── 4. Driver ─────────────────────────────────────────────────────────────
    const driver = await prisma.service.create({ data: { name: 'Driver', isActive: true } });
    await prisma.servicePlan.create({ data: { serviceId: driver.id, name: 'Hourly',   price: 25000,   durationValue: 1,  durationUnit: 'HOUR',  sortOrder: 1 } });
    await prisma.servicePlan.create({ data: { serviceId: driver.id, name: 'Per Day',  price: 120000,  durationValue: 1,  durationUnit: 'DAY',   sortOrder: 2 } });
    await prisma.servicePlan.create({ data: { serviceId: driver.id, name: 'Monthly',  price: 1800000, durationValue: 1,  durationUnit: 'MONTH', sortOrder: 3 } });
    logger.info('Seeded: Driver');

    // ── 5. Nanny ──────────────────────────────────────────────────────────────
    const nanny = await prisma.service.create({ data: { name: 'Nanny', isActive: true } });
    await prisma.servicePlan.create({ data: { serviceId: nanny.id, name: 'Per Day',  price: 90000,   durationValue: 1,  durationUnit: 'DAY',   sortOrder: 1 } });
    await prisma.servicePlan.create({ data: { serviceId: nanny.id, name: 'Monthly',  price: 1800000, durationValue: 1,  durationUnit: 'MONTH', sortOrder: 2 } });
    logger.info('Seeded: Nanny');

    // ── 6. Elder Care ─────────────────────────────────────────────────────────
    // SHIFT_12 → HOURLY (durationHours: 12)  |  SHIFT_24 dropped (would conflict with HOURLY unique constraint)
    const elderCare = await prisma.service.create({ data: { name: 'Elder Care', isActive: true } });
    await prisma.servicePlan.create({ data: { serviceId: elderCare.id, name: '12-Hour Shift', price: 140000,  durationValue: 12, durationUnit: 'HOUR',  sortOrder: 1 } });
    await prisma.servicePlan.create({ data: { serviceId: elderCare.id, name: 'Monthly',       price: 2500000, durationValue: 1,  durationUnit: 'MONTH', sortOrder: 2 } });
    logger.info('Seeded: Elder Care');

    // ── 7. Baby Sitter ────────────────────────────────────────────────────────
    // HALF_DAY → PER_DAY conflict: existing PER_DAY (1000, 8h) is kept; HALF_DAY dropped.
    const babySitter = await prisma.service.create({ data: { name: 'Baby Sitter', isActive: true } });
    await prisma.servicePlan.create({ data: { serviceId: babySitter.id, name: 'Hourly',  price: 20000,  durationValue: 1, durationUnit: 'HOUR', sortOrder: 1 } });
    await prisma.servicePlan.create({ data: { serviceId: babySitter.id, name: 'Per Day', price: 100000, durationValue: 1, durationUnit: 'DAY',  sortOrder: 2 } });
    logger.info('Seeded: Baby Sitter');

    // ── 8. Patient Care ───────────────────────────────────────────────────────
    // SHIFT_12 → HOURLY (durationHours: 12)  |  SHIFT_24 dropped (would conflict with HOURLY unique constraint)
    const patientCare = await prisma.service.create({ data: { name: 'Patient Care', isActive: true } });
    await prisma.servicePlan.create({ data: { serviceId: patientCare.id, name: '12-Hour Shift', price: 150000,  durationValue: 12, durationUnit: 'HOUR',  sortOrder: 1 } });
    await prisma.servicePlan.create({ data: { serviceId: patientCare.id, name: 'Monthly',       price: 2800000, durationValue: 1,  durationUnit: 'MONTH', sortOrder: 2 } });
    logger.info('Seeded: Patient Care');

    logger.info('Database seeded successfully');
  } catch (error) {
    logger.error('Seeding error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
