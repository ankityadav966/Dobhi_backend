import { Router } from 'express';
import { authMiddleware, checkRole } from '../../middlewares/auth.middleware';
import { UserRole } from '@prisma/client';
import {
  approveOnboarding,
  rejectOnboarding,
} from '../partner/onboarding.controller';

const router = Router();

// Admin-only: approve or reject helper onboarding
router.post('/approve/:helperId', authMiddleware, checkRole(UserRole.ADMIN), approveOnboarding);
router.post('/reject/:helperId', authMiddleware, checkRole(UserRole.ADMIN), rejectOnboarding);

export default router;
