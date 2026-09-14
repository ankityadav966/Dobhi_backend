import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';

const router = Router();

// Helper to extract category filter condition
async function getCategoryCondition(categoryParam?: string) {
  if (!categoryParam || categoryParam === 'all') return null;
  const numId = parseInt(categoryParam, 10);
  const cat = await prisma.platformCategory.findFirst({
    where: {
      OR: [
        ...(!isNaN(numId) ? [{ id: numId }] : []),
        { slug: categoryParam.toLowerCase() },
        { name: { equals: categoryParam, mode: 'insensitive' } },
      ]
    }
  });
  return cat;
}

/**
 * GET /api/admin/sellers?category_id=...
 */
router.get('/sellers', async (req: Request, res: Response) => {
  try {
    const categoryParam = String(req.query.category_id || req.query.category || 'all');
    const cat = await getCategoryCondition(categoryParam);

    const where: any = {};
    if (cat) {
      where.OR = [
        { categoryId: cat.id },
        { businessType: { contains: cat.slug, mode: 'insensitive' } },
        { businessType: { contains: cat.name, mode: 'insensitive' } },
      ];
    }

    const sellers = await prisma.seller.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        _count: { select: { products: true, orders: true, workers: true } }
      }
    });

    return res.json({
      success: true,
      categoryFilter: cat?.name || 'All Categories',
      total: sellers.length,
      data: sellers,
    });
  } catch (err: any) {
    logger.error('Error fetching admin sellers:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/admin/orders?category_id=...
 */
router.get('/orders', async (req: Request, res: Response) => {
  try {
    const categoryParam = String(req.query.category_id || req.query.category || 'all');
    const cat = await getCategoryCondition(categoryParam);

    const where: any = {};
    if (cat) {
      where.OR = [
        { categoryId: cat.id },
        { seller: { categoryId: cat.id } },
        { orderType: { contains: cat.name, mode: 'insensitive' } },
        { orderType: { contains: cat.slug, mode: 'insensitive' } },
      ];
    }

    const orders = await prisma.sellerOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        seller: { select: { id: true, businessName: true, businessType: true } },
        category: true,
      }
    });

    return res.json({
      success: true,
      categoryFilter: cat?.name || 'All Categories',
      total: orders.length,
      data: orders,
    });
  } catch (err: any) {
    logger.error('Error fetching admin orders:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/admin/products?category_id=...
 */
router.get('/products', async (req: Request, res: Response) => {
  try {
    const categoryParam = String(req.query.category_id || req.query.category || 'all');
    const cat = await getCategoryCondition(categoryParam);

    const where: any = {};
    if (cat) {
      where.OR = [
        { seller: { categoryId: cat.id } },
        { seller: { businessType: { contains: cat.slug, mode: 'insensitive' } } },
      ];
    }

    const products = await prisma.kiranaProduct.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        seller: { select: { id: true, businessName: true } }
      }
    });

    return res.json({
      success: true,
      categoryFilter: cat?.name || 'All Categories',
      total: products.length,
      data: products,
    });
  } catch (err: any) {
    logger.error('Error fetching admin products:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/admin/workers?category_id=...
 */
router.get('/workers', async (req: Request, res: Response) => {
  try {
    const categoryParam = String(req.query.category_id || req.query.category || 'all');
    const cat = await getCategoryCondition(categoryParam);

    const where: any = {};
    if (cat) {
      where.seller = {
        OR: [
          { categoryId: cat.id },
          { businessType: { contains: cat.slug, mode: 'insensitive' } },
        ]
      };
    }

    const workers = await prisma.sellerWorker.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        seller: { select: { id: true, businessName: true, businessType: true } }
      }
    });

    return res.json({
      success: true,
      categoryFilter: cat?.name || 'All Categories',
      total: workers.length,
      data: workers,
    });
  } catch (err: any) {
    logger.error('Error fetching admin workers:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/admin/revenue?category_id=...
 */
router.get('/revenue', async (req: Request, res: Response) => {
  try {
    const categoryParam = String(req.query.category_id || req.query.category || 'all');
    const cat = await getCategoryCondition(categoryParam);

    const where: any = {
      status: { in: ['Completed', 'Delivered'] }
    };

    if (cat) {
      where.OR = [
        { categoryId: cat.id },
        { seller: { categoryId: cat.id } },
        { orderType: { contains: cat.name, mode: 'insensitive' } },
      ];
    }

    const aggregate = await prisma.sellerOrder.aggregate({
      where,
      _sum: { totalAmount: true },
      _count: { id: true }
    });

    return res.json({
      success: true,
      categoryFilter: cat?.name || 'All Categories',
      totalRevenue: aggregate._sum.totalAmount || 0,
      totalCompletedOrders: aggregate._count.id,
    });
  } catch (err: any) {
    logger.error('Error fetching admin revenue:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
