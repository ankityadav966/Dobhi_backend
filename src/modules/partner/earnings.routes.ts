import { Router } from 'express';
import { authMiddleware, checkRole } from '../../middlewares/auth.middleware';
import { UserRole } from '@prisma/client';
import {
  getEarningsSummaryHandler,
  getEarningsHistoryHandler,
  getEarningsDetailHandler,
} from './earnings.controller';

const router = Router();

// All earnings routes require a valid HELPER token
router.use(authMiddleware);
router.use(checkRole(UserRole.HELPER));

router.get('/summary',       getEarningsSummaryHandler);
router.get('/history',       getEarningsHistoryHandler);
router.get('/:bookingId',    getEarningsDetailHandler);

export default router;
