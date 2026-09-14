/**
 * kyc.controller.ts
 *
 * Three-step KYC upload flow:
 *
 *   Step 1 — POST /api/partner/kyc/upload-selfie
 *             Upload selfie photo.  Stores selfieUrl.
 *
 *   Step 2 — POST /api/partner/kyc/upload-pan
 *             Upload PAN card image.  Stores panUrl. No OCR or auto-verification.
 *
 *   Step 3 — POST /api/partner/kyc/upload-police
 *             Upload police verification document.  Stores policeUrl.
 *
 * Admin reviews all three documents manually and approves/rejects the helper.
 *
 * SECURITY:
 *   - File buffers are never written to disk; streamed directly to S3.
 */

import { Response } from 'express';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { uploadToCloudinary } from '../../utils/cloudinary';
import { OnboardingStatus } from '@prisma/client';

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Resolve the Helper row for the authenticated user. Returns null if not found. */
async function resolveHelper(userId: number) {
  return prisma.helper.findUnique({
    where:  { userId },
    select: { id: true, onboardingStatus: true },
  });
}

/**
 * Standard guard: writes the error response and returns true when the
 * request should be aborted.  Caller must `return` after a truthy result.
 */
function earlyExit(
  res:     Response,
  helper:  { onboardingStatus: string } | null,
  hasUser: boolean
): boolean {
  if (!hasUser) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return true;
  }
  if (!helper) {
    res.status(403).json({ success: false, message: 'Helper profile not found' });
    return true;
  }
  if (helper.onboardingStatus === OnboardingStatus.APPROVED) {
    res.status(409).json({ success: false, message: 'Partner is already approved' });
    return true;
  }
  return false;
}

// ─── Step 1: Upload selfie ────────────────────────────────────────────────────

/**
 * POST /api/partner/kyc/upload-selfie
 * Content-Type: multipart/form-data   field: "file"   (JPEG or PNG)
 *
 * Upload a selfie photo.  Must be completed before verify-pan.
 */
export const uploadSelfieImage = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const userId = parseInt(req.user!.userId, 10);
    const helper = await resolveHelper(userId);

    if (earlyExit(res, helper, !!req.user)) return;

    const { secureUrl: s3Url } = await uploadToCloudinary(
      req.file.buffer,
      { folder: `dobhi/kyc/helper_${helper!.id}/selfie` }
    );

    await prisma.helperKyc.upsert({
      where:  { helperId: helper!.id },
      update: { selfieUrl: s3Url },
      create: { helperId: helper!.id, selfieUrl: s3Url },
    });

    logger.info('KYC selfie uploaded', {
      userId,
      helperId:  helper!.id,
      mimeType:  req.file.mimetype,
      sizeBytes: req.file.size,
    });

    return res.status(200).json({ success: true, data: { selfieUrl: s3Url } });
  } catch (error) {
    logger.error('uploadSelfieImage error', { error: (error as Error).message });
    return res.status(500).json({ success: false, message: 'Failed to upload selfie' });
  }
};

// ─── Step 2: Upload PAN image ────────────────────────────────────────────────

/**
 * POST /api/partner/kyc/upload-pan
 * Content-Type: multipart/form-data   field: "file"   (JPEG or PNG of PAN card)
 *
 * Uploads the PAN card image to Cloudinary and stores the URL.
 * No OCR, no auto-verification — admin reviews the document manually.
 */
export const uploadPanImage = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const userId = parseInt(req.user!.userId, 10);
    const helper = await resolveHelper(userId);

    if (earlyExit(res, helper, !!req.user)) return;

    const helperId = helper!.id;

    const { secureUrl: panS3Url } = await uploadToCloudinary(
      req.file.buffer,
      { folder: `dobhi/kyc/helper_${helperId}/pan` }
    );

    await prisma.helperKyc.upsert({
      where:  { helperId },
      update: { panUrl: panS3Url },
      create: { helperId, panUrl: panS3Url },
    });

    logger.info('KYC PAN document uploaded', {
      userId,
      helperId,
      mimeType:  req.file.mimetype,
      sizeBytes: req.file.size,
    });

    return res.status(200).json({
      success: true,
      message: 'PAN document uploaded successfully',
    });
  } catch (error) {
    logger.error('uploadPanImage error', { error: (error as Error).message });
    return res.status(500).json({ success: false, message: 'Failed to upload PAN document' });
  }
};

// ─── Step 3: Upload police document ──────────────────────────────────────────

/**
 * POST /api/partner/kyc/upload-police
 * Content-Type: multipart/form-data   field: "file"   (JPEG, PNG, or PDF)
 *
 * Upload police verification document.
 * No PAN verification gate — police doc may be uploaded at any point
 * during onboarding. Admin reviews selfie + PAN + police doc together.
 */
export const uploadPoliceDoc = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const userId = parseInt(req.user!.userId, 10);
    const helper = await resolveHelper(userId);

    if (earlyExit(res, helper, !!req.user)) return;

    const helperId = helper!.id;

    // ── Upload to Cloudinary ──────────────────────────────────────────────────
    const { secureUrl: s3Url } = await uploadToCloudinary(
      req.file.buffer,
      {
        folder: `dobhi/kyc/helper_${helperId}/police`,
        resourceType: req.file.mimetype === 'application/pdf' ? 'auto' : 'image',
      }
    );

    await prisma.helperKyc.update({
      where: { helperId },
      data:  { policeUrl: s3Url },
    });

    logger.info('KYC police document uploaded', {
      userId,
      helperId,
      mimeType:  req.file.mimetype,
      sizeBytes: req.file.size,
    });

    return res.status(200).json({ success: true, data: { policeUrl: s3Url } });
  } catch (error) {
    logger.error('uploadPoliceDoc error', { error: (error as Error).message });
    return res.status(500).json({ success: false, message: 'Failed to upload police document' });
  }
};
