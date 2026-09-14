const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Restoring Category 1 and Fresh Produce products in database...');

  // 1. Ensure Category 1 is 'Fresh Produce'
  await prisma.$executeRawUnsafe(`
    INSERT INTO "KiranaCategory" (id, name, slug, tagline, icon, image, "sortOrder", "isActive", "createdAt", "updatedAt")
    VALUES (
      1,
      'Fresh Produce',
      'fresh-produce',
      'Direct from hydroponic & local farm growers',
      'Apple',
      'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=600&auto=format&fit=crop&q=80',
      1,
      true,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = 'Fresh Produce',
      slug = 'fresh-produce',
      tagline = 'Direct from hydroponic & local farm growers',
      icon = 'Apple',
      image = 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=600&auto=format&fit=crop&q=80',
      "sortOrder" = 1,
      "isActive" = true,
      "updatedAt" = NOW();
  `);

  // 2. Ensure the 3 fresh produce products exist
  const freshProduce = [
    {
      name: 'Hydroponic Vine Tomatoes',
      slug: 'vine-tomatoes',
      brand: 'Pure Earth',
      categoryId: 1,
      sellerId: 1,
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
      categoryId: 1,
      sellerId: 1,
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
      categoryId: 1,
      sellerId: 1,
      unit: '2 pcs',
      originalPrice: 240,
      sellingPrice: 189,
      discountPercentage: 21,
      stock: 30,
      image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=700&auto=format&fit=crop&q=80',
      isFeatured: true,
      isBestseller: false,
      rating: 4.95
    }
  ];

  for (const item of freshProduce) {
    const existing = await prisma.kiranaProduct.findFirst({ where: { slug: item.slug } });
    if (!existing) {
      await prisma.kiranaProduct.create({ data: item });
      console.log(`Created product: ${item.name}`);
    } else {
      await prisma.kiranaProduct.update({
        where: { id: existing.id },
        data: {
          name: item.name,
          categoryId: 1,
          sellerId: 1,
          image: item.image,
          sellingPrice: item.sellingPrice,
          originalPrice: item.originalPrice,
          stock: item.stock
        }
      });
      console.log(`Updated product: ${item.name}`);
    }
  }

  const allProds = await prisma.kiranaProduct.findMany({
    select: { id: true, name: true, slug: true, category: { select: { name: true, slug: true } } }
  });
  console.log(`Total live products in catalog: ${allProds.length}`);
  for (const p of allProds) {
    console.log(`  [prod-${p.id}] ${p.name} -> Category: ${p.category.name} (${p.category.slug})`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
