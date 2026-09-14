/**
 * work-photos.controller.ts
 *
 * Handles before/after work photo uploads for bookings.
 *
 * POST /api/partner/bookings/:bookingId/before-photos
 *   - Auth: requireApprovedHelper
 *   - Multer: uploadImageOnly.array('photos', 5)
 *   - Booking must be IN_PROGRESS and owned by the requesting helper
 *   - Uploads each image to S3 under partner/<helperId>/work-photos/<bookingId>/before/
 *   - Stores all PhotoUrls atomically inside a single Prisma transaction
 *
 * POST /api/partner/bookings/:bookingId/after-photos
 *   - Same auth/ownership/status guards as before-photos
 *   - Additionally requires jobTimerStarted = true (timer must be running)
 *   - Uploads to partner/<helperId>/work-photos/<bookingId>/after/
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { uploadToCloudinary } from '../../utils/cloudinary';
import logger from '../../utils/logger';
import { BookingStatus, WorkPhotoType } from '@prisma/client';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_PHOTOS = 5;

// ─── Controller ───────────────────────────────────────────────────────────────

/**
 * POST /api/partner/bookings/:bookingId/before-photos
 *
 * Upload "before work" photos for an IN_PROGRESS booking.
 *
 * Content-Type : multipart/form-data
 * Field name   : "photos" (multiple files)
 * Max files    : 5
 * Allowed types: JPEG, PNG (enforced by uploadImageOnly middleware)
 * Max size/file: 5 MB (enforced by multer)
 *
 * Errors:
 *  400 — no files provided, too many files
 *  403 — not the assigned helper for this booking
 *  404 — booking not found
 *  409 — booking is not IN_PROGRESS
 *  500 — S3 or DB failure
 */
export const uploadBeforePhotos = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // ── 1. Parse & validate input ─────────────────────────────────────────────

    const bookingId = parseInt(req.params.bookingId, 10);
    if (isNaN(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid bookingId' });
    }

    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one photo is required' });
    }

    if (files.length > MAX_PHOTOS) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_PHOTOS} photos allowed per upload`,
      });
    }

    // ── 2. Resolve the Helper row tied to the authenticated user ──────────────

    const userId = parseInt(req.user.userId, 10);
    const helper = await prisma.helper.findUnique({
      where:  { userId },
      select: { id: true },
    });

    if (!helper) {
      return res.status(403).json({ success: false, message: 'Helper profile not found' });
    }

    // ── 3. Fetch booking and validate ownership + status ──────────────────────

    const booking = await prisma.booking.findUnique({
      where:  { id: bookingId },
      select: { id: true, helperId: true, status: true },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.helperId !== helper.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not the assigned helper for this booking',
      });
    }

    if (booking.status !== BookingStatus.IN_PROGRESS) {
      return res.status(409).json({
        success: false,
        message: `Before photos can only be uploaded when booking is IN_PROGRESS (current: ${booking.status})`,
      });
    }

    // ── 4. Upload all files to S3 (in parallel) ───────────────────────────────

    const folder = `dobhi/work-photos/helper_${helper.id}/${bookingId}/before`;

    const uploadResults = await Promise.all(
      files.map((file) =>
        uploadToCloudinary(file.buffer, { folder })
      )
    );

    const photoUrls = uploadResults.map((r) => r.secureUrl);

    // ── 5. Persist to DB inside a single transaction ──────────────────────────

    const savedPhotos = await prisma.$transaction(
      photoUrls.map((photoUrl) =>
        prisma.bookingWorkPhoto.create({
          data: {
            bookingId,
            photoUrl,
            type: WorkPhotoType.BEFORE,
          },
        })
      )
    );

    logger.info('[work-photos] before photos uploaded', {
      bookingId,
      helperId:   helper.id,
      photoCount: savedPhotos.length,
    });

    return res.status(201).json({
      success: true,
      message: 'Before work photos uploaded',
      data: {
        photos: savedPhotos.map((p) => ({
          id:        p.id,
          photoUrl:  p.photoUrl,
          type:      p.type,
          createdAt: p.createdAt,
        })),
      },
    });
  } catch (error) {
    logger.error('[work-photos] uploadBeforePhotos error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ success: false, message: 'Failed to upload photos' });
  }
};

// ─── After-photos ─────────────────────────────────────────────────────────────

/**
 * POST /api/partner/bookings/:bookingId/after-photos
 *
 * Upload "after work" completion photos for an IN_PROGRESS booking.
 *
 * Content-Type : multipart/form-data
 * Field name   : "photos" (multiple files)
 * Max files    : 5
 * Allowed types: JPEG, PNG (enforced by uploadImageOnly middleware)
 * Max size/file: 5 MB (enforced by multer)
 *
 * Errors:
 *  400 — no files provided, too many files
 *  403 — not the assigned helper for this booking
 *  404 — booking not found
 *  409 — booking is not IN_PROGRESS, or job timer has not been started
 *  500 — S3 or DB failure
 */
export const uploadAfterPhotos = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // ── 1. Parse & validate input ─────────────────────────────────────────────

    const bookingId = parseInt(req.params.bookingId, 10);
    if (isNaN(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid bookingId' });
    }

    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one photo is required' });
    }

    if (files.length > MAX_PHOTOS) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_PHOTOS} photos allowed per upload`,
      });
    }

    // ── 2. Resolve the Helper row tied to the authenticated user ────────────────

    const userId = parseInt(req.user.userId, 10);
    const helper = await prisma.helper.findUnique({
      where:  { userId },
      select: { id: true },
    });

    if (!helper) {
      return res.status(403).json({ success: false, message: 'Helper profile not found' });
    }

    // ── 3. Fetch booking and validate ownership + status + timer ──────────────

    const booking = await prisma.booking.findUnique({
      where:  { id: bookingId },
      select: { id: true, helperId: true, status: true, jobTimerStarted: true },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.helperId !== helper.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not the assigned helper for this booking',
      });
    }

    if (booking.status !== BookingStatus.IN_PROGRESS) {
      return res.status(409).json({
        success: false,
        message: `After photos can only be uploaded when booking is IN_PROGRESS (current: ${booking.status})`,
      });
    }

    if (!booking.jobTimerStarted) {
      return res.status(409).json({
        success: false,
        message: 'Job timer must be started before uploading after photos',
      });
    }

    // ── 4. Upload all files to S3 (in parallel) ───────────────────────────

    const folder = `dobhi/work-photos/helper_${helper.id}/${bookingId}/after`;

    const uploadResults = await Promise.all(
      files.map((file) => uploadToCloudinary(file.buffer, { folder }))
    );

    const photoUrls = uploadResults.map((r) => r.secureUrl);

    // ── 5. Persist to DB inside a single transaction ────────────────────────

    const savedPhotos = await prisma.$transaction(
      photoUrls.map((photoUrl) =>
        prisma.bookingWorkPhoto.create({
          data: {
            bookingId,
            photoUrl,
            type: WorkPhotoType.AFTER,
          },
        })
      )
    );

    logger.info('[work-photos] after photos uploaded', {
      bookingId,
      helperId:   helper.id,
      photoCount: savedPhotos.length,
    });

    return res.status(201).json({
      success: true,
      message: 'After work photos uploaded',
      data: {
        photos: savedPhotos.map((p) => ({
          id:        p.id,
          photoUrl:  p.photoUrl,
          type:      p.type,
          createdAt: p.createdAt,
        })),
      },
    });
  } catch (error) {
    logger.error('[work-photos] uploadAfterPhotos error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ success: false, message: 'Failed to upload photos' });
  }
};
