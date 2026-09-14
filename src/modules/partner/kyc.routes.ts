import { Router } from 'express';
import { authMiddleware, checkRole } from '../../middlewares/auth.middleware';
import { UserRole } from '@prisma/client';
import { upload, uploadImageOnly } from '../../middlewares/upload.middleware';
import { uploadSelfieImage, uploadPanImage, uploadPoliceDoc } from './kyc.controller';

const router = Router();

// Step 1 — POST /api/partner/kyc/upload-selfie  (JPEG / PNG only)
router.post(
  '/upload-selfie',
  authMiddleware,
  checkRole(UserRole.HELPER),
  uploadImageOnly.single('file'),
  uploadSelfieImage
);

// Step 2 — POST /api/partner/kyc/upload-pan  (JPEG / PNG only)
//   Uploads PAN card image to S3. No OCR or auto-verification.
router.post(
  '/upload-pan',
  authMiddleware,
  checkRole(UserRole.HELPER),
  uploadImageOnly.single('file'),
  uploadPanImage
);

// Step 3 — POST /api/partner/kyc/upload-police  (JPEG / PNG / PDF)
//   Admin reviews all documents manually.
router.post(
  '/upload-police',
  authMiddleware,
  checkRole(UserRole.HELPER),
  upload.single('file'),
  uploadPoliceDoc
);

export default router;
