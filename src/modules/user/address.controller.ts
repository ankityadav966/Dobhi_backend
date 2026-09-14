/**
 * address.controller.ts
 *
 * Multi-address CRUD for authenticated users.
 *
 * Routes:
 *   GET    /api/user/addresses            — list all addresses
 *   POST   /api/user/addresses            — create a new address
 *   PUT    /api/user/addresses/:addressId — update an address
 *   DELETE /api/user/addresses/:addressId — delete an address
 */

import { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';

// ─── Validation chains ───────────────────────────────────────────────────────

export const validateAddress = [
  body('address').notEmpty().withMessage('address is required'),
  body('city').notEmpty().withMessage('city is required'),
  body('pinCode')
    .notEmpty().withMessage('pinCode is required')
    .isLength({ max: 10 }).withMessage('pinCode must be at most 10 characters'),
  body('latitude').isFloat().withMessage('latitude must be a number'),
  body('longitude').isFloat().withMessage('longitude must be a number'),
  body('label').optional().isString(),
  body('isDefault').optional().isBoolean(),
];

export const validateUpdateAddress = [
  body('address').optional().notEmpty().withMessage('address cannot be blank'),
  body('city').optional().notEmpty().withMessage('city cannot be blank'),
  body('pinCode').optional().isLength({ max: 10 }).withMessage('pinCode must be at most 10 characters'),
  body('latitude').optional().isFloat().withMessage('latitude must be a number'),
  body('longitude').optional().isFloat().withMessage('longitude must be a number'),
  body('label').optional().isString(),
  body('isDefault').optional().isBoolean(),
];

// ─── GET /api/user/addresses ─────────────────────────────────────────────────

export async function getUserAddresses(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const userId = parseInt(req.user.userId, 10);
    const addresses = await prisma.userAddress.findMany({
      where:   { userId },
      orderBy: { createdAt: 'asc' },
    });

    res.status(200).json({ success: true, data: addresses });
  } catch (err) {
    logger.error('getUserAddresses error', { err });
    res.status(500).json({ success: false, message: 'Failed to fetch addresses' });
  }
}

// ─── POST /api/user/addresses ────────────────────────────────────────────────

export async function createUserAddress(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ success: false, errors: errors.array() }); return; }

    const userId = parseInt(req.user.userId, 10);
    const { address, city, pinCode, latitude, longitude, label, isDefault } = req.body as {
      address:   string;
      city:      string;
      pinCode:   string;
      latitude:  number;
      longitude: number;
      label?:    string;
      isDefault?: boolean;
    };

    let created;
    if (isDefault) {
      [, created] = await prisma.$transaction([
        prisma.userAddress.updateMany({ where: { userId }, data: { isDefault: false } }),
        prisma.userAddress.create({
          data: { userId, address, city, pinCode, latitude, longitude, label, isDefault: true },
        }),
      ]);
    } else {
      const count = await prisma.userAddress.count({ where: { userId } });
      created = await prisma.userAddress.create({
        data: { userId, address, city, pinCode, latitude, longitude, label, isDefault: count === 0 },
      });
    }

    logger.info('User address created', { userId, addressId: created.id });
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    logger.error('createUserAddress error', { err });
    res.status(500).json({ success: false, message: 'Failed to create address' });
  }
}

// ─── PUT /api/user/addresses/:addressId ──────────────────────────────────────

export async function updateUserAddress(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ success: false, errors: errors.array() }); return; }

    const addressId = parseInt(req.params.addressId, 10);
    if (isNaN(addressId)) { res.status(400).json({ success: false, message: 'Invalid addressId' }); return; }

    const userId = parseInt(req.user.userId, 10);
    const existing = await prisma.userAddress.findFirst({ where: { id: addressId, userId } });
    if (!existing) { res.status(403).json({ success: false, message: 'Address not found' }); return; }

    const { address, city, pinCode, latitude, longitude, label, isDefault } = req.body as {
      address?:   string;
      city?:      string;
      pinCode?:   string;
      latitude?:  number;
      longitude?: number;
      label?:     string;
      isDefault?: boolean;
    };

    let updated;
    if (isDefault) {
      [, updated] = await prisma.$transaction([
        prisma.userAddress.updateMany({ where: { userId }, data: { isDefault: false } }),
        prisma.userAddress.update({
          where: { id: addressId },
          data:  { address, city, pinCode, latitude, longitude, label, isDefault: true },
        }),
      ]);
    } else {
      updated = await prisma.userAddress.update({
        where: { id: addressId },
        data:  { address, city, pinCode, latitude, longitude, label, isDefault },
      });
    }

    logger.info('User address updated', { userId, addressId });
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    logger.error('updateUserAddress error', { err });
    res.status(500).json({ success: false, message: 'Failed to update address' });
  }
}

// ─── DELETE /api/user/addresses/:addressId ────────────────────────────────────

export async function deleteUserAddress(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const addressId = parseInt(req.params.addressId, 10);
    if (isNaN(addressId)) { res.status(400).json({ success: false, message: 'Invalid addressId' }); return; }

    const userId = parseInt(req.user.userId, 10);
    const existing = await prisma.userAddress.findFirst({ where: { id: addressId, userId } });
    if (!existing) { res.status(403).json({ success: false, message: 'Address not found' }); return; }

    await prisma.userAddress.delete({ where: { id: addressId } });

    // If this was the default, promote the oldest remaining address
    if (existing.isDefault) {
      const next = await prisma.userAddress.findFirst({
        where:   { userId },
        orderBy: { createdAt: 'asc' },
      });
      if (next) {
        await prisma.userAddress.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }

    logger.info('User address deleted', { userId, addressId });
    res.status(200).json({ success: true, message: 'Address deleted successfully' });
  } catch (err) {
    logger.error('deleteUserAddress error', { err });
    res.status(500).json({ success: false, message: 'Failed to delete address' });
  }
}
