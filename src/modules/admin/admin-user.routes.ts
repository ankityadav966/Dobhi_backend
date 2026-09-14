/**
 * admin-user.routes.ts
 *
 * Admin User Management routes.
 * Mounted at /api/admin/users via modules/admin/index.ts
 *
 * All routes require authentication + ADMIN role.
 *
 * Route order matters:
 *   /stats must come before /:userId to prevent Express matching
 *   the literal string "stats" as a userId parameter.
 */
import { Router } from 'express';
import { authMiddleware, checkRole } from '../../middlewares/auth.middleware';
import { UserRole } from '@prisma/client';
import {
  getUsersHandler,
  getUserStatsHandler,
  getUserDetailsHandler,
  blockUserHandler,
  unblockUserHandler,
  getUserBookingsHandler,
} from './admin-user.controller';

const router = Router();

// All routes require authentication + ADMIN role
router.use(authMiddleware);
router.use(checkRole(UserRole.ADMIN));

/**
 * GET /api/admin/users
 * Query: page, limit, search, status ("active"|"blocked")
 * Returns paginated user list with totalBookings + totalSpent per user.
 * Also returns top-level total/active/blocked counts for summary cards.
 */
router.get('/', getUsersHandler);

/**
 * GET /api/admin/users/stats
 * Returns { total, active, blocked } user counts.
 * Registered BEFORE /:userId to prevent route shadowing.
 */
router.get('/stats', getUserStatsHandler);

/**
 * GET /api/admin/users/:userId
 * Returns full user profile, helper profile (if any), booking stats,
 * and 10 most recent bookings.
 */
router.get('/:userId', getUserDetailsHandler);

/**
 * POST /api/admin/users/:userId/block
 * Body: { reason: string }
 * Blocks the user and persists the reason.
 */
router.post('/:userId/block', blockUserHandler);
router.patch('/:userId/block', blockUserHandler);

/**
 * POST /api/admin/users/:userId/unblock
 * Removes the block and clears blockedReason.
 */
router.post('/:userId/unblock', unblockUserHandler);
router.patch('/:userId/unblock', unblockUserHandler);

/**
 * GET /api/admin/users/:userId/bookings
 * Query: page, limit
 * Returns paginated booking history for the specified user.
 */
router.get('/:userId/bookings', getUserBookingsHandler);

export default router;
