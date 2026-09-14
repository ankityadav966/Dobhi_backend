import { Router } from 'express';
import { requireApprovedHelper } from '../../middlewares/auth.middleware';
import { validate } from '../../utils/validators';
import {
  getProfileHandler,
  updateProfileHandler,
  validateUpdateProfile,
} from './profile.controller';

const router = Router();

router.get('/', requireApprovedHelper, getProfileHandler);
router.put('/', requireApprovedHelper, validateUpdateProfile, validate, updateProfileHandler);

export default router;
