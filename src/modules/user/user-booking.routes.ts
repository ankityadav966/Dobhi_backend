/**
 * user-booking.routes.ts
 *
 * Customer booking routes.
 * Mounted at /api/user/bookings via modules/user/index.ts
 */
import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate, validateBookingId } from '../../utils/validators';
import {
  getBookingByIdHandler,
  getMyBookingsHandler,
  cancelBookingHandler,
} from './user-booking.controller';

const router = Router();

// GET /api/user/bookings        — customer's own bookings (paginated)
router.get('/', authMiddleware, getMyBookingsHandler);

// GET /api/user/bookings/:bookingId   — single booking detail (auth + ownership enforced)
router.get('/:bookingId', authMiddleware, validateBookingId, validate, getBookingByIdHandler);

// POST /api/user/bookings/:bookingId/cancel  — customer cancel
router.post('/:bookingId/cancel', authMiddleware, cancelBookingHandler);

export default router;
