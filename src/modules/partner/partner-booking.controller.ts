/**
 * partner-booking.controller.ts
 *
 * Handles req/res for helper booking operations.
 * All business logic lives in src/core/booking.service.ts.
 */
import { Response } from 'express';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import {
  getBookingById,
  getHelperBookings,
  BookingServiceError,
} from '../../core/booking.service';
import { verifyStartOtp, regenerateOtpForBooking, completeBooking } from '../../services/booking-lifecycle.service';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Transform booking detail with UI-friendly fields.
 * Adds formatted date/time, combined address, and rating fallback.
 * Does NOT modify existing booking fields.
 *
 * CRITICAL: Duration is already in hours. Use dayjs.utc() for proper UTC→IST conversion.
 */
function formatBookingDetail(booking: any) {
  // Duration is already in hours from DB — do NOT convert from minutes
  const durationText = booking.duration === 1 ? 'hour' : 'hours';
  const formattedTime = booking.startTime
    ? `${dayjs.utc(booking.startTime).tz('Asia/Kolkata').format('hh:mm A')} • ${booking.duration} ${durationText}`
    : 'N/A';

  const fullAddress = [booking.address, booking.city]
    .filter(Boolean)
    .join(', ');

  const ratingValue = booking.rating?.rating ?? booking.helper?.rating ?? 0;

  return {
    ...booking,
    formattedDate: booking.startTime
      ? dayjs.utc(booking.startTime).tz('Asia/Kolkata').format('dddd, MMMM D, YYYY')
      : 'N/A',
    formattedTime,
    fullAddress: fullAddress || 'N/A',
    serviceDisplayName: booking.service?.name ? `${booking.service.name} Service` : 'Service',
    rating: ratingValue,
  };
}

/**
 * GET /api/partner/bookings/:bookingId
 * Helper can view a booking they are assigned to.
 */
export const getBookingByIdHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const bookingId = parseInt(req.params.bookingId, 10);
    const booking = await getBookingById(bookingId);

    // IDOR guard: only the booking's customer, assigned helper, or an ADMIN may read it
    const requesterId = parseInt(req.user.userId, 10);
    if (
      booking.customerId !== requesterId &&
      booking.helper?.userId !== requesterId &&
      req.user.role !== 'ADMIN'
    ) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const formattedBooking = formatBookingDetail(booking);
    return res.json({ success: true, data: formattedBooking });
  } catch (error) {
    if (error instanceof BookingServiceError) {
      return res.status(error.httpStatus).json({ success: false, message: error.message });
    }
    logger.error('partner getBookingByIdHandler error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch booking' });
  }
};

/**
 * POST /api/partner/bookings/:bookingId/start
 * Helper submits OTP to transition the booking from CONFIRMED → IN_PROGRESS.
 *
 * Body: { otp: string }  — 4-digit numeric string
 *
 * Errors:
 *  400 — invalid OTP format, wrong OTP, expired OTP, max attempts reached, wrong status
 *  403 — helper is not assigned to this booking
 *  404 — booking not found
 */
export const startBookingWithOtpHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const bookingId = parseInt(req.params.bookingId, 10);
    const { otp }   = req.body;

    if (!otp || typeof otp !== 'string' || !/^\d{4}$/.test(otp)) {
      return res.status(400).json({ success: false, message: 'OTP must be a 4-digit numeric string' });
    }

    const helper = await prisma.helper.findUnique({
      where: { userId: parseInt(req.user.userId, 10) },
      select: { id: true },
    });
    if (!helper) {
      return res.status(403).json({ success: false, message: 'Helper profile not found' });
    }

    const result = await verifyStartOtp(bookingId, helper.id, otp);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start booking';
    logger.error('startBookingWithOtpHandler: Error', { bookingId: req.params.bookingId, error: message });

    const httpStatus =
      message.includes('Not authorized')                  ? 403 :
      message.includes('not found')                       ? 404 :
      message.includes('Booking must be CONFIRMED')       ||
      message.includes('not been generated')              ||
      message.includes('Maximum attempts')                ||
      message.includes('Incorrect OTP')                   ||
      message.includes('expired')                         ||
      message.includes('changed during')                  ? 400 :
      500;

    return res.status(httpStatus).json({ success: false, message });
  }
};

/**
 * POST /api/partner/bookings/:bookingId/regenerate-otp
 * Regenerate a fresh 4-digit start OTP for a CONFIRMED booking.
 * Only called when the previous OTP has expired (> 30 min).
 */
export const regenerateOtpHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const bookingId = parseInt(req.params.bookingId, 10);

    const helper = await prisma.helper.findUnique({
      where: { userId: parseInt(req.user.userId, 10) },
      select: { id: true },
    });
    if (!helper) {
      return res.status(403).json({ success: false, message: 'Helper profile not found' });
    }

    const result = await regenerateOtpForBooking(bookingId, helper.id);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to regenerate OTP';
    logger.error('regenerateOtpHandler: Error', { bookingId: req.params.bookingId, error: message });

    const httpStatus =
      message.includes('Not authorized') ? 403 :
      message.includes('not found')      ? 404 :
      message.includes('only allowed')   ||
      message.includes('changed during') ? 400 :
      500;

    return res.status(httpStatus).json({ success: false, message });
  }
};

/**
 * POST /api/partner/bookings/:bookingId/complete
 * Assigned helper marks a booking as COMPLETED.
 * Transitions IN_PROGRESS → COMPLETED.
 */
export const completeBookingHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const bookingId = String(parseInt(req.params.bookingId, 10));

    const helper = await prisma.helper.findUnique({
      where: { userId: parseInt(req.user.userId, 10) },
      select: { id: true },
    });
    if (!helper) {
      return res.status(403).json({ success: false, message: 'Helper profile not found' });
    }

    const result = await completeBooking(bookingId, String(helper.id));
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to complete booking';
    logger.error('completeBookingHandler: Error', { bookingId: req.params.bookingId, error: message });

    const httpStatus =
      message.includes('not authorized') || message.includes('Only the assigned') ? 403 :
      message.includes('not found')                                                ? 404 :
      message.includes('must be in')     || message.includes('已')                 ? 400 :
      500;

    return res.status(httpStatus).json({ success: false, message });
  }
};

/**
 * POST /api/partner/bookings/:bookingId/start-timer
 * Starts the job timer for an IN_PROGRESS booking.
 *
 * Requirements:
 *  - Booking must be IN_PROGRESS
 *  - Booking must belong to the requesting helper
 *  - At least one BEFORE photo must have been uploaded
 *  - Timer can only be started once (jobTimerStarted must be false)
 */
export const startTimerHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const bookingId = parseInt(req.params.bookingId, 10);

    const helper = await prisma.helper.findUnique({
      where:  { userId: parseInt(req.user.userId, 10) },
      select: { id: true },
    });
    if (!helper) {
      return res.status(403).json({ success: false, message: 'Helper profile not found' });
    }

    // Fetch booking with before-photo count in one query
    const booking = await prisma.booking.findUnique({
      where:  { id: bookingId },
      select: {
        id:              true,
        helperId:        true,
        status:          true,
        jobTimerStarted: true,
        _count: {
          select: {
            workPhotos: {
              where: { type: 'BEFORE' },
            },
          },
        },
      },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.helperId !== helper.id) {
      return res.status(403).json({ success: false, message: 'You are not the assigned helper for this booking' });
    }

    if (booking.status !== 'IN_PROGRESS') {
      return res.status(409).json({
        success: false,
        message: `Job timer can only be started when booking is IN_PROGRESS (current: ${booking.status})`,
      });
    }

    if (booking.jobTimerStarted) {
      return res.status(409).json({ success: false, message: 'Job timer has already been started for this booking' });
    }

    if (booking._count.workPhotos === 0) {
      return res.status(422).json({ success: false, message: 'Before photos must be uploaded before starting the job timer' });
    }

    const jobStartedAt = new Date();
    await prisma.booking.update({
      where: { id: bookingId },
      data:  { jobTimerStarted: true, jobStartedAt },
    });

    logger.info('startTimerHandler: Job timer started', { bookingId, helperId: helper.id, jobStartedAt });

    return res.json({
      success: true,
      message: 'Job timer started',
      data:    { jobStartedAt },
    });
  } catch (error) {
    logger.error('startTimerHandler: Error', { bookingId: req.params.bookingId, error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ success: false, message: 'Failed to start job timer' });
  }
};

/**
 * GET /api/partner/bookings
 * Returns paginated list of bookings assigned to the authenticated helper.
 */
export const getHelperBookingsHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const helper = await prisma.helper.findUnique({
      where: { userId: parseInt(req.user.userId, 10) },
      select: { id: true },
    });
    if (!helper) {
      return res.status(403).json({ success: false, message: 'Helper profile not found' });
    }

    const result = await getHelperBookings(helper.id, {
      status: req.query.status as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof BookingServiceError) {
      return res.status(error.httpStatus).json({ success: false, message: error.message });
    }
    logger.error('getHelperBookingsHandler error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
};
