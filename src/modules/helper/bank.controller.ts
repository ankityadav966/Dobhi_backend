import { Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { body, validationResult } from 'express-validator';
import { getBankDetails, upsertBankDetails } from './bank.service';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';

export const validateBankDetails = [
  body('accountHolderName').isString().trim().notEmpty().withMessage('accountHolderName is required'),
  body('accountNumber').isString().trim().notEmpty().withMessage('accountNumber is required'),
  body('ifscCode').isString().trim().notEmpty().withMessage('ifscCode is required'),
  body('bankName').isString().trim().notEmpty().withMessage('bankName is required'),
  body('branchName').optional().isString().trim().withMessage('branchName must be a string'),
];

export async function getBankHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const userIdNum = parseInt(userId, 10);

    const helper = await prisma.helper.findUnique({
      where: { userId: userIdNum },
    });

    if (!helper) {
      res.status(404).json({ success: false, message: 'Helper not found' });
      return;
    }

    const bankDetails = await getBankDetails(helper.id);

    if (!bankDetails) {
      res.status(404).json({ success: false, message: 'Bank details not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: bankDetails,
    });
  } catch (error) {
    logger.error('Error fetching bank details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bank details' });
  }
}

export async function updateBankHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ success: false, message: 'Validation failed', errors: errors.array() });
      return;
    }

    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const userIdNum = parseInt(userId, 10);

    const helper = await prisma.helper.findUnique({
      where: { userId: userIdNum },
    });

    if (!helper) {
      res.status(404).json({ success: false, message: 'Helper not found' });
      return;
    }

    const { accountHolderName, accountNumber, ifscCode, bankName, branchName } = req.body;

    // Validate account number format (basic validation)
    if (!/^\d{9,18}$/.test(accountNumber)) {
      res.status(400).json({ success: false, message: 'Invalid account number format' });
      return;
    }

    const updatedBankDetails = await upsertBankDetails(helper.id, {
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      branchName,
    });

    res.status(200).json({
      success: true,
      data: updatedBankDetails,
    });
  } catch (error) {
    logger.error('Error updating bank details:', error);
    res.status(500).json({ success: false, message: 'Failed to update bank details' });
  }
}
