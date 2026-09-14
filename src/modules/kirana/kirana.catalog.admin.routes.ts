import { Router, Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';
import { uploadToS3 } from '../../utils/s3';

export const categoryRouter = Router();
export const inventoryRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

categoryRouter.use(upload.any());
inventoryRouter.use(upload.any());

async function resolveS3ImageUrl(files: any, fallbackUrl?: string | null): Promise<string | null> {
  if (files && Array.isArray(files) && files.length > 0) {
    const f = files[0];
    try {
      const { url } = await uploadToS3(f.buffer, f.mimetype || 'image/jpeg', 'uploads');
      return url;
    } catch (err: any) {
      logger.warn('S3 upload fallback in kirana catalog:', err?.message || err);
      return `data:${f.mimetype || 'image/jpeg'};base64,${f.buffer.toString('base64')}`;
    }
  }
  return fallbackUrl || null;
}

// ============================================================================
// 2. KIRANA CATEGORY ADMIN ROUTES (/api/admin/kirana-category)
// ============================================================================

categoryRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { resolveCategoryFilter } = await import('../../utils/category-helper');
    const cat = await resolveCategoryFilter(req);

    // If a non-grocery category (like Laundry or Home Services) is active, return empty list with empty state message
    if (cat && cat.slug !== 'grocery') {
      return res.json({
        success: true,
        data: [],
        categories: [],
        total: 0,
        page: 1,
        limit: 100,
        message: `No Kirana categories are available for ${cat.name}.`,
        categoryFilter: cat.name,
      });
    }

    const search = ((req.query.search as string) || '').trim();
    const where: any = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [total, categories] = await Promise.all([
      prisma.kiranaCategory.count({ where }),
      prisma.kiranaCategory.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
        include: {
          _count: {
            select: { products: true }
          }
        }
      })
    ]);

    const formattedCategories = categories.map((c) => ({
      ...c,
      productCount: c._count.products,
    }));

    return res.json({
      success: true,
      data: formattedCategories,
      categories: formattedCategories,
      total,
      page: 1,
      limit: 100
    });
  } catch (error: any) {
    logger.error('Error fetching kirana categories:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch categories' });
  }
});

categoryRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) return res.status(400).json({ success: false, message: 'Invalid category ID' });

    const category = await prisma.kiranaCategory.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true } },
        products: { take: 20 },
      },
    });

    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    const formatted = {
      ...category,
      productCount: category._count.products,
    };

    return res.json({ success: true, data: formatted, category: formatted });
  } catch (error: any) {
    logger.error('Error fetching kirana category by ID:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch category' });
  }
});

categoryRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, slug, icon, image, tagline } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

    const imgValue = await resolveS3ImageUrl(req.files, image || req.body.imageUrl || null);

    const finalSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const created = await prisma.kiranaCategory.create({
      data: {
        name,
        slug: finalSlug,
        icon: icon || 'Package',
        image: imgValue,
        tagline: tagline || null,
      }
    });

    return res.status(201).json({ success: true, data: created, category: created });
  } catch (error: any) {
    logger.error('Error creating category:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create category' });
  }
});

const updateCategoryHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { name, slug, icon, image, tagline } = req.body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (icon !== undefined) updateData.icon = icon;

    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      updateData.image = await resolveS3ImageUrl(req.files);
    } else if (image || req.body.imageUrl) {
      updateData.image = image || req.body.imageUrl;
    }
    if (tagline !== undefined) updateData.tagline = tagline;

    const updated = await prisma.kiranaCategory.update({
      where: { id },
      data: updateData,
    });

    return res.json({
      success: true,
      data: updated,
      category: updated,
      message: 'Category updated successfully'
    });
  } catch (error: any) {
    logger.error('Error updating category:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to update category' });
  }
};

categoryRouter.patch('/:id', updateCategoryHandler);
categoryRouter.put('/:id', updateCategoryHandler);

categoryRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.kiranaCategory.delete({ where: { id } });
    return res.json({ success: true, message: 'Category deleted' });
  } catch (error: any) {
    logger.error('Error deleting category:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to delete category' });
  }
});

// ============================================================================
// 3. KIRANA INVENTORY ADMIN ROUTES (/api/admin/kirana-inventory)
// ============================================================================

inventoryRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) return res.status(400).json({ success: false, message: 'Invalid product ID' });

    const product = await prisma.kiranaProduct.findUnique({
      where: { id },
      include: {
        category: true,
        seller: { select: { id: true, businessName: true, status: true, city: true } },
      },
    });

    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const formatted = {
      ...product,
      productId: `PRD${String(product.id).padStart(3, '0')}`,
      imageUrl: product.image,
      price: product.sellingPrice,
      categoryId: product.categoryId,
      categoryName: product.category?.name || 'General',
      sellerName: product.seller?.businessName || 'Marketplace Seller',
      stockStatus: product.stock === 0 ? 'Out of Stock' : product.stock < 10 ? 'Low Stock' : 'In Stock',
    };

    return res.json({ success: true, data: formatted, product: formatted });
  } catch (error: any) {
    logger.error('Error fetching product by ID:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch product' });
  }
});

inventoryRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { resolveCategoryFilter } = await import('../../utils/category-helper');
    const cat = await resolveCategoryFilter(req);

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 20);
    const search = ((req.query.search as string) || '').trim();
    const category = (req.query.category as string) || '';

    const where: any = {};

    if (cat) {
      if (cat.slug !== 'grocery') {
        where.seller = {
          OR: [
            { categoryId: cat.id },
            { businessType: { contains: cat.slug, mode: 'insensitive' } },
          ]
        };
      }
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category && category !== 'all') {
      const parsedCatId = parseInt(category);
      if (!isNaN(parsedCatId)) {
        where.categoryId = parsedCatId;
      } else {
        where.category = { slug: category };
      }
    }

    const [total, allProductsForStats, products] = await Promise.all([
      prisma.kiranaProduct.count({ where }),
      prisma.kiranaProduct.findMany({ select: { sellingPrice: true, stock: true } }),
      prisma.kiranaProduct.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          seller: {
            select: { id: true, businessName: true, status: true, city: true }
          }
        }
      })
    ]);

    const stockValue = allProductsForStats.reduce((acc, curr) => acc + (curr.sellingPrice * curr.stock), 0);
    const lowStockCount = allProductsForStats.filter(p => p.stock < 10).length;

    const formattedProducts = products.map((p) => ({
      ...p,
      productId: `PRD${String(p.id).padStart(3, '0')}`,
      imageUrl: p.image,
      price: p.sellingPrice,
      categoryId: p.categoryId,
      categoryName: p.category?.name || 'General',
      sellerName: p.seller?.businessName || 'Marketplace Seller',
      stockStatus: p.stock === 0 ? 'Out of Stock' : p.stock < 10 ? 'Low Stock' : 'In Stock'
    }));

    return res.json({
      success: true,
      data: formattedProducts,
      stats: {
        totalProducts: total,
        stockValue,
        lowStockCount
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error: any) {
    logger.error('Error fetching inventory:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch inventory' });
  }
});

inventoryRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, slug, brand, categoryId, sellerId, unit, originalPrice, sellingPrice, stock, image } = req.body;
    const rawSellPrice = sellingPrice !== undefined && sellingPrice !== '' ? sellingPrice : req.body.price;
    const rawOrigPrice = originalPrice !== undefined && originalPrice !== '' ? originalPrice : (req.body.mrp !== undefined && req.body.mrp !== '' ? req.body.mrp : rawSellPrice);

    if (!name || !categoryId || rawSellPrice === undefined || rawSellPrice === '') {
      return res.status(400).json({ success: false, message: 'Name, categoryId, and price are required' });
    }

    const sellPrice = parseFloat(String(rawSellPrice));
    const origPrice = parseFloat(String(rawOrigPrice)) || sellPrice;
    const discount = origPrice > sellPrice ? Math.round(((origPrice - sellPrice) / origPrice) * 100) : 0;

    const imgValue = await resolveS3ImageUrl(req.files, image || req.body.imageUrl || null);

    const finalSlug = slug || `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;

    const product = await prisma.kiranaProduct.create({
      data: {
        name,
        slug: finalSlug,
        brand: brand || 'Generic',
        categoryId: parseInt(String(categoryId)),
        sellerId: sellerId ? parseInt(String(sellerId)) : null,
        unit: unit || '1 unit',
        originalPrice: origPrice,
        sellingPrice: sellPrice,
        discountPercentage: discount,
        stock: stock ? parseInt(String(stock)) : 50,
        image: imgValue,
      },
      include: {
        category: true,
        seller: { select: { id: true, businessName: true, status: true, city: true } }
      }
    });

    const formatted = {
      ...product,
      productId: `PRD${String(product.id).padStart(3, '0')}`,
      imageUrl: product.image,
      price: product.sellingPrice,
      categoryId: product.categoryId,
      categoryName: product.category?.name || 'General',
      sellerName: product.seller?.businessName || 'Marketplace Seller',
      stockStatus: product.stock === 0 ? 'Out of Stock' : product.stock < 10 ? 'Low Stock' : 'In Stock'
    };

    return res.status(201).json({ success: true, data: formatted, product: formatted });
  } catch (error: any) {
    logger.error('Error creating product:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create product' });
  }
});

const updateProductHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const {
      name,
      slug,
      brand,
      categoryId,
      sellerId,
      unit,
      originalPrice,
      sellingPrice,
      stock,
      image,
      isBestseller,
      isOrganic
    } = req.body;

    const rawSellPrice = sellingPrice !== undefined ? sellingPrice : req.body.price;
    const rawOrigPrice = originalPrice !== undefined ? originalPrice : req.body.mrp;
    
    let imgValue = image || req.body.imageUrl;
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      imgValue = await resolveS3ImageUrl(req.files);
    }

    const updateData: any = {};
    if (name !== undefined && name !== '') updateData.name = name;
    if (slug !== undefined && slug !== '') updateData.slug = slug;
    if (brand !== undefined && brand !== '') updateData.brand = brand;
    if (categoryId !== undefined && categoryId !== '' && !isNaN(parseInt(String(categoryId)))) {
      updateData.categoryId = parseInt(String(categoryId));
    }
    if (sellerId !== undefined && sellerId !== '') updateData.sellerId = parseInt(String(sellerId));
    if (unit !== undefined && unit !== '') updateData.unit = unit;
    if (stock !== undefined && stock !== '') updateData.stock = parseInt(String(stock));
    if (imgValue !== undefined && imgValue !== '') updateData.image = imgValue;
    if (isBestseller !== undefined) updateData.isBestseller = Boolean(isBestseller);
    if (isOrganic !== undefined) updateData.isOrganic = Boolean(isOrganic);

    if (rawSellPrice !== undefined && rawSellPrice !== '') {
      const sellPrice = parseFloat(String(rawSellPrice));
      updateData.sellingPrice = sellPrice;
      const origPrice = (rawOrigPrice !== undefined && rawOrigPrice !== '') ? parseFloat(String(rawOrigPrice)) : sellPrice;
      updateData.originalPrice = origPrice;
      updateData.discountPercentage = origPrice > sellPrice ? Math.round(((origPrice - sellPrice) / origPrice) * 100) : 0;
    } else if (rawOrigPrice !== undefined && rawOrigPrice !== '') {
      updateData.originalPrice = parseFloat(String(rawOrigPrice));
    }

    const updated = await prisma.kiranaProduct.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        seller: { select: { id: true, businessName: true, status: true, city: true } }
      }
    });

    const formatted = {
      ...updated,
      productId: `PRD${String(updated.id).padStart(3, '0')}`,
      imageUrl: updated.image,
      price: updated.sellingPrice,
      categoryId: updated.categoryId,
      categoryName: updated.category?.name || 'General',
      sellerName: updated.seller?.businessName || 'Marketplace Seller',
      stockStatus: updated.stock === 0 ? 'Out of Stock' : updated.stock < 10 ? 'Low Stock' : 'In Stock'
    };

    return res.json({
      success: true,
      data: formatted,
      product: formatted,
      message: 'Product updated successfully'
    });
  } catch (error: any) {
    logger.error('Error updating product:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to update product' });
  }
};

inventoryRouter.patch('/:id', updateProductHandler);
inventoryRouter.put('/:id', updateProductHandler);

inventoryRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.kiranaProduct.delete({ where: { id } });
    return res.json({ success: true, message: 'Product deleted' });
  } catch (error: any) {
    logger.error('Error deleting product:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to delete product' });
  }
});
