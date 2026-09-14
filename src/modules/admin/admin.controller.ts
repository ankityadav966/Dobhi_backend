import { Request, Response } from 'express';
import { DurationUnit } from '@prisma/client';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';

const VALID_DURATION_UNITS: ReadonlySet<string> = new Set<DurationUnit>(['HOUR', 'DAY', 'WEEK', 'MONTH']);

/**
 * PUT /admin/settings/commission
 *
 * Updates the platform commission rate.
 * Validates 0 ≤ commissionRate ≤ 0.50.
 * Upserts the single PlatformSetting row (id = 1).
 * Change affects future payouts only — past payouts are unchanged.
 */
export async function updateCommission(req: Request, res: Response): Promise<void> {
  try {
    const { commissionRate } = req.body;

    // Validate presence and type
    if (commissionRate === undefined || commissionRate === null) {
      res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'commissionRate is required',
      });
      return;
    }

    const rate = Number(commissionRate);

    if (isNaN(rate)) {
      res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'commissionRate must be a number',
      });
      return;
    }

    if (rate < 0 || rate > 0.50) {
      res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'commissionRate must be between 0 and 0.50 (0% – 50%)',
      });
      return;
    }

    // Upsert the single settings row (id = 1 is always the only row)
    const updated = await prisma.platformSetting.upsert({
      where: { id: 1 },
      update: { commissionRate: rate },
      create: { id: 1, commissionRate: rate },
    });

    logger.info('Admin: Commission rate updated', {
      previousRate: '<see DB history>',
      newRate: updated.commissionRate,
      updatedAt: updated.updatedAt,
    });

    res.status(200).json({
      success: true,
      message: `Commission rate updated to ${(updated.commissionRate * 100).toFixed(2)}%`,
      data: {
        commissionRate: updated.commissionRate,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Admin: Error updating commission rate', { error });
    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Failed to update commission rate',
    });
  }
}

/**
 * GET /admin/settings/commission
 *
 * Returns the current platform commission rate.
 */
export async function getCommission(_req: Request, res: Response): Promise<void> {
  try {
    const setting = await prisma.platformSetting.findUnique({ where: { id: 1 } });
    const commissionRate = setting?.commissionRate ?? 0.20;

    res.status(200).json({
      success: true,
      data: {
        commissionRate,
        commissionPercent: `${(commissionRate * 100).toFixed(2)}%`,
        updatedAt: setting?.updatedAt ?? null,
      },
    });
  } catch (error) {
    logger.error('Admin: Error fetching commission rate', { error });
    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch commission rate',
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /admin/services
/**
 * GET /admin/services
 * Returns services filtered by category_id if provided.
 */
export async function listServices(req: Request, res: Response): Promise<void> {
  try {
    const { resolveCategoryFilter } = await import('../../utils/category-helper');
    const cat = await resolveCategoryFilter(req);
    let whereClause = '';
    const params: any[] = [];

    if (cat) {
      if (cat.slug === 'laundry') {
        params.push(cat.id, '%laundry%', '%dry clean%', '%press%');
        whereClause = `WHERE (s."categoryId" = $1 OR LOWER(s.category) LIKE $2 OR LOWER(s.name) LIKE $2 OR LOWER(s.name) LIKE $3 OR LOWER(s.name) LIKE $4)`;
      } else if (cat.slug === 'grocery') {
        params.push(cat.id, '%grocery%', '%milk%');
        whereClause = `WHERE (s."categoryId" = $1 OR LOWER(s.category) LIKE $2 OR LOWER(s.name) LIKE $2 OR LOWER(s.name) LIKE $3)`;
      } else if (cat.slug === 'home-services') {
        params.push(cat.id, '%clean%', '%cook%', '%driver%', '%electrician%', '%maid%', '%babysitter%');
        whereClause = `WHERE (s."categoryId" = $1 OR s."categoryId" IN (1,2,4,5,6,7,8) OR LOWER(s.category) LIKE $2 OR LOWER(s.name) LIKE $2 OR LOWER(s.name) LIKE $3 OR LOWER(s.name) LIKE $4)`;
      } else {
        params.push(cat.id, `%${cat.name.toLowerCase()}%`);
        whereClause = `WHERE (s."categoryId" = $1 OR LOWER(s.category) LIKE $2 OR LOWER(s.name) LIKE $2)`;
      }
    }

    let services: any[] = await prisma.$queryRawUnsafe(`
      SELECT s.*, 
        COALESCE(c.name, s.category, '') as "categoryName",
        CASE WHEN c.id IS NOT NULL THEN json_build_object('id', c.id, 'name', c.name) ELSE NULL END as "serviceCategory",
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', p.id, 
            'name', p.name, 
            'price', p.price, 
            'durationValue', p."durationValue", 
            'durationUnit', p."durationUnit", 
            'sortOrder', p."sortOrder", 
            'isActive', p."isActive"
          ) ORDER BY p."sortOrder" ASC, p.id ASC) 
           FROM "ServicePlan" p 
           WHERE p."serviceId" = s.id), '[]'::json
        ) as plans
      FROM "Service" s
      LEFT JOIN "ServiceCategory" c ON c.id = s."categoryId"
      ${whereClause}
      ORDER BY s.id ASC;
    `, ...params);

    // If laundry requested, also ensure LaundryCatalogServices appear
    if (cat && cat.slug === 'laundry') {
      const laundryCatalog = await prisma.laundryCatalogService.findMany();
      if (laundryCatalog && laundryCatalog.length > 0) {
        const catalogMapped = laundryCatalog.map((lc, idx) => ({
          id: 1000 + lc.id,
          name: lc.name,
          categoryName: 'Laundry & Fabric Care',
          categoryId: 2,
          category: 'Laundry',
          description: lc.description,
          imageUrl: lc.image,
          icon: lc.icon,
          isActive: lc.isActive,
          price: idx === 0 ? 25 : idx === 1 ? 38 : idx === 2 ? 85 : 18,
          plans: [
            { id: 2000 + lc.id, name: 'Standard Turnaround', price: idx === 0 ? 25 : idx === 1 ? 38 : idx === 2 ? 85 : 18, sortOrder: 1, isActive: true },
            { id: 2100 + lc.id, name: 'Express Delivery', price: (idx === 0 ? 25 : idx === 1 ? 38 : idx === 2 ? 85 : 18) + 15, sortOrder: 2, isActive: true },
          ],
        }));
        services = [...services, ...catalogMapped];
      }
    }

    res.status(200).json({
      success: true,
      data: services,
      services,
      total: services.length,
      categoryFilter: cat?.name || 'All Categories',
    });
  } catch (error) {
    logger.error('Admin: Error listing services', { error });
    res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Failed to list services' });
  }
}

/**
 * POST /admin/services
 */
export async function createService(req: Request, res: Response): Promise<void> {
  try {
    const {
      name,
      isActive,
      imageUrl,
      icon,
      description,
      price,
      originalPrice,
      duration,
      category,
      categoryId,
      plans,
      included,
      includedServices,
      notIncluded,
      excludedServices,
      faqs,
      requirements,
    } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'name is required and must be a non-empty string' });
      return;
    }
    if (name.trim().length > 100) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'name must be 100 characters or fewer' });
      return;
    }

    const finalImg = imageUrl || icon || req.body.image || null;
    const finalPrice = price !== undefined ? parseFloat(String(price)) : 0;
    const finalOrigPrice = originalPrice ? parseFloat(String(originalPrice)) : null;
    const finalDuration = duration ? parseInt(String(duration), 10) : null;
    const finalCat = category || null;
    const finalCatId = categoryId ? parseInt(String(categoryId), 10) : null;
    const activeVal = isActive !== undefined ? Boolean(isActive) : true;
    const finalDesc = description || null;
    const incJson = JSON.stringify(includedServices || included || []);
    const excJson = JSON.stringify(excludedServices || notIncluded || []);
    const faqJson = JSON.stringify(faqs || []);
    const reqJson = JSON.stringify(requirements || []);

    const rows: any[] = await prisma.$queryRawUnsafe(`
      INSERT INTO "Service" (
        name, "isActive", "imageUrl", icon, description, price, "originalPrice", duration,
        category, "categoryId", "includedServices", "excludedServices", faqs, requirements,
        "createdAt", "updatedAt"
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, NOW(), NOW())
      RETURNING *;
    `, name.trim(), activeVal, finalImg, finalImg, finalDesc, finalPrice, finalOrigPrice, finalDuration, finalCat, finalCatId, incJson, excJson, faqJson, reqJson);

    const created = rows[0];

    // Create plans if provided
    if (Array.isArray(plans) && plans.length > 0) {
      for (let i = 0; i < plans.length; i++) {
        const p = plans[i];
        if (p && p.price !== undefined) {
          const planName = p.name || 'Standard Plan';
          let unit = String(p.durationUnit || 'HOUR').toUpperCase();
          if (!['HOUR', 'DAY', 'MONTH'].includes(unit)) unit = 'HOUR';
          await prisma.$executeRawUnsafe(`
            INSERT INTO "ServicePlan" ("serviceId", name, price, "durationValue", "durationUnit", "sortOrder", "isActive")
            VALUES ($1, $2, $3, $4, $5::"DurationUnit", $6, $7);
          `, created.id, planName, parseFloat(String(p.price)), p.durationValue || 1, unit, p.sortOrder || (i + 1), true);
        }
      }
    } else if (finalPrice > 0) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "ServicePlan" ("serviceId", name, price, "durationValue", "durationUnit", "sortOrder", "isActive")
        VALUES ($1, $2, $3, 1, 'HOUR'::"DurationUnit", 1, true);
      `, created.id, 'Standard Plan', finalPrice);
    }

    logger.info('Admin: Service created', { serviceId: created.id, name: created.name });
    res.status(201).json({ success: true, message: 'Service created successfully', data: created });
  } catch (error: any) {
    logger.error('Admin: Error creating service', { error });
    res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: error.message || 'Failed to create service' });
  }
}

/**
 * PATCH & PUT /admin/services/:id
 */
export async function updateService(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid service ID' });
      return;
    }

    const {
      name,
      isActive,
      action,
      imageUrl,
      icon,
      description,
      price,
      originalPrice,
      duration,
      category,
      categoryId,
      plans,
      included,
      includedServices,
      notIncluded,
      excludedServices,
      faqs,
      requirements,
    } = req.body;

    let activeFlag: boolean | undefined = undefined;
    if (typeof isActive === 'boolean') {
      activeFlag = isActive;
    } else if (typeof isActive === 'string') {
      activeFlag = isActive === 'true';
    } else if (action !== undefined) {
      activeFlag = action === 'activate' || action === 'active' || action === true;
    }

    const existingRows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "Service" WHERE id = $1;`, id);
    if (!existingRows || existingRows.length === 0) {
      res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Service not found' });
      return;
    }
    const existing = existingRows[0];

    const finalName = name !== undefined ? name.trim() : existing.name;
    const finalActive = activeFlag !== undefined ? activeFlag : existing.isActive;
    const finalImg = imageUrl !== undefined ? imageUrl : icon !== undefined ? icon : req.body.image !== undefined ? req.body.image : existing.imageUrl;
    const finalDesc = description !== undefined ? description : existing.description;
    const finalPrice = price !== undefined ? parseFloat(String(price)) : existing.price;
    const finalOrigPrice = originalPrice !== undefined ? (originalPrice ? parseFloat(String(originalPrice)) : null) : existing.originalPrice;
    const finalDuration = duration !== undefined ? (duration ? parseInt(String(duration), 10) : null) : existing.duration;
    const finalCat = category !== undefined ? category : existing.category;
    const finalCatId = categoryId !== undefined ? (categoryId ? parseInt(String(categoryId), 10) : null) : existing.categoryId;

    const incJson = JSON.stringify(includedServices !== undefined ? includedServices : (included !== undefined ? included : existing.includedServices || []));
    const excJson = JSON.stringify(excludedServices !== undefined ? excludedServices : (notIncluded !== undefined ? notIncluded : existing.excludedServices || []));
    const faqJson = JSON.stringify(faqs !== undefined ? faqs : existing.faqs || []);
    const reqJson = JSON.stringify(requirements !== undefined ? requirements : existing.requirements || []);

    const updatedRows: any[] = await prisma.$queryRawUnsafe(`
      UPDATE "Service"
      SET name = $1, "isActive" = $2, "imageUrl" = $3, icon = $4, description = $5,
          price = $6, "originalPrice" = $7, duration = $8, category = $9, "categoryId" = $10,
          "includedServices" = $11::jsonb, "excludedServices" = $12::jsonb, faqs = $13::jsonb, requirements = $14::jsonb,
          "updatedAt" = NOW()
      WHERE id = $15
      RETURNING *;
    `, finalName, finalActive, finalImg, finalImg, finalDesc, finalPrice, finalOrigPrice, finalDuration, finalCat, finalCatId, incJson, excJson, faqJson, reqJson, id);

    const updated = updatedRows[0];

    // Update plans if provided
    if (Array.isArray(plans) && plans.length > 0) {
      await prisma.$executeRawUnsafe(`DELETE FROM "ServicePlan" WHERE "serviceId" = $1;`, id);
      for (let i = 0; i < plans.length; i++) {
        const p = plans[i];
        if (p && p.price !== undefined) {
          const planName = p.name || `Plan ${i + 1}`;
          let unit = String(p.durationUnit || 'HOUR').toUpperCase();
          if (!['HOUR', 'DAY', 'MONTH'].includes(unit)) unit = 'HOUR';
          await prisma.$executeRawUnsafe(`
            INSERT INTO "ServicePlan" ("serviceId", name, price, "durationValue", "durationUnit", "sortOrder", "isActive")
            VALUES ($1, $2, $3, $4, $5::"DurationUnit", $6, $7);
          `, id, planName, parseFloat(String(p.price)), p.durationValue || 1, unit, p.sortOrder || (i + 1), true);
        }
      }
    }

    logger.info('Admin: Service updated', { serviceId: id, name: updated.name, isActive: updated.isActive });
    res.status(200).json({ success: true, message: 'Service updated successfully', data: updated });
  } catch (error: any) {
    logger.error('Admin: Error updating service', { error });
    res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: error.message || 'Failed to update service' });
  }
}

/**
 * DELETE /admin/services/:id
 * Safely cascades and deletes associated records without foreign key crash.
 */
export async function deleteService(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid service ID' });
      return;
    }

    const existingRows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "Service" WHERE id = $1;`, id);
    if (!existingRows || existingRows.length === 0) {
      res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Service not found' });
      return;
    }

    // Safely remove dependencies
    await prisma.$transaction([
      prisma.$executeRawUnsafe(`DELETE FROM "ServiceCoverage" WHERE "serviceId" = $1;`, id),
      prisma.$executeRawUnsafe(`DELETE FROM "HelperService" WHERE "serviceId" = $1;`, id),
      prisma.$executeRawUnsafe(`DELETE FROM "BookingRequest" WHERE "serviceId" = $1;`, id),
      prisma.$executeRawUnsafe(`DELETE FROM "ServicePlan" WHERE "serviceId" = $1;`, id),
      prisma.$executeRawUnsafe(`DELETE FROM "Service" WHERE id = $1;`, id),
    ]);

    logger.info('Admin: Service deleted', { serviceId: id });
    res.status(200).json({ success: true, message: 'Service deleted successfully', id });
  } catch (error: any) {
    logger.error('Admin: Error deleting service', { error });
    res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: error.message || 'Failed to delete service' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE PLANS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /admin/service-plans
 * Returns all service plans with their parent service name.
 * Optional query param: ?serviceId=<number> to filter by service.
 */
export async function listServicePlans(req: Request, res: Response): Promise<void> {
  try {
    const serviceIdParam = req.query.serviceId;
    const where: { serviceId?: number } = {};
    if (serviceIdParam !== undefined) {
      const sid = parseInt(String(serviceIdParam), 10);
      if (isNaN(sid) || sid <= 0) {
        res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid serviceId query parameter' });
        return;
      }
      where.serviceId = sid;
    }

    const plans = await prisma.servicePlan.findMany({
      where,
      orderBy: [{ serviceId: 'asc' }, { id: 'asc' }],
      include: { service: { select: { id: true, name: true, isActive: true } } },
    });

    res.status(200).json({ success: true, data: plans });
  } catch (error) {
    logger.error('Admin: Error listing service plans', { error });
    res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Failed to list service plans' });
  }
}

/**
 * POST /admin/service-plans
 * Body: { serviceId: number, name: string, price: number, durationValue: number, durationUnit: "HOUR"|"DAY"|"WEEK"|"MONTH", sortOrder?: number }
 * price is in paise (e.g. ₹200 = 20000)
 */
export async function createServicePlan(req: Request, res: Response): Promise<void> {
  try {
    const { serviceId, name, price, durationValue, durationUnit, sortOrder } = req.body;

    // ── validation ──────────────────────────────────────────────────────────
    const sid = parseInt(String(serviceId), 10);
    if (!serviceId || isNaN(sid) || sid <= 0) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'serviceId is required and must be a positive integer' });
      return;
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'name is required and must be a non-empty string' });
      return;
    }
    const parsedPrice = Math.round(Number(price));
    if (price === undefined || price === null || isNaN(parsedPrice) || parsedPrice <= 0) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'price is required and must be a positive integer (paise)' });
      return;
    }
    const parsedDurationValue = parseInt(String(durationValue), 10);
    if (!durationValue || isNaN(parsedDurationValue) || parsedDurationValue <= 0) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'durationValue is required and must be a positive integer' });
      return;
    }
    if (!durationUnit || !VALID_DURATION_UNITS.has(String(durationUnit).toUpperCase())) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'durationUnit must be one of: HOUR, DAY, WEEK, MONTH' });
      return;
    }
    const parsedSortOrder = sortOrder !== undefined ? parseInt(String(sortOrder), 10) : 0;
    if (isNaN(parsedSortOrder) || parsedSortOrder < 0) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'sortOrder must be a non-negative integer' });
      return;
    }

    // ── check parent service exists ──────────────────────────────────────────
    const service = await prisma.service.findUnique({ where: { id: sid } });
    if (!service) {
      res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Service not found' });
      return;
    }

    const plan = await prisma.servicePlan.create({
      data: {
        serviceId:     sid,
        name:          name.trim(),
        price:         parsedPrice,
        durationValue: parsedDurationValue,
        durationUnit:  String(durationUnit).toUpperCase() as DurationUnit,
        sortOrder:     parsedSortOrder,
      },
      include: { service: { select: { id: true, name: true } } },
    });

    logger.info('Admin: ServicePlan created', { planId: plan.id, serviceId: sid, name });
    res.status(201).json({ success: true, message: 'Service plan created successfully', data: plan });
  } catch (error: any) {
    logger.error('Admin: Error creating service plan', { error });
    res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Failed to create service plan' });
  }
}

/**
 * PATCH /admin/service-plans/:id
 * Body: { name?: string, price?: number, durationValue?: number, durationUnit?: "HOUR"|"DAY"|"WEEK"|"MONTH", sortOrder?: number, isActive?: boolean }
 * Note: serviceId is not patchable — changing the parent requires delete + create.
 */
export async function updateServicePlan(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid service plan ID' });
      return;
    }

    const { name, price, durationValue, durationUnit, sortOrder, isActive } = req.body;
    const updateData: {
      name?:          string;
      price?:         number;
      durationValue?: number;
      durationUnit?:  DurationUnit;
      sortOrder?:     number;
      isActive?:      boolean;
    } = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'name must be a non-empty string' });
        return;
      }
      updateData.name = name.trim();
    }
    if (price !== undefined) {
      const parsedPrice = Math.round(Number(price));
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'price must be a positive integer (paise)' });
        return;
      }
      updateData.price = parsedPrice;
    }
    if (durationValue !== undefined) {
      const parsedDurationValue = parseInt(String(durationValue), 10);
      if (isNaN(parsedDurationValue) || parsedDurationValue <= 0) {
        res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'durationValue must be a positive integer' });
        return;
      }
      updateData.durationValue = parsedDurationValue;
    }
    if (durationUnit !== undefined) {
      if (!VALID_DURATION_UNITS.has(String(durationUnit).toUpperCase())) {
        res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'durationUnit must be one of: HOUR, DAY, WEEK, MONTH' });
        return;
      }
      updateData.durationUnit = String(durationUnit).toUpperCase() as DurationUnit;
    }
    if (sortOrder !== undefined) {
      const parsedSortOrder = parseInt(String(sortOrder), 10);
      if (isNaN(parsedSortOrder) || parsedSortOrder < 0) {
        res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'sortOrder must be a non-negative integer' });
        return;
      }
      updateData.sortOrder = parsedSortOrder;
    }
    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'isActive must be a boolean' });
        return;
      }
      updateData.isActive = isActive;
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'No valid fields provided for update' });
      return;
    }

    const existing = await prisma.servicePlan.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Service plan not found' });
      return;
    }

    const updated = await prisma.servicePlan.update({
      where: { id },
      data: updateData,
      include: { service: { select: { id: true, name: true } } },
    });

    logger.info('Admin: ServicePlan updated', { planId: id });
    res.status(200).json({ success: true, message: 'Service plan updated successfully', data: updated });
  } catch (error: any) {
    logger.error('Admin: Error updating service plan', { error });
    res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Failed to update service plan' });
  }
}

/**
 * DELETE /admin/service-plans/:id
 */
export async function deleteServicePlan(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid service plan ID' });
      return;
    }

    const existing = await prisma.servicePlan.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Service plan not found' });
      return;
    }

    await prisma.servicePlan.delete({ where: { id } });

    logger.info('Admin: ServicePlan deleted', { planId: id });
    res.status(200).json({ success: true, message: 'Service plan deleted successfully' });
  } catch (error) {
    logger.error('Admin: Error deleting service plan', { error });
    res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Failed to delete service plan' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PLATFORM SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PATCH /admin/platform-settings
 * Body: { commissionRate, maxBookingHours, minBookingHours, cancellationFeePercent }
 *
 * Validation:
 *   commissionRate         0 ≤ x ≤ 1
 *   maxBookingHours        >= minBookingHours
 *   minBookingHours        >= 1
 *   cancellationFeePercent 0 ≤ x ≤ 100
 *
 * Always updates the single row with id = 1.
 */
export async function updatePlatformSettings(req: Request, res: Response): Promise<void> {
  try {
    const { commissionRate, maxBookingHours, minBookingHours, cancellationFeePercent } = req.body;
    const adminId = (req as any).user?.userId ?? 'unknown';

    // ── Validate commissionRate ────────────────────────────────────────────────
    if (commissionRate === undefined || commissionRate === null) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'commissionRate is required' });
      return;
    }
    const rate = Number(commissionRate);
    if (isNaN(rate) || rate < 0 || rate > 1) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'commissionRate must be a number between 0 and 1' });
      return;
    }

    // ── Validate maxBookingHours ───────────────────────────────────────────────
    if (maxBookingHours === undefined || maxBookingHours === null) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'maxBookingHours is required' });
      return;
    }
    const maxHours = Number(maxBookingHours);
    if (!Number.isInteger(maxHours) || maxHours < 1) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'maxBookingHours must be a positive integer' });
      return;
    }

    // ── Validate minBookingHours ───────────────────────────────────────────────
    if (minBookingHours === undefined || minBookingHours === null) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'minBookingHours is required' });
      return;
    }
    const minHours = Number(minBookingHours);
    if (!Number.isInteger(minHours) || minHours < 1) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'minBookingHours must be >= 1' });
      return;
    }
    if (maxHours < minHours) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'maxBookingHours must be >= minBookingHours' });
      return;
    }

    // ── Validate cancellationFeePercent ───────────────────────────────────────
    if (cancellationFeePercent === undefined || cancellationFeePercent === null) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'cancellationFeePercent is required' });
      return;
    }
    const cancelFee = Number(cancellationFeePercent);
    if (isNaN(cancelFee) || cancelFee < 0 || cancelFee > 100) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'cancellationFeePercent must be between 0 and 100' });
      return;
    }

    const updated = await prisma.platformSetting.update({
      where: { id: 1 },
      data: {
        commissionRate:         rate,
        maxBookingHours:        maxHours,
        minBookingHours:        minHours,
        cancellationFeePercent: cancelFee,
        updatedAt:              new Date(),
      },
    });

    logger.info('Platform settings updated', {
      adminId,
      settings: {
        commissionRate:         updated.commissionRate,
        maxBookingHours:        updated.maxBookingHours,
        minBookingHours:        updated.minBookingHours,
        cancellationFeePercent: updated.cancellationFeePercent,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Platform settings updated',
      data: {
        commissionRate:         updated.commissionRate,
        maxBookingHours:        updated.maxBookingHours,
        minBookingHours:        updated.minBookingHours,
        cancellationFeePercent: updated.cancellationFeePercent,
        updatedAt:              updated.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Admin: Error updating platform settings', { error });
    res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Failed to update platform settings' });
  }
}
