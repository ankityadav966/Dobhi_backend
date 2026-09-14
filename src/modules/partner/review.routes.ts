/**
 * review.routes.ts
 *
 * Partner reviews (incoming ratings from customers).
 *
 * Mounted at: /api/partner/reviews
 * Auth:       requireApprovedHelper
 */

import { Router } from 'express';
import { requireApprovedHelper } from '../../middlewares/auth.middleware';
import { getPartnerReviewsHandler } from './review.controller';

const router = Router();

router.get('/', requireApprovedHelper, getPartnerReviewsHandler);

export default router;
