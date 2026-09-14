import { Router } from 'express';
import { authMiddleware, checkRole } from '../../middlewares/auth.middleware';
import { UserRole } from '@prisma/client';
import { markPayoutPaid } from './payout.controller';

const router = Router();

router.use(authMiddleware);
router.use(checkRole(UserRole.ADMIN));

// POST /api/admin/payout/:bookingId/mark-paid
router.post('/:bookingId/mark-paid', markPayoutPaid);

export default router;
