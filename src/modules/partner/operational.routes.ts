/**
 * helper-operational.routes.ts
 *
 * All routes are gated by requireApprovedHelper which enforces:
 *   - Valid JWT
 *   - User.role === HELPER (DB check)
 *   - Helper record exists
 *   - onboardingStatus === APPROVED
 *   - User not suspended
 *
 *   PATCH  /api/helper/status      — toggle online / offline
 *   GET    /api/helper/dashboard   — unified operational snapshot
 *   GET    /api/helper/discipline  — strike & suspension visibility
 */

import { Router } from 'express';
import { requireApprovedHelper } from '../../middlewares/auth.middleware';
import { toggleOnlineStatus } from './helper-status.controller';
import { getDashboard, getDiscipline } from './helper-dashboard.controller';

const router = Router();

// All routes require an approved, non-suspended Helper
router.use(requireApprovedHelper);

/**
 * PATCH /api/helper/status
 * Body: { isOnline: boolean, force?: boolean }
 *
 * Toggle the helper online/offline state.
 * `force: true` allows going offline even when a job is IN_PROGRESS.
 */
router.patch('/status', toggleOnlineStatus);

/**
 * GET /api/helper/dashboard
 *
 * Unified snapshot:
 *   - helper identity & online state
 *   - suspension status
 *   - active & upcoming booking
 *   - open pending request count
 *   - today's completed jobs
 *   - earnings summary
 *   - discipline counters
 */
router.get('/dashboard', getDashboard);

/**
 * GET /api/helper/discipline
 *
 * Detailed discipline record:
 *   - strike / noShow / cancel / ignore / penalty counts
 *   - last strike timestamp
 *   - suspension window (if any)
 *   - recent cancelled bookings
 */
router.get('/discipline', getDiscipline);

export default router;
