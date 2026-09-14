/**
 * address.controller.ts
 *
 * Allows an authenticated helper to view and update their service address
 * stored in HelperProfile. Upserts HelperProfile if it doesn't exist yet.
 *
 * Routes:
 *   GET /api/partner/address
 *   PUT /api/partner/address
 */

import { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';

// ─── Validation chain ────────────────────────────────────────────────────────

export const validateUpdatePartnerAddress = [
  body('address').notEmpty().withMessage('address is required'),
  body('city').notEmpty().withMessage('city is required'),
  body('pinCode')
    .notEmpty().withMessage('pinCode is required')
    .isLength({ max: 10 }).withMessage('pinCode must be at most 10 characters'),
  body('latitude').optional().isFloat().withMessage('latitude must be a number'),
  body('longitude').optional().isFloat().withMessage('longitude must be a number'),
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

// ─── GET /api/partner/address ─────────────────────────────────────────────────

export async function getPartnerAddressHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const helper = await resolveHelper(req, res);
    if (!helper) return;

    const profile = await prisma.helperProfile.findUnique({
      where:  { helperId: helper.id },
      select: { address: true, city: true, pinCode: true, latitude: true, longitude: true },
    });

    res.status(200).json({
      success: true,
      data: {
        address:   profile?.address   ?? null,
        city:      profile?.city      ?? null,
        pinCode:   profile?.pinCode   ?? null,
        latitude:  profile?.latitude  ?? null,
        longitude: profile?.longitude ?? null,
      },
    });
  } catch (err) {
    logger.error('getPartnerAddressHandler error', { err });
    res.status(500).json({ success: false, message: 'Failed to fetch address' });
  }
}

// ─── PUT /api/partner/address ─────────────────────────────────────────────────

export async function updatePartnerAddressHandler(
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

    const { address, city, pinCode, latitude, longitude } = req.body as {
      address:    string;
      city:       string;
      pinCode:    string;
      latitude?:  number;
      longitude?: number;
    };

    await prisma.helperProfile.upsert({
      where:  { helperId: helper.id },
      update: { address, city, pinCode, latitude, longitude },
      create: { helperId: helper.id, address, city, pinCode, latitude, longitude },
    });

    logger.info('Partner address updated', { helperId: helper.id });

    res.status(200).json({ success: true, message: 'Partner address updated successfully' });
  } catch (err) {
    logger.error('updatePartnerAddressHandler error', { err });
    res.status(500).json({ success: false, message: 'Failed to update address' });
  }
}
