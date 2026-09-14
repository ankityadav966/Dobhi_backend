/**
 * address.routes.ts
 *
 * User multi-address routes.
 *
 * Mounted via: router.use('/addresses', addressRoutes) in user/index.ts
 * Final paths:
 *   GET    /api/user/addresses
 *   POST   /api/user/addresses
 *   PUT    /api/user/addresses/:addressId
 *   DELETE /api/user/addresses/:addressId
 */

import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import {
  getUserAddresses,
  createUserAddress,
  updateUserAddress,
  deleteUserAddress,
  validateAddress,
  validateUpdateAddress,
} from './address.controller';

const router = Router();

router.get('/',            authMiddleware, getUserAddresses);
router.post('/',           authMiddleware, validateAddress, createUserAddress);
router.put('/:addressId',  authMiddleware, validateUpdateAddress, updateUserAddress);
router.delete('/:addressId', authMiddleware, deleteUserAddress);

export default router;
