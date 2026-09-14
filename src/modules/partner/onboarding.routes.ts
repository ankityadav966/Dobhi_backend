import { Router } from 'express';
import { authMiddleware, checkRole } from '../../middlewares/auth.middleware';
import { UserRole } from '@prisma/client';
import {
  submitProfile,
  submitKyc,
  submitBank,
  getOnboardingStatus,
} from './onboarding.controller';

const router = Router();

// All helper onboarding routes require HELPER role
router.get('/status', authMiddleware, checkRole(UserRole.HELPER), getOnboardingStatus);
router.post('/profile', authMiddleware, checkRole(UserRole.HELPER), submitProfile);
router.post('/kyc', authMiddleware, checkRole(UserRole.HELPER), submitKyc);
router.post('/bank', authMiddleware, checkRole(UserRole.HELPER), submitBank);

export default router;
