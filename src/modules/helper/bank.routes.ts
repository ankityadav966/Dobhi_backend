import { Router } from 'express';
import { requireApprovedHelper } from '../../middlewares/auth.middleware';
import { validate } from '../../utils/validators';
import { getBankHandler, updateBankHandler, validateBankDetails } from './bank.controller';

const router = Router();

/**
 * Get bank details
 * GET /api/helper/bank
 */
router.get('/', requireApprovedHelper, getBankHandler);

/**
 * Update/Create bank details (UPSERT)
 * PUT /api/helper/bank
 */
router.put('/', requireApprovedHelper, validateBankDetails, validate, updateBankHandler);

export default router;
