import { Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { body, validationResult } from 'express-validator';
import { getPartnerProfile, updatePartnerProfile } from './profile.service';
import logger from '../../utils/logger';

export const validateUpdateProfile = [
  body('fullName').optional().isString().trim().notEmpty().withMessage('fullName must be a string'),
  body('gender').optional().isString().trim().withMessage('gender must be a string'),
  body('experience').optional().isInt({ min: 0 }).withMessage('experience must be a non-negative integer'),
  body('bio').optional().isString().trim().withMessage('bio must be a string'),
  body('address').optional().isString().trim().withMessage('address must be a string'),
  body('city').optional().isString().trim().withMessage('city must be a string'),
  body('pinCode').optional().isString().trim().withMessage('pinCode must be a string'),
  body('latitude').optional().isFloat().withMessage('latitude must be a number'),
  body('longitude').optional().isFloat().withMessage('longitude must be a number'),
];

export async function getProfileHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const profile = await getPartnerProfile(userId);
    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    logger.error('Error fetching profile:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
}

export async function updateProfileHandler(
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

    const { fullName, gender, experience, bio, address, city, pinCode, latitude, longitude } = req.body;

    const updatedProfile = await updatePartnerProfile(userId, {
      fullName,
      gender,
      experience,
      bio,
      address,
      city,
      pinCode,
      latitude,
      longitude,
    });

    res.status(200).json({
      success: true,
      data: updatedProfile,
    });
  } catch (error) {
    logger.error('Error updating profile:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
}
