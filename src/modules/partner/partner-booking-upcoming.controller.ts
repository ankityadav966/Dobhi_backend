/**
 * partner-booking-upcoming.controller.ts
 *
 * GET /api/partner/bookings/upcoming
 * Fetch upcoming bookings for authenticated helper with filters and formatting.
 * 
 * Query Parameters:
 *   ?day=today|tomorrow|week
 *   ?serviceType=MAID|COOK|etc (filters by service.name)
 *   ?page=1&limit=10
 */
import { Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { getUpcomingHelperBookings } from '../../core/booking.service.upcoming';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';

/**
 * Format booking response for UI with all required fields
 * Service already provides dayLabel and timeLabel in IST
 */
function formatBookingForUI(booking: any) {
  // Debug: warn if names are missing (but don't discard)
  if (!booking.customerName || !booking.serviceName) {
    logger.warn('Booking missing name fields', { bookingId: booking.bookingId });
  }

  // Helper info (null if not assigned or no rating)
  const helperRating = booking.helperRating;
  const helperName = booking.helperRating !== null ? 'Helper Assigned' : null; // Placeholder since we don't have full helper name in service response

  // Duration info
  const duration = booking.duration || 0;
  const durationLabel = `${duration} hours`;

  // Amount formatting
  const finalAmount = booking.finalAmount || 0;
  const amountLabel = `₹${finalAmount.toLocaleString('en-IN')}`;

  return {
    bookingId: booking.bookingId,
    customerName: booking.customerName || 'Customer',
    serviceName: booking.serviceName || 'Service',
    serviceType: booking.serviceName?.toUpperCase() || 'UNKNOWN',

    helperName,
    helperRating,

    bookingDate: booking.bookingDate,
    startTime: booking.startTime,
    endTime: booking.endTime,

    dayLabel: booking.dayLabel,
    timeLabel: booking.timeLabel,

    duration,
    durationLabel,

    address: booking.address || '',
    latitude: booking.latitude,
    longitude: booking.longitude,

    finalAmount,
    amountLabel,

    jobStatus: 'UPCOMING',
  };
}

export const getUpcomingHelperBookingsHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // ✅ CRITICAL: Map userId → Helper → Bookings
    // NEVER compare helperId with userId directly
    const userId = parseInt(req.user.userId, 10);
    const helper = await prisma.helper.findUnique({
      where: { userId },
      select: { id: true, isAvailable: true },
    });

    if (!helper) {
      logger.warn('Helper not found for this user', { userId });
      return res.status(403).json({
        success: false,
        message: 'Helper profile not found. Please complete onboarding.',
      });
    }

    if (!helper.isAvailable) {
      logger.warn('Helper is not available', { helperId: helper.id, userId });
      return res.status(403).json({
        success: false,
        message: 'Helper is currently unavailable. Please update your availability status.',
      });
    }

    const helperId = helper.id;
    const { day, serviceType, page = 1, limit = 10 } = req.query;
    
    // Parse and validate pagination
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 10));

    // If serviceType is provided, look up the service ID
    let serviceIdNum: number | undefined;
    if (serviceType) {
      const helperService = await prisma.helperService.findFirst({
        where: {
          helper: {
            id: Number(helperId),
          },
          service: {
            name: {
              equals: String(serviceType).trim(),
              mode: 'insensitive',
            },
          },
        },
        select: { serviceId: true },
      });

      if (!helperService) {
        logger.warn('Service not found for helper', { helperId, serviceType });
        // Return empty list instead of error
        return res.json({
          success: true,
          data: [],
          pagination: { page: pageNum, limit: limitNum, total: 0 },
          totalUpcomingJobs: 0,
          todayJobsCount: 0,
        });
      }
      serviceIdNum = helperService.serviceId;
    }

    logger.info('Fetching upcoming bookings', {
      helperId,
      day: day as string,
      serviceType,
      serviceId: serviceIdNum,
      page: pageNum,
      limit: limitNum,
    });

    // Get raw bookings from service (already formatted with dayLabel, timeLabel in IST)
    const result = await getUpcomingHelperBookings(helperId, {
      day: day as string | undefined,
      serviceId: serviceIdNum,
      page: pageNum,
      limit: limitNum,
    });

    // Format bookings for UI with additional fields
    const formattedData = result.data.map(formatBookingForUI)

    logger.info('Bookings formatted successfully', {
      count: formattedData.length,
      total: result.pagination.total,
    });

    return res.json({
      success: true,
      data: formattedData,
      pagination: result.pagination,
      totalUpcomingJobs: result.totalUpcomingJobs,
      todayJobsCount: result.todayJobsCount,
    });
  } catch (error) {
    logger.error('Error fetching upcoming bookings', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming bookings',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
};
