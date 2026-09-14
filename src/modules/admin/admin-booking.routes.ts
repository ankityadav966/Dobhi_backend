/**
 * admin-booking.routes.ts
 *
 * Admin booking override routes.
 * Mounted at /api/admin/bookings via modules/admin/index.ts
 *
 * All routes require authentication + ADMIN role.
 */
import { Router } from 'express';
import { authMiddleware, checkRole } from '../../middlewares/auth.middleware';
import { UserRole } from '@prisma/client';
import {
  validateAdminCancelBooking,
  adminCancelBookingHandler,
} from './admin-booking.controller';
import { getAdminBookingsHandler } from './admin-bookings.controller';
import { getAdminBookingDetailsHandler } from './admin-booking-details.controller';
import { prisma } from '../../prisma.client';

const router = Router();

// All admin booking routes require auth + ADMIN role
router.use(authMiddleware);
router.use(checkRole(UserRole.ADMIN));

/**
 * GET /api/admin/bookings
 *
 * Paginated booking list for the Admin Order Management table.
 * Query: page, limit, search (customer name/phone/helper name/bookingId), status
 * Response includes stats cards: totalBookings, activeNow, pending, completed.
 */
router.get('/', getAdminBookingsHandler);

/**
 * GET /api/admin/bookings/:bookingId
 *
 * Full booking detail for the Admin Order Management modal.
 * Registered before /:bookingId/cancel to be explicit — Express matches by method so no shadowing.
 */
router.get('/:bookingId', getAdminBookingDetailsHandler);

/**
 * POST /api/admin/bookings/:bookingId/cancel
 *
 * Admin override cancellation.
 * Cancels the booking regardless of current status (except COMPLETED/EXPIRED).
 * If payment was captured, marks it as REFUNDED.
 * If payout was already PAID, flags payoutReversalRequired=true in the response.
 *
 * Body:
 *   reason        {string}  — cancellation reason (required)
 *   overridePayout {boolean} — acknowledge payout reversal risk (optional, default false)
 */
router.post(
  '/:bookingId/cancel',
  ...validateAdminCancelBooking,
  adminCancelBookingHandler
);

/**
 * PATCH /api/admin/bookings/:bookingId/status
 * Updates booking status (confirmed, in_progress, completed, cancelled, etc.)
 */
router.patch('/:bookingId/status', async (req, res): Promise<any> => {
  try {
    const bookingId = parseInt(req.params.bookingId, 10);
    const { status } = req.body;

    if (isNaN(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid bookingId' });
    }

    let bookingStatus: any = 'CONFIRMED';
    const s = String(status || '').toUpperCase();
    if (s.includes('CONFIRM')) bookingStatus = 'CONFIRMED';
    else if (s.includes('CANCEL')) bookingStatus = 'CANCELLED';
    else if (s.includes('PROGRESS') || s.includes('ACTIVE')) bookingStatus = 'IN_PROGRESS';
    else if (s.includes('COMPLETE')) bookingStatus = 'COMPLETED';
    else if (s.includes('PENDING')) bookingStatus = 'PENDING_PAYMENT';

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: bookingStatus },
    });

    return res.json({
      success: true,
      message: `Booking #${bookingId} status updated to ${bookingStatus}`,
      data: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to update booking status' });
  }
});

/**
 * PATCH /api/admin/bookings/:bookingId/assign
 * Assigns or replaces helper on a booking
 */
router.patch('/:bookingId/assign', async (req, res): Promise<any> => {
  try {
    const bookingId = parseInt(req.params.bookingId, 10);
    const { helperId } = req.body;

    if (isNaN(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid bookingId' });
    }

    const cleanHelperId = helperId ? parseInt(String(helperId).replace(/^P-/, ''), 10) : null;

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        helperId: cleanHelperId || undefined,
        status: 'CONFIRMED',
      },
      include: { helper: { include: { user: true } } },
    });

    return res.json({
      success: true,
      message: `Helper assigned to Booking #${bookingId}`,
      data: updated,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to assign helper' });
  }
});

export default router;
