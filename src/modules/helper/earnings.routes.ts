import { Router } from 'express';
import { authMiddleware, requireApprovedHelper } from '../../middlewares/auth.middleware';
import { validate } from '../../utils/validators';
import {
  getDashboardHandler,
  getHistoryHandler,
  getTransactionDetailHandler,
  validateTransactionId,
} from './earnings.controller';

const router = Router();

/**
 * Earnings dashboard — today, week, month stats
 * GET /api/helper/earnings/dashboard
 */
router.get('/dashboard', requireApprovedHelper, getDashboardHandler);

/**
 * Earnings transaction history
 * GET /api/helper/earnings/history
 */
router.get('/history', requireApprovedHelper, getHistoryHandler);

/**
 * Transaction detail
 * GET /api/helper/earnings/transaction/:transactionId
 */
router.get('/transaction/:transactionId', requireApprovedHelper, validateTransactionId, validate, getTransactionDetailHandler);

export default router;
