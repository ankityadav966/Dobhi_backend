import { prisma } from '../prisma.client';

async function seedMarketplace() {
  console.log('Seeding Marketplace Sellers, Categories, Products & Laundry...');

  // 1. Seed Sellers (Stores)
  const sellersData = [
    {
      businessName: 'GreenFarm Organics',
      ownerName: 'Raghav Mehra',
      phone: '9876543210',
      email: 'raghav@greenfarm.in',
      address: 'Sector 45, Green Valley Hub',
      city: 'Jaipur',
      pincode: '302004',
      businessType: 'produce',
      description: 'Direct-from-farm hydroponic produce & pesticide-free greens',
      gstin: '08AAAAA0000A1Z5',
      pan: 'ABCDE1234F',
      fssaiLicense: '10019011000234',
      isVerified: true,
      logo: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200&auto=format&fit=crop&q=80',
      banner: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=1200&auto=format&fit=crop&q=80',
      openingTime: '06:00 AM',
      closingTime: '11:00 PM',
      deliveryRadiusKm: 6.0,
      minOrderValue: 99.0,
      status: 'APPROVED' as const,
      rating: 4.9,
      totalRatings: 420,
    },
    {
      businessName: 'DairyPure Creamery',
      ownerName: 'Surinder Singh',
      phone: '9876543211',
      email: 'surinder@dairypure.in',
      address: 'Dairy Colony, Phase 2',
      city: 'Jaipur',
      pincode: '302017',
      businessType: 'dairy',
      description: 'Farm fresh A2 milk, country eggs & artisanal dairy',
      gstin: '08BBBBB0000B1Z6',
      pan: 'BCDEF2345G',
      fssaiLicense: '10019011000567',
      isVerified: true,
      logo: 'https://images.unsplash.com/photo-1527153857715-3908f2ae5e81?w=200&auto=format&fit=crop&q=80',
      banner: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=1200&auto=format&fit=crop&q=80',
      openingTime: '05:30 AM',
      closingTime: '10:30 PM',
      deliveryRadiusKm: 8.0,
      minOrderValue: 49.0,
      status: 'APPROVED' as const,
      rating: 4.95,
      totalRatings: 680,
    },
    {
      businessName: 'CleanWave Laundry & Fabric Care',
      ownerName: 'Vikramaditya Sharma',
      phone: '9876543212',
      email: 'vikram@cleanwave.in',
      address: 'Shop 14, Central Market, Malviya Nagar',
      city: 'Jaipur',
      pincode: '302018',
      businessType: 'laundry',
      description: 'Concierge grade laundry, steam pressing, and organic dry cleaning',
      gstin: '08CCCCC0000C1Z7',
      pan: 'CDEFG3456H',
      isVerified: true,
      logo: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=200&auto=format&fit=crop&q=80',
      banner: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=1200&auto=format&fit=crop&q=80',
      openingTime: '07:00 AM',
      closingTime: '10:00 PM',
      deliveryRadiusKm: 10.0,
      minOrderValue: 149.0,
      status: 'APPROVED' as const,
      rating: 4.92,
      totalRatings: 512,
    }
  ];

  const createdSellers = [];
  for (const s of sellersData) {
    const seller = await prisma.seller.upsert({
      where: { phone: s.phone },
      update: s,
      create: s,
    });
    createdSellers.push(seller);
    console.log(`Seller seeded/ready: ${seller.businessName} (ID: ${seller.id})`);
  }

  // 2. Seed Categories
  const categoriesData = [
    {
      name: 'Fresh Produce',
      slug: 'fresh-produce',
      tagline: 'Direct from hydroponic & local farm growers',
      icon: 'Apple',
      image: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=600&auto=format&fit=crop&q=80',
      sortOrder: 1,
    },
    {
      name: 'Dairy & Farm Eggs',
      slug: 'dairy-eggs',
      tagline: 'Morning farm milk, paneer, and artisan butter',
      icon: 'Milk',
      image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600&auto=format&fit=crop&q=80',
      sortOrder: 2,
    },
    {
      name: 'Artisan Bakery',
      slug: 'bakery',
      tagline: 'Sourdough, brioche, and morning bakes',
      icon: 'Wheat',
      image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80',
      sortOrder: 3,
    },
    {
      name: 'Pantry Staples',
      slug: 'staples',
      tagline: 'Aged basmati, organic grains & pure cold-pressed oils',
      icon: 'Package',
      image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80',
      sortOrder: 4,
    },
    {
      name: 'Beverages & Brews',
      slug: 'beverages',
      tagline: 'Estate coffee, cold pressed juices, and kombucha',
      icon: 'Coffee',
      image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&auto=format&fit=crop&q=80',
      sortOrder: 5,
    },
    {
      name: 'Gourmet Snacks',
      slug: 'snacks',
      tagline: 'Roasted dry fruits, chips, and clean bites',
      icon: 'Cookie',
      image: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=600&auto=format&fit=crop&q=80',
      sortOrder: 6,
    },
    {
      name: 'Eco Household',
      slug: 'household',
      tagline: 'Plant-based cleaning and zero-waste home care',
      icon: 'Sparkles',
      image: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=600&auto=format&fit=crop&q=80',
      sortOrder: 7,
    },
    {
      name: 'Personal Care',
      slug: 'personal-care',
      tagline: 'Gentle dermatological skin and hair essentials',
      icon: 'Heart',
      image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80',
      sortOrder: 8,
    }
  ];

  const categoryMap: Record<string, number> = {};
  for (const cat of categoriesData) {
    const c = await prisma.kiranaCategory.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    });
    categoryMap[c.slug] = c.id;
  }
  console.log('Categories seeded:', Object.keys(categoryMap).length);

  // 3. Seed Products
  const primarySellerId = createdSellers[0].id;
  const dairySellerId = createdSellers[1].id;

  const productsData = [
    {
      name: 'Hydroponic Vine Tomatoes',
      slug: 'vine-tomatoes',
      brand: 'Pure Earth',
      categorySlug: 'fresh-produce',
      sellerId: primarySellerId,
      unit: '500g bunch',
      originalPrice: 65,
      sellingPrice: 48,
      discountPercentage: 26,
      stock: 80,
      image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&auto=format&fit=crop&q=80',
      isFeatured: true,
      isBestseller: true,
      rating: 4.9
    },
    {
      name: 'Farm Fresh Baby Spinach',
      slug: 'baby-spinach',
      brand: 'Green Farms',
      categorySlug: 'fresh-produce',
      sellerId: primarySellerId,
      unit: '250g box',
      originalPrice: 55,
      sellingPrice: 38,
      discountPercentage: 30,
      stock: 45,
      image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=700&auto=format&fit=crop&q=80',
      isFeatured: true,
      isBestseller: true,
      rating: 4.85
    },
    {
      name: 'Hass Avocados (Pack of 2)',
      slug: 'hass-avocados',
      brand: 'Andes Direct',
      categorySlug: 'fresh-produce',
      sellerId: primarySellerId,
      unit: '2 pcs',
      originalPrice: 240,
      sellingPrice: 189,
      discountPercentage: 21,
      stock: 30,
      image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=700&auto=format&fit=crop&q=80',
      isFeatured: true,
      isBestseller: false,
      rating: 4.95
    },
    {
      name: 'A2 Gir Cow Whole Milk (1L Glass Bottle)',
      slug: 'a2-cow-milk',
      brand: 'DairyPure Creamery',
      categorySlug: 'dairy-eggs',
      sellerId: dairySellerId,
      unit: '1 Litre',
      originalPrice: 110,
      sellingPrice: 94,
      discountPercentage: 14,
      stock: 50,
      image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=700&auto=format&fit=crop&q=80',
      isFeatured: true,
      isBestseller: true,
      rating: 4.95
    },
    {
      name: 'Artisan Malai Paneer (Block)',
      slug: 'artisan-malai-paneer',
      brand: 'DairyPure Creamery',
      categorySlug: 'dairy-eggs',
      sellerId: dairySellerId,
      unit: '250g block',
      originalPrice: 130,
      sellingPrice: 112,
      discountPercentage: 13,
      stock: 35,
      image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=700&auto=format&fit=crop&q=80',
      isFeatured: false,
      isBestseller: true,
      rating: 4.9
    },
    {
      name: 'Wild Yeast Sourdough Loaf',
      slug: 'wild-yeast-sourdough',
      brand: 'Artisan Crust',
      categorySlug: 'bakery',
      sellerId: primarySellerId,
      unit: '450g loaf',
      originalPrice: 180,
      sellingPrice: 145,
      discountPercentage: 19,
      stock: 20,
      image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=700&auto=format&fit=crop&q=80',
      isFeatured: true,
      isBestseller: false,
      rating: 4.88
    },
    {
      name: 'Cold Pressed Yellow Mustard Oil (Kachi Ghani)',
      slug: 'mustard-oil-cold-pressed',
      brand: 'Pure Earth',
      categorySlug: 'staples',
      sellerId: primarySellerId,
      unit: '1 Litre bottle',
      originalPrice: 220,
      sellingPrice: 185,
      discountPercentage: 15,
      stock: 40,
      image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=700&auto=format&fit=crop&q=80',
      isFeatured: false,
      isBestseller: true,
      rating: 4.86
    },
    {
      name: 'Roasted California Almonds & Berries Mix',
      slug: 'roasted-almonds-berries',
      brand: 'CleanBites',
      categorySlug: 'snacks',
      sellerId: primarySellerId,
      unit: '200g jar',
      originalPrice: 320,
      sellingPrice: 269,
      discountPercentage: 15,
      stock: 60,
      image: 'https://images.unsplash.com/photo-1508746829417-e6f548d8d6ed?w=700&auto=format&fit=crop&q=80',
      isFeatured: true,
      isBestseller: true,
      rating: 4.92
    }
  ];

  for (const prod of productsData) {
    const categoryId = categoryMap[prod.categorySlug];
    if (!categoryId) continue;

    await prisma.kiranaProduct.upsert({
      where: { slug: prod.slug },
      update: {
        name: prod.name,
        brand: prod.brand,
        categoryId,
        sellerId: prod.sellerId,
        unit: prod.unit,
        originalPrice: prod.originalPrice,
        sellingPrice: prod.sellingPrice,
        discountPercentage: prod.discountPercentage,
        stock: prod.stock,
        image: prod.image,
        isFeatured: prod.isFeatured,
        isBestseller: prod.isBestseller,
        rating: prod.rating,
      },
      create: {
        name: prod.name,
        slug: prod.slug,
        brand: prod.brand,
        categoryId,
        sellerId: prod.sellerId,
        unit: prod.unit,
        originalPrice: prod.originalPrice,
        sellingPrice: prod.sellingPrice,
        discountPercentage: prod.discountPercentage,
        stock: prod.stock,
        image: prod.image,
        isFeatured: prod.isFeatured,
        isBestseller: prod.isBestseller,
        rating: prod.rating,
      }
    });
  }
  console.log('Products seeded:', productsData.length);

  // 4. Seed Laundry Services
  const laundryServices = [
    {
      slug: 'wash-fold',
      name: 'Wash & Fold',
      description: 'Everyday laundry, weighed and pristinely folded with hypoallergenic European enzymes.',
      turnaround: '24 Hours',
      tagline: 'Separated by color, gentle tumble dry, square-corner fold',
      icon: 'Shirt',
      image: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=700&auto=format&fit=crop&q=80',
      sortOrder: 1,
    },
    {
      slug: 'wash-iron',
      name: 'Wash & Steam Iron',
      description: 'Full wash treatment followed by crease-free steam press. Ideal for workwear & office cottons.',
      turnaround: '24-36 Hours',
      tagline: 'Deep stain pre-spotting inspection, vacuum steam press finishing',
      icon: 'Sparkles',
      image: 'https://images.unsplash.com/photo-1489274495757-95c7c837b101?w=700&auto=format&fit=crop&q=80',
      sortOrder: 2,
    },
    {
      slug: 'dry-clean',
      name: 'Dry Cleaning',
      description: 'Specialized organic dry cleaning for bespoke & delicate fabrics (silks, tailored suits, ethnic wear).',
      turnaround: '48 Hours',
      tagline: 'Hydrocarbon eco-solvent technology, zero shrinkage guarantee',
      icon: 'Layers',
      image: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=700&auto=format&fit=crop&q=80',
      sortOrder: 3,
    },
    {
      slug: 'steam-iron',
      name: 'Steam Press Only',
      description: 'Professional industrial steam press for already washed garments. Sharp creases without washing.',
      turnaround: '12 Hours (Express)',
      tagline: 'High-pressure dry steam eliminates 99.9% germs with anti-shine guard',
      icon: 'Zap',
      image: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=700&auto=format&fit=crop&q=80',
      sortOrder: 4,
    }
  ];

  for (const s of laundryServices) {
    await prisma.laundryCatalogService.upsert({
      where: { slug: s.slug },
      update: s,
      create: s,
    });
  }
  console.log('Laundry services seeded:', laundryServices.length);

  // 5. Seed Laundry Items
  const laundryItems = [
    {
      name: 'Cotton & Linen Shirt',
      category: 'TOPWEAR',
      gender: 'Unisex',
      icon: '👔',
      pricing: { 'wash-fold': 25, 'wash-iron': 38, 'dry-clean': 85, 'steam-iron': 18 }
    },
    {
      name: 'Casual T-Shirt / Polo',
      category: 'TOPWEAR',
      gender: 'Unisex',
      icon: '👕',
      pricing: { 'wash-fold': 20, 'wash-iron': 30, 'dry-clean': 70, 'steam-iron': 15 }
    },
    {
      name: 'Denim Jeans',
      category: 'BOTTOMWEAR',
      gender: 'Unisex',
      icon: '👖',
      pricing: { 'wash-fold': 35, 'wash-iron': 48, 'dry-clean': 110, 'steam-iron': 22 }
    },
    {
      name: 'Formal Trouser / Chino',
      category: 'BOTTOMWEAR',
      gender: 'Unisex',
      icon: '👖',
      pricing: { 'wash-fold': 30, 'wash-iron': 42, 'dry-clean': 95, 'steam-iron': 20 }
    },
    {
      name: 'Kurta / Ethnic Top',
      category: 'ETHNIC',
      gender: 'Unisex',
      icon: '👘',
      pricing: { 'wash-fold': 40, 'wash-iron': 55, 'dry-clean': 120, 'steam-iron': 25 }
    },
    {
      name: 'Pure Silk / Designer Saree',
      category: 'ETHNIC',
      gender: 'Women',
      icon: '🥻',
      pricing: { 'wash-fold': 75, 'wash-iron': 110, 'dry-clean': 220, 'steam-iron': 45 }
    },
    {
      name: 'Double Bedsheet & Pillow Covers',
      category: 'HOUSEHOLD',
      gender: 'Home',
      icon: '🛏️',
      pricing: { 'wash-fold': 70, 'wash-iron': 95, 'dry-clean': 180, 'steam-iron': 40 }
    },
    {
      name: 'Heavy Comforter / Blanket',
      category: 'HOUSEHOLD',
      gender: 'Home',
      icon: '🛋️',
      pricing: { 'wash-fold': 160, 'wash-iron': 210, 'dry-clean': 350, 'steam-iron': 80 }
    }
  ];

  for (const item of laundryItems) {
    const existing = await prisma.laundryCatalogItem.findFirst({ where: { name: item.name } });
    if (existing) {
      await prisma.laundryCatalogItem.update({
        where: { id: existing.id },
        data: item,
      });
    } else {
      await prisma.laundryCatalogItem.create({ data: item });
    }
  }
  console.log('Laundry items seeded:', laundryItems.length);

  console.log('Marketplace seeding complete!');
}

seedMarketplace()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
