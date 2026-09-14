import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireApprovedHelper } from '../../middlewares/auth.middleware';
import {
  getPayoutStatusHandler,
  getPendingPayoutsHandler,
  getPayoutHistoryHandler,
} from './payout-status.controller';

const router = Router();

/**
 * GET /api/helper/payout/status
 * Get payout status summary with breakdown
 */
router.get('/status', authMiddleware, requireApprovedHelper, getPayoutStatusHandler);

/**
 * GET /api/helper/payout/pending
 * Get list of pending payouts without release
 */
router.get('/pending', authMiddleware, requireApprovedHelper, getPendingPayoutsHandler);

/**
 * GET /api/helper/payout/history
 * Get payout history (completed/failed payouts)
 * Query params:
 *   - limit: number (default 50)
 */
router.get('/history', authMiddleware, requireApprovedHelper, getPayoutHistoryHandler);

export default router;
