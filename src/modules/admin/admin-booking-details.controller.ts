/**
 * admin-booking-details.controller.ts
 *
 * Admin Order Management — Booking Details modal API.
 *
 * Route (mounted on /api/admin/bookings):
 *   GET /:bookingId — full booking detail
 */

import { Request, Response } from 'express';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';

/**
 * GET /api/admin/bookings/:bookingId
 *
 * Returns full booking details for the Admin Order Management modal.
 *
 * Errors:
 *   400 — invalid bookingId
 *   404 — booking not found
 *   500 — server error
 */
export const getAdminBookingDetailsHandler = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const bookingId = parseInt(req.params.bookingId, 10);
  if (isNaN(bookingId)) {
    return res.status(400).json({ success: false, message: 'Invalid bookingId' });
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id:          true,
        bookingDate: true,
        duration:    true,
        address:     true,
        status:      true,
        finalAmount: true,
        customer: {
          select: { id: true, fullName: true, phone: true },
        },
        helper: {
          select: {
            id:   true,
            user: { select: { fullName: true } },
          },
        },
        service: { select: { name: true } },
        payment: { select: { amount: true, status: true } },
      },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    return res.json({
      success: true,
      data: {
        bookingId:      booking.id,
        status:         booking.status,
        bookingDate:    booking.bookingDate,
        duration:       booking.duration,
        serviceAddress: booking.address ?? null,

        user: {
          id:    booking.customer.id,
          name:  booking.customer.fullName,
          phone: booking.customer.phone,
        },

        partner: {
          id:      booking.helper?.id ?? null,
          name:    booking.helper?.user.fullName ?? null,
          service: booking.service.name,
        },

        payment: {
          serviceAmount: booking.payment?.amount    ?? null,
          totalAmount:   booking.finalAmount,
          paymentStatus: booking.payment?.status    ?? null,
        },
      },
    });
  } catch (error) {
    logger.error('admin getAdminBookingDetailsHandler: error', { bookingId, error });
    return res.status(500).json({ success: false, message: 'Failed to fetch booking details' });
  }
};
