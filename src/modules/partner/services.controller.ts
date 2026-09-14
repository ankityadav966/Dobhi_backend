/**
 * services.controller.ts
 *
 * Allows an authenticated helper to view and replace their offered services.
 * Uses the HelperService join table. PUT is a full replace via transaction.
 *
 * Routes:
 *   GET /api/partner/services
 *   PUT /api/partner/services
 */

import { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';

// ─── Validation chain ────────────────────────────────────────────────────────

export const validateUpdatePartnerServices = [
  body('serviceIds')
    .isArray({ min: 1 })
    .withMessage('serviceIds must be a non-empty array'),
  body('serviceIds.*')
    .isInt({ min: 1 })
    .withMessage('each serviceId must be a positive integer'),
];

// ─── Shared helper resolver ───────────────────────────────────────────────────

async function resolveHelper(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return null;
  }

  const userId = parseInt(req.user.userId, 10);

  const helper = await prisma.helper.findUnique({
    where:  { userId },
    select: { id: true },
  });

  if (!helper) {
    res.status(403).json({ success: false, message: 'Helper profile not found' });
    return null;
  }

  return helper;
}

// ─── GET /api/partner/services ────────────────────────────────────────────────

export async function getPartnerServicesHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const helper = await resolveHelper(req, res);
    if (!helper) return;

    const services = await prisma.helperService.findMany({
      where:   { helperId: helper.id },
      include: {
        service: {
          select: { id: true, name: true },
        },
      },
    });

    const data = services.map((s) => ({
      serviceId: s.service.id,
      name:      s.service.name,
    }));

    logger.info('Fetched partner services', { helperId: helper.id, count: data.length });

    res.status(200).json({ success: true, data });
  } catch (err) {
    logger.error('getPartnerServicesHandler error', { err });
    res.status(500).json({ success: false, message: 'Failed to fetch services' });
  }
}

// ─── PUT /api/partner/services ────────────────────────────────────────────────

export async function updatePartnerServicesHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const helper = await resolveHelper(req, res);
    if (!helper) return;

    const { serviceIds } = req.body as { serviceIds: number[] };

    await prisma.$transaction(async (tx) => {
      await tx.helperService.deleteMany({
        where: { helperId: helper.id },
      });

      await tx.helperService.createMany({
        data: serviceIds.map((serviceId) => ({
          helperId: helper.id,
          serviceId,
        })),
      });
    });

    logger.info('Partner services updated', { helperId: helper.id, serviceIds });

    res.status(200).json({ success: true, message: 'Services updated successfully' });
  } catch (err) {
    logger.error('updatePartnerServicesHandler error', { err });
    res.status(500).json({ success: false, message: 'Failed to update services' });
  }
}
