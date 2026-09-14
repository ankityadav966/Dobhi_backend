/**
 * admin-helper.routes.ts
 *
 * Admin Helper Management routes.
 * Mounted at /api/admin/helpers via modules/admin/index.ts
 *
 * All routes require authentication + ADMIN role.
 *
 * Route order matters:
 *   /stats must come before /:helperId to prevent Express matching
 *   the literal string "stats" as a helperId parameter.
 */
import { Router } from 'express';
import { authMiddleware, checkRole } from '../../middlewares/auth.middleware';
import { UserRole } from '@prisma/client';
import {
  getHelpersHandler,
  getHelperStatsHandler,
  getHelperDetailsHandler,
  updateHelperStatusHandler,
  getHelperBookingsHandler,
} from './admin-helper.controller';

const router = Router();

// All routes require authentication + ADMIN role
router.use(authMiddleware);
router.use(checkRole(UserRole.ADMIN));

/**
 * GET /api/admin/helpers
 * Query: page, limit, search, status ("active"|"inactive")
 * Returns paginated helper list with orders + earnings per helper.
 */
router.get('/', getHelpersHandler);

/**
 * GET /api/admin/helpers/stats
 * Returns { totalHelpers, activeHelpers, inactiveHelpers }.
 * Registered BEFORE /:helperId to prevent route shadowing.
 */
router.get('/stats', getHelperStatsHandler);

/**
 * GET /api/admin/helpers/:helperId/bookings
 * Query: page, limit
 * Returns paginated booking history for the specified helper.
 * Registered BEFORE /:helperId to prevent route shadowing.
 */
router.get('/:helperId/bookings', getHelperBookingsHandler);

/**
 * GET /api/admin/helpers/:helperId
 * Returns full helper profile, services, earnings, and 10 recent bookings.
 */
router.get('/:helperId', getHelperDetailsHandler);

/**
 * PATCH /api/admin/helpers/:helperId/status
 * Body: { status: "active" | "inactive" }
 * Activates or deactivates a helper partner.
 */
router.patch('/:helperId/status', updateHelperStatusHandler);

export default router;
