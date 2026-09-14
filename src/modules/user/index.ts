import { Router } from 'express';
import userRoutes from './user.routes';
import userBookingRoutes from './user-booking.routes';
import addressRoutes from './address.routes';

const router = Router();

/**
 * Customer module
 * Mounted at: /api/user
 *
 * Routes included:
 *   GET    /api/user/profile
 *   PUT    /api/user/profile
 *   POST   /api/user/register-helper
 *   PUT    /api/user/bank-details
 *   POST   /api/user/upload-photo
 *   POST   /api/user/upload-kyc
 *   GET    /api/user/helper/:helperId
 *   GET    /api/user/search-helpers
 *
 *   GET    /api/user/bookings              — my bookings
 *   GET    /api/user/bookings/:bookingId   — booking detail
 *   POST   /api/user/bookings/:bookingId/cancel
 *   GET    /api/user/addresses             — list saved addresses
 *   POST   /api/user/addresses             — add address
 *   PUT    /api/user/addresses/:addressId  — update address
 *   DELETE /api/user/addresses/:addressId  — delete address
 */
router.use('/', userRoutes);
router.use('/addresses', addressRoutes);
router.use('/bookings', userBookingRoutes);

export default router;
