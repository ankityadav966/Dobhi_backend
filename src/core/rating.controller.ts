import { Response } from 'express';
import { prisma } from '../prisma.client';
import logger from '../utils/logger';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export const createRating = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { bookingId, rating, review } = req.body;
    const bookingIdNum = parseInt(bookingId, 10);
    const currentUserId = parseInt(req.user.userId, 10);

    const booking = await prisma.booking.findUnique({ where: { id: bookingIdNum } });

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.customerId !== currentUserId) return res.status(403).json({ success: false, message: 'Unauthorized to rate this booking' });
    if (booking.status !== 'COMPLETED') return res.status(400).json({ success: false, message: 'Can only rate completed bookings' });

    const ratingValue = Number(rating);
    if (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be an integer between 1 and 5' });
    }

    if (!booking.helperId) return res.status(400).json({ success: false, message: 'No helper assigned to this booking' });

    const existingRating = await prisma.rating.findUnique({ where: { bookingId: bookingIdNum } });
    if (existingRating) return res.status(400).json({ success: false, message: 'Rating already exists for this booking' });

    const newRating = await prisma.$transaction(async (tx) => {
      const createdRating = await tx.rating.create({
        data: {
          bookingId: bookingIdNum,
          userId: currentUserId,
          helperId: booking.helperId!,
          rating: ratingValue,
          review,
        },
      });

      const ratingStats = await tx.rating.aggregate({
        where: { helperId: booking.helperId! },
        _avg: { rating: true },
        _count: true,
      });

      await tx.helper.update({
        where: { id: booking.helperId! },
        data: {
          rating: parseFloat((ratingStats._avg.rating || 0).toString()),
          totalRatings: ratingStats._count,
        },
      });

      return createdRating;
    });

    return res.status(201).json({ success: true, message: 'Rating created successfully', data: newRating });
  } catch (error) {
    logger.error('Create rating error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create rating' });
  }
};

export const updateRating = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { ratingId } = req.params;
    const ratingIdNum = parseInt(ratingId, 10);
    const currentUserId = parseInt(req.user.userId, 10);
    const { rating, review } = req.body;

    const existingRating = await prisma.rating.findUnique({ where: { id: ratingIdNum } });
    if (!existingRating) return res.status(404).json({ success: false, message: 'Rating not found' });
    if (existingRating.userId !== currentUserId) return res.status(403).json({ success: false, message: 'Unauthorized to update this rating' });

    if (rating !== undefined) {
      const ratingValue = Number(rating);
      if (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) {
        return res.status(400).json({ success: false, message: 'Rating must be an integer between 1 and 5' });
      }
    }

    const updatedRating = await prisma.$transaction(async (tx) => {
      const updated = await tx.rating.update({
        where: { id: ratingIdNum },
        data: {
          ...(rating !== undefined && { rating: Number(rating) }),
          ...(review !== undefined && { review }),
        },
      });

      const ratingStats = await tx.rating.aggregate({
        where: { helperId: updated.helperId },
        _avg: { rating: true },
        _count: true,
      });

      await tx.helper.update({
        where: { id: updated.helperId },
        data: {
          rating: parseFloat((ratingStats._avg.rating || 0).toString()),
          totalRatings: ratingStats._count,
        },
      });

      return updated;
    });

    return res.json({ success: true, message: 'Rating updated successfully', data: updatedRating });
  } catch (error) {
    logger.error('Update rating error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update rating' });
  }
};

export const getHelperRatings = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { helperId, page = 1, limit = 10 } = req.query;
    const pageNum = Number(page);
    const limitNum = Number(limit);

    if (!Number.isInteger(pageNum) || pageNum < 1) return res.status(400).json({ success: false, message: 'page must be a positive integer' });
    if (!Number.isInteger(limitNum) || limitNum < 1 || limitNum > 50) return res.status(400).json({ success: false, message: 'limit must be a positive integer between 1 and 50' });

    const helperIdNum = parseInt(helperId as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const ratings = await prisma.rating.findMany({
      where: { helperId: helperIdNum },
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, fullName: true } },
        booking: { include: { service: { select: { name: true } } } },
      },
    });

    const total = await prisma.rating.count({ where: { helperId: helperIdNum } });

    const helper = await prisma.helper.findUnique({
      where: { id: helperIdNum },
      select: { rating: true, totalRatings: true },
    });

    return res.json({
      success: true,
      data: { ratings, summary: helper },
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    logger.error('Get helper ratings error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch helper ratings' });
  }
};

export const deleteRating = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { ratingId } = req.params;
    const ratingIdNum = parseInt(ratingId, 10);
    const currentUserId = parseInt(req.user.userId, 10);

    const rating = await prisma.rating.findUnique({ where: { id: ratingIdNum } });
    if (!rating) return res.status(404).json({ success: false, message: 'Rating not found' });
    if (rating.userId !== currentUserId) return res.status(403).json({ success: false, message: 'Unauthorized to delete this rating' });

    await prisma.$transaction(async (tx) => {
      await tx.rating.delete({ where: { id: ratingIdNum } });

      const ratingStats = await tx.rating.aggregate({
        where: { helperId: rating.helperId },
        _avg: { rating: true },
        _count: true,
      });

      await tx.helper.update({
        where: { id: rating.helperId },
        data: {
          rating: parseFloat((ratingStats._avg.rating || 0).toString()),
          totalRatings: ratingStats._count,
        },
      });
    });

    return res.json({ success: true, message: 'Rating deleted successfully' });
  } catch (error) {
    logger.error('Delete rating error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete rating' });
  }
};

export const getRatingStats = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { helperId } = req.query;
    const helperIdNum = parseInt(helperId as string, 10);

    const ratingStats = await prisma.rating.aggregate({
      where: { helperId: helperIdNum },
      _avg: { rating: true },
      _count: true,
    });

    const distribution = await prisma.rating.groupBy({
      by: ['rating'],
      where: { helperId: helperIdNum },
      _count: true,
    });

    const distributionMap: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    distribution.forEach((item) => {
      distributionMap[item.rating] = item._count;
    });

    return res.json({
      success: true,
      data: { total: ratingStats._count, average: ratingStats._avg.rating || 0, distribution: distributionMap },
    });
  } catch (error) {
    logger.error('Get rating stats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch rating stats' });
  }
};

export const getServiceRatings = async (req: AuthenticatedRequest, res: Response): Promise<any> => {
  try {
    const { serviceId, page = 1, limit = 10 } = req.query;
    const pageNum = Number(page);
    const limitNum = Number(limit);

    if (!Number.isInteger(pageNum) || pageNum < 1) return res.status(400).json({ success: false, message: 'page must be a positive integer' });
    if (!Number.isInteger(limitNum) || limitNum < 1 || limitNum > 50) return res.status(400).json({ success: false, message: 'limit must be a positive integer between 1 and 50' });

    const serviceIdNum = parseInt(serviceId as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const ratings = await prisma.rating.findMany({
      where: { booking: { serviceId: serviceIdNum } },
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, fullName: true } },
      },
    });

    const total = await prisma.rating.count({ where: { booking: { serviceId: serviceIdNum } } });

    return res.json({
      success: true,
      data: ratings,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    logger.error('Get service ratings error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch ratings' });
  }
};
