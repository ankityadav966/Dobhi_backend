import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma.client';
import { resolveCategoryFilter } from '../../utils/category-helper';
import logger from '../../utils/logger';

const router = Router();

// GET /api/admin/coupons?category_id=...&search=...
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const cat = await resolveCategoryFilter(req);
    const search = String(req.query.search || '').trim().toLowerCase();

    let query = `SELECT * FROM "Coupon" WHERE 1=1`;
    const params: any[] = [];

    if (cat) {
      params.push(cat.id);
      query += ` AND ("categoryId" = $${params.length} OR "categoryId" IS NULL)`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (LOWER("code") LIKE $${params.length} OR LOWER("title") LIKE $${params.length} OR LOWER("description") LIKE $${params.length})`;
    }

    query += ` ORDER BY "createdAt" DESC`;

    const coupons: any[] = await prisma.$queryRawUnsafe(query, ...params);
    return res.json({
      success: true,
      coupons,
      data: coupons,
      categoryFilter: cat?.name || 'All Categories',
    });
  } catch (error: any) {
    logger.error('Error fetching coupons:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch coupons' });
  }
});

// POST /api/admin/coupons
router.post('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const {
      code,
      title,
      description,
      discountType,
      discountValue,
      minOrderValue,
      maxDiscount,
      usageLimit,
      validFrom,
      validUntil,
      bgColor,
      textColor,
      isActive,
      isFirstUserOnly,
      categoryId,
    } = req.body;

    if (!code || discountValue === undefined) {
      return res.status(400).json({ success: false, message: 'Coupon code and discountValue are required' });
    }

    const cleanCode = String(code).trim().toUpperCase();

    const existing: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM "Coupon" WHERE "code" = $1 LIMIT 1`,
      cleanCode
    );
    if (existing && existing.length > 0) {
      return res.status(409).json({ success: false, message: 'A coupon with this code already exists' });
    }

    let resolvedCatId = categoryId ? parseInt(String(categoryId), 10) : null;
    if (isNaN(resolvedCatId as number)) resolvedCatId = null;

    const created: any[] = await prisma.$queryRawUnsafe(
      `INSERT INTO "Coupon" (
        "code", "title", "description", "discountType", "discountValue",
        "minOrderValue", "maxDiscount", "usageLimit", "usedCount",
        "validFrom", "validUntil", "bgColor", "textColor",
        "isActive", "isFirstUserOnly", "categoryId", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, 0,
        $9, $10, $11, $12, $13, $14, $15, NOW(), NOW()
      ) RETURNING *`,
      cleanCode,
      title || cleanCode,
      description || null,
      discountType || 'PERCENT',
      parseFloat(discountValue),
      minOrderValue ? parseFloat(minOrderValue) : 0,
      maxDiscount ? parseFloat(maxDiscount) : null,
      usageLimit ? parseInt(usageLimit) : null,
      validFrom ? new Date(validFrom) : null,
      validUntil ? new Date(validUntil) : null,
      bgColor || '#0B2239',
      textColor || '#ffffff',
      isActive !== undefined ? Boolean(isActive) : true,
      Boolean(isFirstUserOnly),
      resolvedCatId
    );

    const coupon = created[0];
    return res.status(201).json({ success: true, message: 'Coupon created successfully', coupon, data: coupon });
  } catch (error: any) {
    logger.error('Error creating coupon:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create coupon' });
  }
});

// PUT & PATCH /api/admin/coupons/:id
const updateCouponHandler = async (req: Request, res: Response): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid coupon ID' });
    }

    const existing: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM "Coupon" WHERE "id" = $1 LIMIT 1`,
      id
    );
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    const curr = existing[0];
    const b = req.body;

    const code = b.code !== undefined ? String(b.code).trim().toUpperCase() : curr.code;
    const title = b.title !== undefined ? b.title : curr.title;
    const description = b.description !== undefined ? b.description : curr.description;
    const discountType = b.discountType !== undefined ? b.discountType : curr.discountType;
    const discountValue = b.discountValue !== undefined ? parseFloat(b.discountValue) : curr.discountValue;
    const minOrderValue = b.minOrderValue !== undefined ? parseFloat(b.minOrderValue) : curr.minOrderValue;
    const maxDiscount = b.maxDiscount !== undefined ? (b.maxDiscount ? parseFloat(b.maxDiscount) : null) : curr.maxDiscount;
    const usageLimit = b.usageLimit !== undefined ? (b.usageLimit ? parseInt(b.usageLimit) : null) : curr.usageLimit;
    const validFrom = b.validFrom !== undefined ? (b.validFrom ? new Date(b.validFrom) : null) : curr.validFrom;
    const validUntil = b.validUntil !== undefined ? (b.validUntil ? new Date(b.validUntil) : null) : curr.validUntil;
    const bgColor = b.bgColor !== undefined ? b.bgColor : curr.bgColor;
    const textColor = b.textColor !== undefined ? b.textColor : curr.textColor;
    const isActive = b.isActive !== undefined ? Boolean(b.isActive) : curr.isActive;
    const isFirstUserOnly = b.isFirstUserOnly !== undefined ? Boolean(b.isFirstUserOnly) : curr.isFirstUserOnly;
    const categoryId = b.categoryId !== undefined ? (b.categoryId ? parseInt(String(b.categoryId), 10) : null) : curr.categoryId;

    const updated: any[] = await prisma.$queryRawUnsafe(
      `UPDATE "Coupon" SET
        "code" = $1, "title" = $2, "description" = $3, "discountType" = $4, "discountValue" = $5,
        "minOrderValue" = $6, "maxDiscount" = $7, "usageLimit" = $8,
        "validFrom" = $9, "validUntil" = $10, "bgColor" = $11, "textColor" = $12,
        "isActive" = $13, "isFirstUserOnly" = $14, "categoryId" = $15, "updatedAt" = NOW()
      WHERE "id" = $16 RETURNING *`,
      code, title, description, discountType, discountValue,
      minOrderValue, maxDiscount, usageLimit,
      validFrom, validUntil, bgColor, textColor,
      isActive, isFirstUserOnly, categoryId, id
    );

    const coupon = updated[0];
    return res.json({ success: true, message: 'Coupon updated successfully', coupon, data: coupon });
  } catch (error: any) {
    logger.error('Error updating coupon:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to update coupon' });
  }
};

router.put('/:id', updateCouponHandler);
router.patch('/:id', updateCouponHandler);

// PATCH /api/admin/coupons/:id/toggle
router.patch('/:id/toggle', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid coupon ID' });

    const existing: any[] = await prisma.$queryRawUnsafe(
      `SELECT "id", "isActive" FROM "Coupon" WHERE "id" = $1 LIMIT 1`,
      id
    );
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    const newStatus = !existing[0].isActive;
    const updated: any[] = await prisma.$queryRawUnsafe(
      `UPDATE "Coupon" SET "isActive" = $1, "updatedAt" = NOW() WHERE "id" = $2 RETURNING *`,
      newStatus, id
    );

    return res.json({
      success: true,
      message: `Coupon ${newStatus ? 'activated' : 'deactivated'} successfully`,
      coupon: updated[0],
      data: updated[0],
    });
  } catch (error: any) {
    logger.error('Error toggling coupon status:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to toggle coupon status' });
  }
});

// DELETE /api/admin/coupons/:id
router.delete('/:id', async (req: Request, res: Response): Promise<any> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid coupon ID' });

    await prisma.$executeRawUnsafe(`DELETE FROM "Coupon" WHERE "id" = $1`, id);
    return res.json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting coupon:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to delete coupon' });
  }
});

export default router;
