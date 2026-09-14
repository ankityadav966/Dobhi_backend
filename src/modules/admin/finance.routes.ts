import { Router } from 'express';
import { authMiddleware, checkRole } from '../../middlewares/auth.middleware';
import { UserRole } from '@prisma/client';
import { getFinanceSummary, listPayouts, getPayoutAudit } from './finance.controller';

const router = Router();

// All finance routes require ADMIN role
router.use(authMiddleware);
router.use(checkRole(UserRole.ADMIN));

// GET /api/admin/finance/summary
router.get('/summary', getFinanceSummary);

// GET /api/admin/finance/payouts
router.get('/payouts', listPayouts);

// GET /api/admin/finance/payouts/:bookingId
router.get('/payouts/:bookingId', getPayoutAudit);

export default router;
