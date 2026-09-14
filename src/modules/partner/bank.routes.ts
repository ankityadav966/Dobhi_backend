/**
 * bank.routes.ts
 *
 * Partner bank detail routes.
 *
 * Mounted at: /api/partner/bank-details
 * Auth:       requireApprovedHelper
 */

import { Router } from 'express';
import { requireApprovedHelper } from '../../middlewares/auth.middleware';
import {
  getPartnerBankDetailsHandler,
  createPartnerBankDetailsHandler,
  updatePartnerBankDetailsHandler,
  validateCreateBankDetails,
  validateUpdateBankDetails,
} from './bank.controller';

const router = Router();

router.get('/',  requireApprovedHelper, getPartnerBankDetailsHandler);
router.post('/', requireApprovedHelper, validateCreateBankDetails, createPartnerBankDetailsHandler);
router.put('/',  requireApprovedHelper, validateUpdateBankDetails,  updatePartnerBankDetailsHandler);

export default router;
