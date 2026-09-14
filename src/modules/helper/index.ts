import { Router } from 'express';
import earningsRoutes from './earnings.routes';
import bankRoutes from './bank.routes';
import payoutStatusRoutes from './payout-status.routes';

const router = Router();

/**
 * Helper (Partner) module
 * Mounted at: /api/helper
 *
 * Routes included:
 *   /api/helper/earnings/dashboard      — earnings stats (today, week, month)
 *   /api/helper/earnings/history        — transaction history (HELPER_PAYOUT only)
 *   /api/helper/earnings/transaction/:id — transaction details with breakdown
 *   /api/helper/bank                    — bank details (GET, PUT UPSERT)
 *   /api/helper/payout/status           — payout status summary with percentages
 *   /api/helper/payout/pending          — list of pending payouts
 *   /api/helper/payout/history          — payout history (completed/failed)
 */
router.use('/earnings', earningsRoutes);
router.use('/bank', bankRoutes);
router.use('/payout', payoutStatusRoutes);

export default router;
