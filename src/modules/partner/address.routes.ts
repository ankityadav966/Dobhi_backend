/**
 * address.routes.ts
 *
 * Partner address routes.
 *
 * Mounted at: /api/partner/address
 * Auth:       requireApprovedHelper
 */

import { Router } from 'express';
import { requireApprovedHelper } from '../../middlewares/auth.middleware';
import {
  getPartnerAddressHandler,
  updatePartnerAddressHandler,
  validateUpdatePartnerAddress,
} from './address.controller';

const router = Router();

router.get('/', requireApprovedHelper, getPartnerAddressHandler);
router.put('/', requireApprovedHelper, validateUpdatePartnerAddress, updatePartnerAddressHandler);

export default router;
