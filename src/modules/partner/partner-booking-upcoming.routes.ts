import { Router } from 'express';
import { requireApprovedHelper } from '../../middlewares/auth.middleware';
import { getUpcomingHelperBookingsHandler } from './partner-booking-upcoming.controller';
import { getBookingByIdHandler } from './partner-booking.controller';
const router = Router();

// CRITICAL: Static route BEFORE dynamic route
router.get('/bookings/upcoming', requireApprovedHelper, getUpcomingHelperBookingsHandler);
router.get('/bookings/:bookingId', requireApprovedHelper, getBookingByIdHandler);

export default router;
