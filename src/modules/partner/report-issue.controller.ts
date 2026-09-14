/**
 * report-issue.controller.ts
 *
 * Partner (helper) can report a problem with a booking to admin/support.
 * Partners are NOT allowed to cancel bookings directly after accepting them —
 * this endpoint is the official escalation path.
 *
 * Route:  POST /api/partner/bookings/:bookingId/report-issue
 * Auth:   requireApprovedHelper
 */
import { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { prisma } from '../../prisma.client';
import { BookingStatus, UserRole } from '@prisma/client';
import logger from '../../utils/logger';
import { sendAlert } from '../../services/alert.service';
import { sendPushToRole } from '../../services/push.service';

// ── Allowed issue reasons ────────────────────────────────────────────────────

export const ALLOWED_ISSUE_REASONS = [
  'CUSTOMER_NOT_AVAILABLE',
  'WRONG_ADDRESS',
  'CUSTOMER_UNRESPONSIVE',
  'UNSAFE_LOCATION',
  'CUSTOMER_CANCEL_REQUEST',
  'OTHER',
] as const;

export type IssueReason = typeof ALLOWED_ISSUE_REASONS[number];

// ── Validation chain (attach directly to the route middleware stack) ─────────

export const validateReportIssue = [
  body('reason')
    .isIn(ALLOWED_ISSUE_REASONS)
    .withMessage(
      `reason must be one of: ${ALLOWED_ISSUE_REASONS.join(', ')}`
    ),
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('notes must be a string with max 1000 characters'),
];

// ── Handler ──────────────────────────────────────────────────────────────────

/**
 * POST /api/partner/bookings/:bookingId/report-issue
 *
 * Reports a booking issue to admin/support.
 *
 * Guards:
 *  • Partner must be the assigned helper of the booking (403)
 *  • Booking status must be CONFIRMED or IN_PROGRESS (422)
 *  • Only one active issue permitted per booking (409)
 *
 * Errors:
 *  400 — validation failure
 *  401 — unauthenticated
 *  403 — not the assigned helper
 *  404 — booking not found / helper profile not found
 *  409 — issue already reported for this booking
 *  422 — booking not in a reportable state
 *  500 — unexpected server error
 */
export const reportIssueHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  // ── 0. Auth ─────────────────────────────────────────────────────────────
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // ── 1. Input validation ──────────────────────────────────────────────────
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const bookingId = parseInt(req.params.bookingId, 10);
  if (isNaN(bookingId)) {
    return res.status(400).json({ success: false, message: 'Invalid bookingId' });
  }

  const { reason, notes } = req.body as { reason: IssueReason; notes?: string };
  const userId = parseInt(req.user.userId, 10);

  // ── 1b. Cross-field: OTHER requires notes ────────────────────────────────
  if (reason === 'OTHER' && (!notes || !notes.trim())) {
    return res.status(400).json({
      success: false,
      message: 'Notes are required when reason is OTHER',
    });
  }

  try {
    // ── 2. Resolve helper profile ──────────────────────────────────────────
    const helper = await prisma.helper.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!helper) {
      return res.status(404).json({ success: false, message: 'Helper profile not found' });
    }

    // ── 3. Fetch booking ───────────────────────────────────────────────────
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        helperId: true,
        status: true,
        _count: { select: { issues: true } },
      },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // ── 4. Ownership guard ─────────────────────────────────────────────────
    if (booking.helperId !== helper.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not the assigned helper for this booking',
      });
    }

    // ── 5. Status guard — only CONFIRMED or IN_PROGRESS ───────────────────
    const reportableStatuses: BookingStatus[] = [
      BookingStatus.CONFIRMED,
      BookingStatus.IN_PROGRESS,
    ];
    if (!reportableStatuses.includes(booking.status)) {
      return res.status(422).json({
        success: false,
        message: `Cannot report an issue for a booking with status ${booking.status}. Allowed: CONFIRMED, IN_PROGRESS`,
      });
    }

    // ── 6. Duplicate guard — only one open issue per booking ───────────────
    if (booking._count.issues > 0) {
      return res.status(409).json({
        success: false,
        message: 'An issue has already been reported for this booking',
      });
    }

    // ── 7. Persist issue ───────────────────────────────────────────────────
    const issue = await prisma.bookingIssue.create({
      data: {
        bookingId,
        helperId: helper.id,
        reason,
        notes: notes ?? null,
      },
      select: {
        id: true,
        bookingId: true,
        reason: true,
        notes: true,
        createdAt: true,
      },
    });

    logger.info('reportIssue: Issue reported by helper', {
      issueId: issue.id,
      bookingId,
      helperId: helper.id,
      reason,
    });

    // ── 8. Fire alert — non-blocking, never throws ────────────────────────
    sendAlert('BOOKING_ISSUE_REPORTED', {
      bookingId,
      helperId: helper.id,
      reason,
      notes: notes ?? null,
    }).catch((err) =>
      logger.error('reportIssue: Alert send failed (non-fatal)', { err })
    );

    // ── 9. Push notification to all admin users ───────────────────────────
    sendPushToRole(
      UserRole.ADMIN,
      'Booking Issue Reported',
      `Helper reported: ${reason} on booking #${bookingId}`,
      { type: 'BOOKING_ISSUE_REPORTED', bookingId: String(bookingId), reason },
      'BOOKING_ISSUE_REPORTED',
    ).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Issue reported to support team.',
      data: issue,
    });
  } catch (error) {
    logger.error('reportIssueHandler: Unexpected error', { bookingId, error });
    return res.status(500).json({ success: false, message: 'Failed to report issue' });
  }
};
