import { Response } from 'express';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';

export const getUserProfile = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const userIdNum = parseInt(req.user.userId, 10);
    const user = await prisma.user.findUnique({
      where: { id: userIdNum },
      select: {
        id: true,
        phone: true,
        fullName: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        helper: {
          select: {
            id: true,
            isAvailable: true,
            isOnline: true,
            rating: true,
            onboardingStatus: true,
            profile: { select: { latitude: true, longitude: true, city: true, workType: true } },
          },
        },
      },
    });

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    return res.json({ success: true, data: user });
  } catch (error) {
    logger.error('Get profile error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
};

export const updateUserProfile = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const userIdNum = parseInt(req.user.userId, 10);
    const { fullName } = req.body;

    const data: any = {};

    if (fullName !== undefined) data.fullName = fullName;

    const user = await prisma.user.update({
      where: { id: userIdNum },
      data,
      select: {
        id: true,
        phone: true,
        fullName: true,
        avatar: true,
      },
    });

    return res.json({ success: true, message: 'Profile updated successfully', data: user });
  } catch (error) {
    logger.error('Update profile error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
};

export const uploadProfilePhoto = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const userIdNum = parseInt(req.user.userId, 10);
    const photoUrl = `/uploads/${req.file.filename}`;

    const user = await prisma.user.update({
      where: { id: userIdNum },
      data: { avatar: photoUrl },
      select: { id: true, avatar: true },
    });

    return res.json({ success: true, message: 'Profile photo uploaded successfully', data: user });
  } catch (error) {
    logger.error('Upload profile photo error:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload profile photo' });
  }
};

export const getHelperDetails = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { helperId } = req.params;
    const helperIdNum = parseInt(helperId, 10);
    if (isNaN(helperIdNum)) {
      return res.status(400).json({ success: false, message: 'Invalid helper ID' });
    }

    const [helper, completedBookingsCount] = await Promise.all([
      prisma.helper.findUnique({
        where: { id: helperIdNum },
        select: {
          id: true,
          rating: true,
          totalRatings: true,
          isAvailable: true,
          isOnline: true,
          user: { select: { fullName: true } },
          kyc: { select: { panNameFromApi: true } },
          profile: { select: { experienceYears: true, city: true, workType: true } },
          helperServices: {
            select: {
              service: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.booking.count({
        where: { helperId: helperIdNum, status: 'COMPLETED' },
      }),
    ]);

    if (!helper) return res.status(404).json({ success: false, message: 'Helper not found' });

    const { user, kyc, ...helperData } = helper;
    const fullName = user.fullName?.trim() || kyc?.panNameFromApi || '';

    return res.json({
      success: true,
      data: { ...helperData, fullName, completedBookingsCount },
    });
  } catch (error) {
    logger.error('Get helper details error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch helper details' });
  }
};

export const searchHelpers = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { category, rating, page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    let limitNum = Math.min(50, Math.max(1, Number(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { isAvailable: true };

    if (rating) {
      const minRating = Number(rating);
      if (!isNaN(minRating) && minRating > 0) {
        where.rating = { gte: minRating };
      }
    }

    const [helpers, total] = await Promise.all([
      prisma.helper.findMany({
        where,
        skip,
        take: limitNum,
        select: {
          id: true,
          rating: true,
          totalRatings: true,
          isAvailable: true,
          isOnline: true,
          lastActiveAt: true,
          user: { select: { fullName: true } },
          profile: { select: { city: true, workType: true } },
          helperServices: {
            select: { service: { select: { id: true, name: true } } },
          },
        },
      }),
      prisma.helper.count({ where }),
    ]);

    const ONLINE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    const mappedHelpers = helpers.map(({ user, lastActiveAt, isOnline, ...h }) => ({
      ...h,
      fullName: user.fullName?.trim() || '',
      isOnline: isOnline && !!lastActiveAt && (now - lastActiveAt.getTime()) < ONLINE_TIMEOUT_MS,
    }));

    return res.json({
      success: true,
      data: mappedHelpers,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    logger.error('Search helpers error:', error);
    return res.status(500).json({ success: false, error: 'Failed to search helpers' });
  }
};

export const getMyBookings = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const userIdNum = parseInt(req.user.userId, 10);
    const { page = 1, limit = 10, status } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(50, Math.max(1, Number(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { customerId: userIdNum };
    if (status) where.status = status as string;

    const bookings = await prisma.booking.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        service: { select: { id: true, name: true } },
        helper: { select: { id: true, rating: true, user: { select: { fullName: true } } } },
        payment: true,
      },
    });

    const total = await prisma.booking.count({ where });

    return res.json({
      success: true,
      data: bookings,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    logger.error('Get my bookings error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
};

export const registerAsHelper = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const userIdNum = parseInt(req.user.userId, 10);
    const { fullName } = req.body;

    if (!fullName) {
      return res.status(400).json({ success: false, error: 'fullName is required' });
    }

    const updateData: any = { fullName };

    const user = await prisma.user.update({
      where: { id: userIdNum },
      data: updateData,
      select: { id: true, phone: true, role: true },
    });

    return res.json({ success: true, message: 'Helper application submitted successfully.', data: user });
  } catch (error) {
    logger.error('Register helper error:', error);
    return res.status(500).json({ success: false, error: 'Failed to register as helper' });
  }
};

export const updateBankDetails = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  // Bank details are stored in a separate integration - not in User model
  return res.status(501).json({ success: false, message: 'Bank details management not implemented in current schema' });
};

export const uploadKYCDocuments = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  // KYC documents are handled via PAN verification service
  return res.status(501).json({ success: false, message: 'KYC document upload handled via PAN verification endpoint' });
};
