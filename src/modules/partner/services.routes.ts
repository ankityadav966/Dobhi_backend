/**
 * services.routes.ts
 *
 * Partner manage-services routes.
 *
 * Mounted at: /api/partner/services
 * Auth:       requireApprovedHelper
 */

import { Router } from 'express';
import { requireApprovedHelper } from '../../middlewares/auth.middleware';
import {
  getPartnerServicesHandler,
  updatePartnerServicesHandler,
  validateUpdatePartnerServices,
} from './services.controller';

const router = Router();

router.get('/', requireApprovedHelper, getPartnerServicesHandler);
router.put('/', requireApprovedHelper, validateUpdatePartnerServices, updatePartnerServicesHandler);

export default router;
