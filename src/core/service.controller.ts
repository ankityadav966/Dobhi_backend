import { Response } from 'express';
import { BookingStatus, UserRole } from '@prisma/client';
import { prisma } from '../prisma.client';
import logger from '../utils/logger';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export const createService = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const userIdNum = parseInt(req.user.userId, 10);

    // Check if user is a helper
    const user = await prisma.user.findUnique({ where: { id: userIdNum } });
    if (user?.role !== UserRole.HELPER) {
      return res.status(403).json({ success: false, message: 'Only helpers can create services' });
    }

    const { category, title, description, hourlyRate, minimumHours, maximumHours } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'title (service name) is required' });
    }

    const serviceName = String(title).trim();
    if (!serviceName) {
      return res.status(400).json({ success: false, message: 'title must not be empty' });
    }

    // Find helper record for this user
    const helper = await prisma.helper.findUnique({ where: { userId: userIdNum } });
    if (!helper) {
      return res.status(403).json({ success: false, message: 'Helper profile not found' });
    }

    const service = await prisma.service.create({
      data: {
        name: serviceName,
      },
    });

    // Link helper to service via join table
    await prisma.helperService.upsert({
      where: { helperId_serviceId: { helperId: helper.id, serviceId: service.id } },
      update: {},
      create: { helperId: helper.id, serviceId: service.id },
    });

    res.status(201).json({ success: true, message: 'Service created successfully', data: service });
  } catch (error) {
    logger.error('Create service error:', error);
    res.status(500).json({ success: false, message: 'Failed to create service' });
  }
};

export const updateService = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { serviceId } = req.params;
    const { name, isActive } = req.body;

    const serviceIdNum = parseInt(serviceId, 10);
    if (isNaN(serviceIdNum)) {
      return res.status(400).json({ success: false, message: 'Invalid service ID' });
    }

    const userIdNum = parseInt(req.user.userId, 10);
    const helper = await prisma.helper.findUnique({ where: { userId: userIdNum }, select: { id: true } });
    const ownership = helper
      ? await prisma.helperService.findUnique({ where: { helperId_serviceId: { helperId: helper.id, serviceId: serviceIdNum } } })
      : null;

    if (!helper || !ownership) {
      return res.status(403).json({ success: false, message: 'Unauthorized to update this service' });
    }

    const existingService = await prisma.service.findUnique({ where: { id: serviceIdNum }, select: { id: true } });

    const updatedService = await prisma.service.update({
      where: { id: serviceIdNum },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });

    res.json({ success: true, message: 'Service updated successfully', data: updatedService });
  } catch (error) {
    logger.error('Update service error:', error);
    res.status(500).json({ success: false, message: 'Failed to update service' });
  }
};

export const getServiceById = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { serviceId } = req.params;
    const serviceIdNum = parseInt(serviceId, 10);
    if (isNaN(serviceIdNum)) {
      return res.status(400).json({ success: false, message: 'Invalid service ID' });
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceIdNum },
      include: {
        helpers: {
          select: { helper: { select: { id: true, rating: true, totalRatings: true, user: { select: { fullName: true } } } } },
        },
      },
    });

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    res.json({ success: true, data: service });
  } catch (error) {
    logger.error('Get service error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch service' });
  }
};

export const listServices = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { pincode } = req.query;

    // Build the base `where` clause — always restrict to active services
    let serviceWhere: Record<string, any> = { isActive: true };

    if (pincode && typeof pincode === 'string' && pincode.trim()) {
      const area = await prisma.area.findFirst({
        where: { pincode: pincode.trim() },
        select: { id: true },
      });

      if (!area) {
        return res.json({ success: true, data: [] });
      }

      serviceWhere = {
        isActive: true,
        coverages: {
          some: { areaId: area.id, isActive: true },
        },
      };
    }

    const services = await prisma.service.findMany({
      where: serviceWhere,
      orderBy: { createdAt: 'desc' },
      include: {
        plans: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          select: {
            name:          true,
            price:         true,
            durationValue: true,
            durationUnit:  true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: services.map(s => ({
        id:       s.id,
        name:     s.name,
        imageUrl: (s as any).imageUrl ?? null,
        plans:    s.plans.map(p => ({
          name:          p.name,
          price:         Math.round(p.price / 100),
          durationValue: p.durationValue,
          durationUnit:  p.durationUnit,
        })),
      })),
    });
  } catch (error) {
    logger.error('List services error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch services' });
  }
};

export const getHelperServices = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { helperId } = req.params;
    const helperIdNum = parseInt(helperId, 10);
    if (isNaN(helperIdNum)) {
      return res.status(400).json({ success: false, message: 'Invalid helper ID' });
    }

    const services = await prisma.helperService.findMany({
      where: { helperId: helperIdNum },
      select: { service: true },
    });
    res.json({ success: true, data: services.map(hs => hs.service) });
  } catch (error) {
    logger.error('Get helper services error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch helper services' });
  }
};

export const deleteService = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { serviceId } = req.params;
    const serviceIdNum = parseInt(serviceId, 10);
    if (isNaN(serviceIdNum)) {
      return res.status(400).json({ success: false, message: 'Invalid service ID' });
    }

    const userIdNum = parseInt(req.user.userId, 10);
    const helperForDelete = await prisma.helper.findUnique({ where: { userId: userIdNum }, select: { id: true } });
    const ownershipCheck = helperForDelete
      ? await prisma.helperService.findUnique({ where: { helperId_serviceId: { helperId: helperForDelete.id, serviceId: serviceIdNum } } })
      : null;

    if (!helperForDelete || !ownershipCheck) {
      return res.status(403).json({ success: false, message: 'Unauthorized to delete this service' });
    }

    const activeBookings = await prisma.booking.findMany({
      where: {
        serviceId: serviceIdNum,
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] },
      },
      select: { id: true },
    });

    if (activeBookings.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete service with active bookings. Please complete or cancel all active bookings first.',
      });
    }

    await prisma.service.delete({ where: { id: serviceIdNum } });
    res.json({ success: true, message: 'Service deleted successfully' });
  } catch (error) {
    logger.error('Delete service error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete service' });
  }
};
