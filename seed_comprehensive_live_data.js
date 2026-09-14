const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding comprehensive live data...');

  // 1. Ensure approved Laundry Seller
  await prisma.seller.upsert({
    where: { phone: '9829033333' },
    update: {
      status: 'APPROVED',
      isVerified: true,
      isActive: true,
      businessName: 'CleanWave Laundry & Fabric Care',
      ownerName: 'Vikram Choudhary',
      address: 'Shop 14, Apex Mall, Tonk Road',
      city: 'Jaipur',
      pincode: '302015',
      businessType: 'laundry',
      description: 'Eco-friendly steam wash, dry cleaning, and rapid 24hr fabric rejuvenation.',
      rating: 4.88,
      totalRatings: 184,
      logo: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=400',
      banner: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=1200',
    },
    create: {
      phone: '9829033333',
      businessName: 'CleanWave Laundry & Fabric Care',
      ownerName: 'Vikram Choudhary',
      email: 'cleanwave@laundry.test',
      address: 'Shop 14, Apex Mall, Tonk Road',
      city: 'Jaipur',
      pincode: '302015',
      businessType: 'laundry',
      description: 'Eco-friendly steam wash, dry cleaning, and rapid 24hr fabric rejuvenation.',
      status: 'APPROVED',
      isVerified: true,
      isActive: true,
      rating: 4.88,
      totalRatings: 184,
      deliveryRadiusKm: 8.0,
      minOrderValue: 149.0,
      logo: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=400',
      banner: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=1200',
    }
  });

  // Also approve seller 3 if existing
  const seller3 = await prisma.seller.findUnique({ where: { id: 3 } });
  if (seller3) {
    await prisma.seller.update({
      where: { id: 3 },
      data: { status: 'APPROVED', isVerified: true, isActive: true }
    });
  }

  // 2. Ensure Laundry Service & Plans exist in Service table
  let laundryService = await prisma.service.findFirst({
    where: { name: { contains: 'Laundry', mode: 'insensitive' } },
    include: { plans: true }
  });
  if (!laundryService) {
    laundryService = await prisma.service.create({
      data: {
        name: 'Laundry & Dry Cleaning',
        isActive: true,
        plans: {
          create: [
            { name: 'Wash & Fold', price: 99, durationValue: 24, durationUnit: 'HOUR', sortOrder: 1 },
            { name: 'Wash & Iron', price: 149, durationValue: 24, durationUnit: 'HOUR', sortOrder: 2 },
            { name: 'Premium Dry Clean', price: 299, durationValue: 48, durationUnit: 'HOUR', sortOrder: 3 },
            { name: 'Express Steam Press', price: 79, durationValue: 6, durationUnit: 'HOUR', sortOrder: 4 },
          ]
        }
      }
    });
    console.log('Created Laundry Service with ID:', laundryService.id);
  }

  // 3. Ensure Helper Users and Helpers exist
  const helperData = [
    { name: 'Rajesh Sharma', phone: '9829011111', rating: 4.85, role: 'Cook' },
    { name: 'Sunita Devi', phone: '9829022222', rating: 4.90, role: 'Maid' },
    { name: 'Amit Verma', phone: '9829044444', rating: 4.75, role: 'Driver' },
    { name: 'Kavita Meena', phone: '9829055555', rating: 4.95, role: 'Nanny' },
  ];

  const helpers = [];
  for (const h of helperData) {
    let user = await prisma.user.findUnique({ where: { phone: h.phone } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          phone: h.phone,
          fullName: h.name,
          role: 'HELPER',
          isActive: true,
        }
      });
    }

    let helper = await prisma.helper.findUnique({ where: { userId: user.id } });
    if (!helper) {
      helper = await prisma.helper.create({
        data: {
          userId: user.id,
          rating: h.rating,
          totalRatings: 42,
          isAvailable: true,
          isOnline: true,
          onboardingStatus: 'APPROVED',
          profile: {
            create: {
              city: 'Jaipur',
              address: 'Malviya Nagar, Jaipur',
              experienceYears: 5,
              workType: 'FULL_TIME'
            }
          }
        }
      });
    }
    helpers.push({ helper, user });
  }
  console.log(`Ensured ${helpers.length} helpers.`);

  // 4. Ensure Customer Users
  const customerData = [
    { name: 'Ananya Sharma', phone: '9811122233' },
    { name: 'Vikram Patel', phone: '9822233344' },
    { name: 'Pooja Verma', phone: '9833344455' },
    { name: 'Rajesh Singhal', phone: '9844455566' },
  ];

  const customers = [];
  for (const c of customerData) {
    let user = await prisma.user.findUnique({ where: { phone: c.phone } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          phone: c.phone,
          fullName: c.name,
          role: 'CUSTOMER',
          isActive: true,
        }
      });
    }
    customers.push(user);
  }
  console.log(`Ensured ${customers.length} customers.`);

  // 5. Seed Real Bookings in prisma.booking
  const services = await prisma.service.findMany({ include: { plans: true } });
  const maidService = services.find(s => s.name === 'Maid') || services[0];
  const cookService = services.find(s => s.name === 'Cook') || services[0];
  const driverService = services.find(s => s.name === 'Driver') || services[0];

  const bookingSeeds = [
    {
      customerId: customers[0].id,
      serviceId: maidService.id,
      servicePlanId: maidService.plans[0]?.id || 1,
      helperId: helpers[1].helper.id,
      bookingDate: new Date(Date.now() - 2 * 3600 * 1000),
      duration: 120,
      status: 'IN_PROGRESS',
      location: 'C-Scheme, Jaipur',
      address: 'Flat 402, Royal Palms, C-Scheme, Jaipur',
      city: 'Jaipur',
      pinCode: '302001',
      notes: 'Daily deep home cleaning and dusting.',
      totalAmount: 499,
      finalAmount: 499,
    },
    {
      customerId: customers[1].id,
      serviceId: cookService.id,
      servicePlanId: cookService.plans[0]?.id || 1,
      helperId: helpers[0].helper.id,
      bookingDate: new Date(Date.now() + 4 * 3600 * 1000),
      duration: 90,
      status: 'CONFIRMED',
      location: 'Malviya Nagar, Jaipur',
      address: 'House 54, Sector 3, Malviya Nagar, Jaipur',
      city: 'Jaipur',
      pinCode: '302017',
      notes: 'Dinner preparation for 4 guests (North Indian Veg).',
      totalAmount: 599,
      finalAmount: 599,
    },
    {
      customerId: customers[2].id,
      serviceId: laundryService.id,
      servicePlanId: laundryService.plans[1]?.id || laundryService.plans[0]?.id || 1,
      helperId: null,
      bookingDate: new Date(Date.now() + 18 * 3600 * 1000),
      duration: 60,
      status: 'CONFIRMED',
      location: 'Vaishali Nagar, Jaipur',
      address: 'B-12, Queens Road, Vaishali Nagar, Jaipur',
      city: 'Jaipur',
      pinCode: '302021',
      notes: 'Wash & Iron pickup for 8 formal shirts and 2 blazers.',
      totalAmount: 380,
      finalAmount: 380,
    },
    {
      customerId: customers[3].id,
      serviceId: driverService.id,
      servicePlanId: driverService.plans[0]?.id || 1,
      helperId: helpers[2].helper.id,
      bookingDate: new Date(Date.now() - 24 * 3600 * 1000),
      duration: 240,
      status: 'COMPLETED',
      location: 'Mansarovar, Jaipur',
      address: 'Plot 108, Shipra Path, Mansarovar, Jaipur',
      city: 'Jaipur',
      pinCode: '302020',
      notes: 'City local driving for airport pickup and office commute.',
      totalAmount: 799,
      finalAmount: 799,
    },
    {
      customerId: customers[0].id,
      serviceId: laundryService.id,
      servicePlanId: laundryService.plans[0]?.id || 1,
      helperId: null,
      bookingDate: new Date(Date.now() + 36 * 3600 * 1000),
      duration: 45,
      status: 'PENDING_PAYMENT',
      location: 'Tonk Road, Jaipur',
      address: 'Tower A-6, Mahima Panorama, Tonk Road, Jaipur',
      city: 'Jaipur',
      pinCode: '302018',
      notes: 'Curtains and heavy linen wash & fold.',
      totalAmount: 450,
      finalAmount: 450,
    },
  ];

  for (const b of bookingSeeds) {
    const existing = await prisma.booking.findFirst({
      where: {
        customerId: b.customerId,
        serviceId: b.serviceId,
        bookingDate: b.bookingDate,
      }
    });
    if (!existing) {
      await prisma.booking.create({ data: b });
    }
  }
  console.log('Bookings seeded.');

  // 6. Seed Real Seller Orders in prisma.sellerOrder
  const allSellers = await prisma.seller.findMany({ where: { status: 'APPROVED' } });
  console.log('Approved sellers for orders:', allSellers.map(s => `${s.id}: ${s.businessName}`));

  const greenFarm = allSellers.find(s => s.businessName.includes('GreenFarm')) || allSellers[0];
  const dairyPure = allSellers.find(s => s.businessName.includes('DairyPure')) || allSellers[1] || allSellers[0];
  const cleanWave = allSellers.find(s => s.businessName.includes('CleanWave') || s.businessType === 'laundry') || allSellers[2] || allSellers[0];

  const orderSeeds = [
    {
      orderNumber: 'GL-GRC-2026-89124',
      sellerId: greenFarm.id,
      customerName: 'Ananya Sharma',
      customerPhone: '+91 98111 22233',
      items: [
        { name: 'Hydroponic Vine Tomatoes', qty: 2, price: 45 },
        { name: 'Organic Spinach Bundle', qty: 1, price: 35 },
        { name: 'Shimla Crisp Apples (1kg)', qty: 1, price: 160 },
      ],
      totalAmount: 285,
      status: 'Preparing',
      orderType: 'Grocery',
      deliveryAddress: 'Flat 402, Royal Palms, C-Scheme, Jaipur',
      paymentMethod: 'ONLINE',
    },
    {
      orderNumber: 'GL-GRC-2026-89125',
      sellerId: greenFarm.id,
      customerName: 'Rahul Verma',
      customerPhone: '+91 98222 33344',
      items: [
        { name: 'Himalayan Garlic Bulb', qty: 1, price: 90 },
        { name: 'Farm Fresh Coriander', qty: 2, price: 20 },
      ],
      totalAmount: 130,
      status: 'Out for Delivery',
      orderType: 'Grocery',
      deliveryAddress: 'House 54, Sector 3, Malviya Nagar, Jaipur',
      paymentMethod: 'COD',
    },
    {
      orderNumber: 'GL-GRC-2026-89126',
      sellerId: dairyPure.id,
      customerName: 'Pooja Kashyap',
      customerPhone: '+91 98333 44455',
      items: [
        { name: 'Fresh A2 Cow Milk 1L', qty: 2, price: 80 },
        { name: 'Artisanal Malai Paneer 200g', qty: 1, price: 95 },
      ],
      totalAmount: 255,
      status: 'Preparing',
      orderType: 'Dairy',
      deliveryAddress: 'B-12, Queens Road, Vaishali Nagar, Jaipur',
      paymentMethod: 'ONLINE',
    },
    {
      orderNumber: 'GL-GRC-2026-89127',
      sellerId: dairyPure.id,
      customerName: 'Manish Gupta',
      customerPhone: '+91 98444 55566',
      items: [
        { name: 'Farm Fresh Organic Eggs (6 pack)', qty: 2, price: 75 },
        { name: 'Country Butter Block 250g', qty: 1, price: 120 },
      ],
      totalAmount: 270,
      status: 'Delivered',
      orderType: 'Dairy',
      deliveryAddress: 'Plot 108, Shipra Path, Mansarovar, Jaipur',
      paymentMethod: 'ONLINE',
    },
    {
      orderNumber: 'GL-LND-2026-44101',
      sellerId: cleanWave.id,
      customerName: 'Kunal Singhania',
      customerPhone: '+91 97840 99881',
      items: [
        { name: 'Wash & Steam Iron (6 shirts)', qty: 6, price: 35 },
        { name: 'Dry Clean Suit (2 pcs)', qty: 1, price: 250 },
      ],
      totalAmount: 460,
      status: 'In Wash Cycle',
      orderType: 'Laundry',
      deliveryAddress: 'Villa 18, Oasis Enclave, Tonk Road, Jaipur',
      paymentMethod: 'ONLINE',
    },
    {
      orderNumber: 'GL-LND-2026-44102',
      sellerId: cleanWave.id,
      customerName: 'Divya Rastogi',
      customerPhone: '+91 99280 77665',
      items: [
        { name: 'Silk Saree Delicate Care', qty: 2, price: 180 },
      ],
      totalAmount: 360,
      status: 'Ready for Dispatch',
      orderType: 'Laundry',
      deliveryAddress: '104 Landmark Tower, Malviya Nagar, Jaipur',
      paymentMethod: 'COD',
    }
  ];

  for (const o of orderSeeds) {
    const existing = await prisma.sellerOrder.findUnique({
      where: { orderNumber: o.orderNumber }
    });
    if (!existing) {
      await prisma.sellerOrder.create({ data: o });
    }
  }
  console.log('Seller orders seeded.');

  const totalBookingsCount = await prisma.booking.count();
  const totalSellerOrdersCount = await prisma.sellerOrder.count();
  console.log(`Total Bookings in DB: ${totalBookingsCount}`);
  console.log(`Total Seller Orders in DB: ${totalSellerOrdersCount}`);

  await prisma.$disconnect();
}

seed().catch(e => {
  console.error(e);
  process.exit(1);
});
