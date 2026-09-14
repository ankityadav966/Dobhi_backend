import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate, validateProfileUpdate, validateBankDetails, validateHelperRegistration } from '../../utils/validators';
import * as userController from './user.controller';

const router = Router();

// Get user profile
router.get('/profile', authMiddleware, userController.getUserProfile);

// Update user profile
router.put('/profile', authMiddleware, validateProfileUpdate, validate, userController.updateUserProfile);

// Register as helper
router.post('/register-helper', authMiddleware, validateHelperRegistration, validate, userController.registerAsHelper);

// Update bank details
router.put('/bank-details', authMiddleware, validateBankDetails, validate, userController.updateBankDetails);

// Upload profile photo
router.post('/upload-photo', authMiddleware, userController.uploadProfilePhoto);

// Upload KYC documents
router.post('/upload-kyc', authMiddleware, userController.uploadKYCDocuments);

// Get helper details
router.get('/helper/:helperId', userController.getHelperDetails);

// Search helpers
router.get('/search-helpers', userController.searchHelpers);

export default router;
