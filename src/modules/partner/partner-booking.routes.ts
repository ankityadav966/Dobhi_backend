/**
 * partner-booking.routes.ts
 *
 * Helper booking routes.
 * Mounted at /api/partner/bookings via modules/partner/index.ts
 */
import { Router } from 'express';
import { requireApprovedHelper } from '../../middlewares/auth.middleware';
import { validate, validateBookingId } from '../../utils/validators';
import { uploadImageOnly } from '../../middlewares/upload.middleware';
import {
  getBookingByIdHandler,
  getHelperBookingsHandler,
  startBookingWithOtpHandler,
  regenerateOtpHandler,
  completeBookingHandler,
  startTimerHandler,
} from './partner-booking.controller';
import { getBookingHistoryHandler } from './booking-history.controller';
import { uploadBeforePhotos, uploadAfterPhotos } from './work-photos.controller';
import { validateReportIssue, reportIssueHandler } from './report-issue.controller';

const router = Router();

import { getUpcomingHelperBookingsHandler } from './partner-booking-upcoming.controller';

// Static routes MUST be defined BEFORE dynamic routes to prevent :bookingId from catching them
// GET /api/partner/bookings/history — past jobs (COMPLETED/CANCELLED only)
router.get('/history', requireApprovedHelper, getBookingHistoryHandler);

// GET /api/partner/bookings/upcoming — upcoming bookings for helper
router.get('/upcoming', requireApprovedHelper, getUpcomingHelperBookingsHandler);

// GET /api/partner/bookings       — helper's assigned bookings (paginated)
router.get('/', requireApprovedHelper, getHelperBookingsHandler);

// GET /api/partner/bookings/:bookingId  — single booking detail (auth + ownership enforced)
router.get('/:bookingId', requireApprovedHelper, validateBookingId, validate, getBookingByIdHandler);

// POST /api/partner/bookings/:bookingId/start  — OTP-based service start
// Helper submits the 4-digit OTP displayed on the customer app to begin the job.
router.post(
  '/:bookingId/start',
  requireApprovedHelper,
  validateBookingId,
  validate,
  startBookingWithOtpHandler
);

// POST /api/partner/bookings/:bookingId/regenerate-otp  — re-issue expired OTP
// Helper requests a new OTP when the previous one expired (> 30 min).
router.post(
  '/:bookingId/regenerate-otp',
  requireApprovedHelper,
  validateBookingId,
  validate,
  regenerateOtpHandler
);

// POST /api/partner/bookings/:bookingId/complete  — mark booking as completed
// Only the assigned helper may complete an IN_PROGRESS booking.
router.post(
  '/:bookingId/complete',
  requireApprovedHelper,
  validateBookingId,
  validate,
  completeBookingHandler
);

// POST /api/partner/bookings/:bookingId/before-photos
// Upload before-work photos (max 5, JPEG/PNG, 5 MB each) for an IN_PROGRESS booking.
// Photos are streamed to S3 and URLs stored in BookingWorkPhoto.
router.post(
  '/:bookingId/before-photos',
  requireApprovedHelper,
  validateBookingId,
  validate,
  uploadImageOnly.array('photos', 5),
  uploadBeforePhotos
);

// POST /api/partner/bookings/:bookingId/start-timer
// Start the job timer. Requires at least one BEFORE photo uploaded and booking IN_PROGRESS.
// Can only be triggered once per booking.
router.post(
  '/:bookingId/start-timer',
  requireApprovedHelper,
  validateBookingId,
  validate,
  startTimerHandler
);

// POST /api/partner/bookings/:bookingId/after-photos
// Upload after-work completion photos (max 5, JPEG/PNG, 5 MB each).
// Requires booking IN_PROGRESS and job timer already started.
router.post(
  '/:bookingId/after-photos',
  requireApprovedHelper,
  validateBookingId,
  validate,
  uploadImageOnly.array('photos', 5),
  uploadAfterPhotos
);

// POST /api/partner/bookings/:bookingId/report-issue
// Partner reports a problem to admin/support.
// Allowed statuses: CONFIRMED, IN_PROGRESS. Only one issue per booking.
// Partner cannot self-cancel; this is the official escalation path.
router.post(
  '/:bookingId/report-issue',
  requireApprovedHelper,
  validateBookingId,
  ...validateReportIssue,
  validate,
  reportIssueHandler
);

export default router;
