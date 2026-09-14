/**
 * user-booking.controller.ts
 *
 * Handles req/res for customer booking operations.
 * All business logic lives in src/core/booking.service.ts.
 */
import { Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import {
  getBookingById,
  getCustomerBookings,
  cancelCustomerBooking,
  BookingServiceError,
} from '../../core/booking.service';
import logger from '../../utils/logger';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tz from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(tz);

const IST_TZ = 'Asia/Kolkata';

// ── Response sanitizer ────────────────────────────────────────────────────────
// Strips internal/financial/PII fields before sending to the customer client.
// Does NOT modify Prisma queries or any business logic.

interface SanitizedPayment {
  status: string;
  amount: number;
}

interface SanitizedHelper {
  id: number;
  rating: number;
  fullName: string;
}

interface SanitizedBooking {
  id: number;
  status: string;
  bookingDate: string; // ISO string in UTC
  startTime: string | null; // ISO string in UTC
  endTime: string | null; // ISO string in UTC
  // IST-formatted labels for frontend display
  bookingDateLabel: string;
  startTimeLabel: string | null;
  endTimeLabel: string | null;
  location: string;
  address: string | null;
  city: string | null;
  pinCode: string | null;
  notes: string | null;
  specialRequirements: string | null;
  totalAmount: number;
  finalAmount: number;
  startedAt: string | null; // ISO string in UTC
  completedAt: string | null; // ISO string in UTC
  startedAtLabel: string | null; // IST-formatted
  completedAtLabel: string | null; // IST-formatted
  cancelReason: string | null;
  service: { id: number; name: string } | null;
  helper: SanitizedHelper | null;
  payment: SanitizedPayment | null;
  startOtp: string | null;
}

function formatTimeIST(utcDate: Date | null): string | null {
  if (!utcDate) return null;
  return dayjs(utcDate).tz(IST_TZ).format('YYYY-MM-DD HH:mm:ss');
}

function formatTimeIST_ReadableTime(utcDate: Date | null): string | null {
  if (!utcDate) return null;
  return dayjs(utcDate).tz(IST_TZ).format('hh:mm A');
}

function formatTimeIST_ReadableDate(utcDate: Date | null): string | null {
  if (!utcDate) return null;
  return dayjs(utcDate).tz(IST_TZ).format('MMM D, YYYY');
}

function sanitizeBooking(raw: any): SanitizedBooking {
  // OTP and helper only for CONFIRMED bookings
  const isConfirmed = raw.status === 'CONFIRMED';

  return {
    id:                  raw.id,
    status:              raw.status,
    // Keep raw ISO timestamps  in UTC for consistency
    bookingDate:         raw.bookingDate ? new Date(raw.bookingDate).toISOString() : null,
    startTime:           raw.startTime ? new Date(raw.startTime).toISOString() : null,
    endTime:             raw.endTime ? new Date(raw.endTime).toISOString() : null,
    // IST-formatted labels for display
    bookingDateLabel:    raw.bookingDate ? formatTimeIST_ReadableDate(raw.bookingDate) : null,
    startTimeLabel:      raw.startTime ? formatTimeIST_ReadableTime(raw.startTime) : null,
    endTimeLabel:        raw.endTime ? formatTimeIST_ReadableTime(raw.endTime) : null,
    location:            raw.location,
    address:             raw.address      ?? null,
    city:                raw.city         ?? null,
    pinCode:             raw.pinCode      ?? null,
    notes:               raw.notes        ?? null,
    specialRequirements: raw.specialRequirements ?? null,
    totalAmount:         raw.totalAmount,
    finalAmount:         raw.finalAmount,
    startedAt:           raw.startedAt ? new Date(raw.startedAt).toISOString() : null,
    completedAt:         raw.completedAt ? new Date(raw.completedAt).toISOString() : null,
    startedAtLabel:      raw.startedAt ? formatTimeIST(raw.startedAt) : null,
    completedAtLabel:    raw.completedAt ? formatTimeIST(raw.completedAt) : null,
    cancelReason:        raw.cancelReason ?? null,
    service: raw.service
      ? { id: raw.service.id, name: raw.service.name }
      : null,
    // Helper only for CONFIRMED bookings
    helper: isConfirmed && raw.helper
      ? {
          id:       raw.helper.id,
          rating:   raw.helper.rating,
          fullName: raw.helper.user?.fullName ?? '',
        }
      : null,
    payment: raw.payment
      ? { status: raw.payment.status, amount: raw.payment.amount }
      : null,
    // OTP only for CONFIRMED bookings
    startOtp: isConfirmed ? (raw.startOtp ?? null) : null,
  };
}

/**
 * GET /api/user/bookings/:bookingId
 * Any authenticated user may read a booking they are party to.
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

    return res.json({ success: true, data: sanitizeBooking(booking) });
  } catch (error) {
    if (error instanceof BookingServiceError) {
      return res.status(error.httpStatus).json({ success: false, message: error.message });
    }
    logger.error('getBookingByIdHandler error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch booking' });
  }
};

/**
 * GET /api/user/bookings
 * Returns paginated list of bookings for the authenticated customer.
 */
export const getMyBookingsHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const customerId = parseInt(req.user.userId, 10);
    const result = await getCustomerBookings(customerId, {
      status: req.query.status as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });

    return res.json({
      success: true,
      data: result.data.map(sanitizeBooking),
      pagination: result.pagination,
    });
  } catch (error) {
    if (error instanceof BookingServiceError) {
      return res.status(error.httpStatus).json({ success: false, message: error.message });
    }
    logger.error('getMyBookingsHandler error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
};

/**
 * POST /api/user/bookings/:bookingId/cancel
 * Customer cancels one of their own bookings.
 */
export const cancelBookingHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const bookingId = parseInt(req.params.bookingId, 10);
    const customerId = parseInt(req.user.userId, 10);
    const cancelled = await cancelCustomerBooking(bookingId, customerId);

    return res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: cancelled,
    });
  } catch (error) {
    if (error instanceof BookingServiceError) {
      return res.status(error.httpStatus).json({ success: false, message: error.message });
    }
    logger.error('cancelBookingHandler error:', error);
    return res.status(500).json({ success: false, message: 'Failed to cancel booking' });
  }
};
