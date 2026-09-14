/**
 * notification.controller.ts
 *
 * Handles device token registration for push notifications.
 *
 * Route:  POST /api/notifications/register-device
 * Auth:   Any authenticated user (customer, helper, or admin)
 */
import { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';

const ALLOWED_PLATFORMS = ['ANDROID', 'IOS', 'WEB'] as const;

// ── Validation chain ─────────────────────────────────────────────────────────

export const validateRegisterDevice = [
  body('token')
    .isString()
    .notEmpty()
    .isLength({ min: 10, max: 512 })
    .withMessage('token must be a non-empty string (10–512 chars)'),
  body('platform')
    .isIn(ALLOWED_PLATFORMS)
    .withMessage(`platform must be one of: ${ALLOWED_PLATFORMS.join(', ')}`),
];

// ── Handler ──────────────────────────────────────────────────────────────────

/**
 * POST /api/notifications/register-device
 *
 * Upserts the FCM device token for the authenticated user.
 * If the token already exists (any user), it is re-assigned to the current user.
 * Duplicate tokens across users are prevented via @unique on DeviceToken.token.
 *
 * Errors:
 *  400 — validation failure
 *  401 — unauthenticated
 *  500 — unexpected error
 */
export const registerDeviceHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const userId   = parseInt(req.user.userId, 10);
  const { token, platform } = req.body as { token: string; platform: string };

  try {
    // Upsert: if the token already exists update platform + userId, otherwise create.
    // This handles token recycling by FCM and cross-device re-registration gracefully.
    await prisma.deviceToken.upsert({
      where:  { token },
      update: { userId, platform },
      create: { userId, token, platform },
    });

    logger.info('registerDevice: token registered', { userId, platform });

    return res.status(200).json({
      success: true,
      message: 'Device registered for push notifications',
    });
  } catch (error) {
    logger.error('registerDeviceHandler: unexpected error', { userId, error });
    return res.status(500).json({ success: false, message: 'Failed to register device' });
  }
};

// ── Delete device token (logout / revoke) ────────────────────────────────────

/**
 * DELETE /api/notifications/register-device
 *
 * Removes the device token on logout so the device stops receiving pushes.
 * Body: { token: string }
 */
export const unregisterDeviceHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const userId = parseInt(req.user.userId, 10);
  const { token } = req.body as { token: string };

  try {
    await prisma.deviceToken.deleteMany({ where: { token, userId } });
    return res.status(200).json({ success: true, message: 'Device unregistered' });
  } catch (error) {
    logger.error('unregisterDeviceHandler: unexpected error', { userId, error });
    return res.status(500).json({ success: false, message: 'Failed to unregister device' });
  }
};

// ── Get notifications ────────────────────────────────────────────────────────

/**
 * GET /api/notifications
 *
 * Returns a paginated list of notifications for the authenticated user.
 * Query params: page (default 1), limit (default 20)
 */
export const getNotificationsHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const userId = parseInt(req.user.userId, 10);
  const page  = Math.max(1, parseInt((req.query.page  as string) || '1',  10) || 1);
  const limit = Math.max(1, parseInt((req.query.limit as string) || '20', 10) || 20);

  try {
    const notifications = await prisma.notificationLog.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
    });

    logger.info('getNotifications: fetched', { userId, page, limit, count: notifications.length });

    return res.status(200).json({
      success: true,
      data: notifications,
      pagination: { page, limit },
    });
  } catch (error) {
    logger.error('getNotificationsHandler: unexpected error', { userId, error });
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

// ── Mark all notifications read ──────────────────────────────────────────────

/**
 * PATCH /api/notifications/read-all
 *
 * Sets isRead = true on every unread notification belonging to the authenticated user.
 */
export const markAllNotificationsReadHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const userId = parseInt(req.user.userId, 10);

  try {
    const { count } = await prisma.notificationLog.updateMany({
      where: { userId, isRead: false },
      data:  { isRead: true },
    });

    logger.info('markAllNotificationsRead: updated', { userId, count });

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    logger.error('markAllNotificationsReadHandler: unexpected error', { userId, error });
    return res.status(500).json({ success: false, message: 'Failed to mark notifications as read' });
  }
};

// ── Mark single notification read ────────────────────────────────────────────

/**
 * PATCH /api/notifications/:notificationId/read
 *
 * Sets isRead = true on a single notification.
 * Returns 404 if the notification does not exist or does not belong to the user.
 */
export const markNotificationReadHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const userId         = parseInt(req.user.userId, 10);
  const notificationId = parseInt(req.params.notificationId, 10);

  if (isNaN(notificationId)) {
    return res.status(400).json({ success: false, message: 'Invalid notificationId' });
  }

  try {
    // Confirm ownership before updating — prevents one user marking another's notification
    const existing = await prisma.notificationLog.findFirst({
      where: { id: notificationId, userId },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    await prisma.notificationLog.update({
      where: { id: notificationId },
      data:  { isRead: true },
    });

    logger.info('markNotificationRead: updated', { userId, notificationId });

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    logger.error('markNotificationReadHandler: unexpected error', { userId, notificationId, error });
    return res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
  }
};
