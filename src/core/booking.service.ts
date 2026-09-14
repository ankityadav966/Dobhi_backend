/**
 * booking.service.ts
 *
 * Pure business logic for booking read and customer-cancel operations.
 * Contains NO Express imports, NO req/res, NO route dependencies.
 *
 * Lifecycle transitions (confirm, start, complete, cancel-with-refund) live in:
 *   src/services/booking-lifecycle.service.ts
 */
import { prisma } from '../prisma.client';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import logger from '../utils/logger';

export interface PaginationQuery {
  status?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── Types ───────────────────────────────────────────────────────────────────

type BookingNotFoundError = 'BOOKING_NOT_FOUND';
type BookingForbiddenError = 'FORBIDDEN';
type BookingStatusError = 'INVALID_STATUS_TRANSITION';
type PaymentCapturedError = 'PAYMENT_CAPTURED';

export class BookingServiceError extends Error {
  constructor(
    message: string,
    public readonly code: BookingNotFoundError | BookingForbiddenError | BookingStatusError | PaymentCapturedError,
    public readonly httpStatus: 400 | 403 | 404
  ) {
    super(message);
    this.name = 'BookingServiceError';
  }
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Fetch a single booking by ID with full includes.
 * Throws BookingServiceError (404) if not found.
 */
export async function getBookingById(bookingId: number) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      service: { select: { id: true, name: true } },
      helper: {
        select: {
          id: true,
          userId: true,
          rating: true,
          user: { select: { fullName: true } },
        },
      },
      customer: { select: { id: true, fullName: true, phone: true } },
      payment: true,
      rating: true,
    },
  });

  if (!booking) {
    throw new BookingServiceError('Booking not found', 'BOOKING_NOT_FOUND', 404);
  }

  return booking;
}

/**
 * Paginated list of bookings for a specific customer.
 * Throws BookingServiceError (400) for unknown status values.
 */
export async function getCustomerBookings(
  customerId: number,
  query: PaginationQuery
): Promise<PaginatedResult<any>> {
  const { status, page = 1, limit = 10 } = query;
  const where: any = { customerId };

  if (status) {
    if (!Object.values(BookingStatus).includes(status as BookingStatus)) {
      throw new BookingServiceError(
        `Invalid status. Must be one of: ${Object.values(BookingStatus).join(', ')}`,
        'INVALID_STATUS_TRANSITION',
        400
      );
    }
    where.status = status as BookingStatus;
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        service: { select: { id: true, name: true } },
        helper: {
          select: {
            id: true,
            rating: true,
            user: { select: { fullName: true } },
          },
        },
        payment: { select: { id: true, status: true, amount: true } },
      },
    }),
    prisma.booking.count({ where }),
  ]);

  return {
    data: bookings,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
}

/**
 * Customer cancels their own booking.
 * - Ownership check: customerId must match booking.customerId
 * - Status guard: cannot cancel IN_PROGRESS or COMPLETED bookings
 * Throws BookingServiceError on validation failure.
 */
export async function cancelCustomerBooking(
  bookingId: number,
  customerId: number
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payment: true },
  });

  if (!booking) {
    throw new BookingServiceError('Booking not found', 'BOOKING_NOT_FOUND', 404);
  }

  if (booking.customerId !== customerId) {
    throw new BookingServiceError('Unauthorized to cancel this booking', 'FORBIDDEN', 403);
  }

  if (
    booking.status === BookingStatus.IN_PROGRESS ||
    booking.status === BookingStatus.COMPLETED
  ) {
    throw new BookingServiceError(
      `Cannot cancel booking with status: ${booking.status}`,
      'INVALID_STATUS_TRANSITION',
      400
    );
  }

  // CRITICAL: Do NOT allow cancellation if payment is CAPTURED
  if (booking.payment && booking.payment.status === PaymentStatus.CAPTURED) {
    throw new BookingServiceError(
      'Cannot cancel booking with captured payment. Contact support for refund.',
      'PAYMENT_CAPTURED',
      400
    );
  }

  const cancelled = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: BookingStatus.CANCELLED },
  });

  logger.info('Booking cancelled by customer', {
    bookingId,
    customerId,
    paymentStatus: booking.payment?.status,
  });

  return cancelled;
}

/**
 * Paginated list of bookings assigned to a specific helper.
 * Throws BookingServiceError (400) for unknown status values.
 */
export async function getHelperBookings(
  helperId: number,
  query: PaginationQuery
): Promise<PaginatedResult<any>> {
  const { status, page = 1, limit = 10 } = query;
  const where: any = { helperId };

  if (status) {
    if (!Object.values(BookingStatus).includes(status as BookingStatus)) {
      throw new BookingServiceError(
        `Invalid status. Must be one of: ${Object.values(BookingStatus).join(', ')}`,
        'INVALID_STATUS_TRANSITION',
        400
      );
    }
    where.status = status as BookingStatus;
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
        service: { select: { name: true } },
      },
    }),
    prisma.booking.count({ where }),
  ]);

  return {
    data: bookings,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
}
