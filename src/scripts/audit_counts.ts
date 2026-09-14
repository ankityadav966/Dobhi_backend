import { prisma } from '../prisma.client';

async function main() {
  const userCount = await prisma.user.count();
  const customerCount = await prisma.user.count({ where: { role: 'CUSTOMER' } });
  const sellerCount = await prisma.seller.count();
  const helperCount = await prisma.helper.count();
  const workerCount = await prisma.sellerWorker.count();
  const bookingCount = await prisma.booking.count();
  const sellerOrderCount = await prisma.sellerOrder.count();
  const serviceCount = await prisma.service.count();
  const serviceCatCount = await prisma.serviceCategory.count();
  const kiranaCatCount = await prisma.kiranaCategory.count();
  const kiranaProdCount = await prisma.kiranaProduct.count();
  const laundryCatalogServiceCount = await prisma.laundryCatalogService.count();
  const laundryCatalogItemCount = await prisma.laundryCatalogItem.count();
  const faqCount = await prisma.fAQ.count();
  const couponCount = await prisma.coupon.count();
  const disputeCount = await prisma.dispute.count();
  const platCatCount = await prisma.platformCategory.count();
  const paymentCount = await prisma.payment.count();
  const ratingCount = await prisma.rating.count();

  const platCategories = await prisma.platformCategory.findMany({
    select: { id: true, name: true, slug: true, isActive: true }
  });

  console.log('DATABASE_AUDIT_RESULT:', JSON.stringify({
    counts: {
      totalUsers: userCount,
      customers: customerCount,
      sellers: sellerCount,
      helpers: helperCount,
      sellerWorkers: workerCount,
      bookings: bookingCount,
      sellerOrders: sellerOrderCount,
      services: serviceCount,
      serviceCategories: serviceCatCount,
      kiranaCategories: kiranaCatCount,
      kiranaProducts: kiranaProdCount,
      laundryCatalogServices: laundryCatalogServiceCount,
      laundryCatalogItems: laundryCatalogItemCount,
      faqs: faqCount,
      coupons: couponCount,
      disputes: disputeCount,
      platformCategories: platCatCount,
      payments: paymentCount,
      ratings: ratingCount,
    },
    platformCategories: platCategories
  }, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
