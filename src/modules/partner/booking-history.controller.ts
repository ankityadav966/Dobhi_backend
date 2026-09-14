import { Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { getBookingHistory } from './booking-history.service';
import logger from '../../utils/logger';

export const getBookingHistoryHandler = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const bookings = await getBookingHistory(userId);

    res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    logger.error('Error fetching booking history:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch booking history' });
  }
};
