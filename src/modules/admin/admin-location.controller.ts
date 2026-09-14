import { Request, Response } from 'express';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';

// ─── POST /api/admin/cities ────────────────────────────────────────────────────
export async function createCity(req: Request, res: Response): Promise<void> {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'name is required and must be a non-empty string' });
      return;
    }

    const city = await prisma.city.create({ data: { name: name.trim() } });

    logger.info('Admin: City created', { cityId: city.id, name: city.name });
    res.status(201).json({ success: true, message: 'City created successfully', data: city });
  } catch (error) {
    logger.error('Admin: Error creating city', { error });
    res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Failed to create city' });
  }
}

// ─── POST /api/admin/areas ────────────────────────────────────────────────────
export async function createArea(req: Request, res: Response): Promise<void> {
  try {
    const { name, pincode, cityId } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'name is required and must be a non-empty string' });
      return;
    }
    if (!pincode || typeof pincode !== 'string' || !pincode.trim()) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'pincode is required and must be a non-empty string' });
      return;
    }
    const parsedCityId = parseInt(String(cityId), 10);
    if (!cityId || isNaN(parsedCityId) || parsedCityId <= 0) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'cityId is required and must be a positive integer' });
      return;
    }

    const city = await prisma.city.findUnique({ where: { id: parsedCityId } });
    if (!city) {
      res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'City not found' });
      return;
    }

    const area = await prisma.area.create({
      data: { name: name.trim(), pincode: pincode.trim(), cityId: parsedCityId },
      include: { city: { select: { id: true, name: true } } },
    });

    logger.info('Admin: Area created', { areaId: area.id, name: area.name, pincode: area.pincode });
    res.status(201).json({ success: true, message: 'Area created successfully', data: area });
  } catch (error) {
    logger.error('Admin: Error creating area', { error });
    res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Failed to create area' });
  }
}

// ─── POST /api/admin/service-coverage ─────────────────────────────────────────
export async function createServiceCoverage(req: Request, res: Response): Promise<void> {
  try {
    const { serviceId, areaIds } = req.body;

    const parsedServiceId = parseInt(String(serviceId), 10);
    if (!serviceId || isNaN(parsedServiceId) || parsedServiceId <= 0) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'serviceId is required and must be a positive integer' });
      return;
    }
    if (!Array.isArray(areaIds) || areaIds.length === 0) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'areaIds must be a non-empty array of integers' });
      return;
    }
    const parsedAreaIds: number[] = [];
    for (const id of areaIds) {
      const n = parseInt(String(id), 10);
      if (isNaN(n) || n <= 0) {
        res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: `Invalid areaId: ${id}` });
        return;
      }
      parsedAreaIds.push(n);
    }

    const service = await prisma.service.findUnique({ where: { id: parsedServiceId } });
    if (!service) {
      res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Service not found' });
      return;
    }

    // Upsert each coverage row — if it already exists, activate it
    const results = await Promise.all(
      parsedAreaIds.map(areaId =>
        prisma.serviceCoverage.upsert({
          where: { serviceId_areaId: { serviceId: parsedServiceId, areaId } },
          update: { isActive: true },
          create: { serviceId: parsedServiceId, areaId, isActive: true },
        }),
      ),
    );

    logger.info('Admin: ServiceCoverage created/activated', { serviceId: parsedServiceId, areaIds: parsedAreaIds });
    res.status(201).json({ success: true, message: 'Service coverage activated', data: results });
  } catch (error: any) {
    if (error?.code === 'P2003') {
      res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'One or more area IDs not found' });
      return;
    }
    logger.error('Admin: Error creating service coverage', { error });
    res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Failed to create service coverage' });
  }
}

// ─── GET /api/admin/services/:serviceId/coverage ──────────────────────────────
export async function getServiceCoverage(req: Request, res: Response): Promise<void> {
  try {
    const serviceId = parseInt(req.params.serviceId, 10);
    if (isNaN(serviceId) || serviceId <= 0) {
      res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Invalid serviceId' });
      return;
    }

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) {
      res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Service not found' });
      return;
    }

    const coverages = await prisma.serviceCoverage.findMany({
      where: { serviceId, isActive: true },
      include: {
        area: {
          include: { city: { select: { name: true } } },
        },
      },
    });

    res.status(200).json({
      success: true,
      data: {
        serviceId,
        areas: coverages.map(c => ({
          areaId:  c.area.id,
          name:    c.area.name,
          pincode: c.area.pincode,
          city:    c.area.city.name,
        })),
      },
    });
  } catch (error) {
    logger.error('Admin: Error fetching service coverage', { error });
    res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Failed to fetch service coverage' });
  }
}
