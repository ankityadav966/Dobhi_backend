/**
 * notification.routes.ts
 *
 * Push notification device token management.
 * Mounted at /api/notifications via app.ts
 *
 * Routes:
 *   POST   /api/notifications/register-device   — register FCM token
 *   DELETE /api/notifications/register-device   — remove FCM token on logout
 */
import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import {
  validateRegisterDevice,
  registerDeviceHandler,
  unregisterDeviceHandler,
  getNotificationsHandler,
  markAllNotificationsReadHandler,
  markNotificationReadHandler,
} from './notification.controller';

const router = Router();

// All notification routes require authentication
router.use(authMiddleware);

/**
 * POST /api/notifications/register-device
 * Body: { token: string, platform: "ANDROID" | "IOS" | "WEB" }
 * Upserts the device token for the authenticated user.
 */
router.post('/register-device', ...validateRegisterDevice, registerDeviceHandler);

/**
 * DELETE /api/notifications/register-device
 * Body: { token: string }
 * Removes the device token (call on logout to stop pushes to that device).
 */
router.delete('/register-device', ...validateRegisterDevice, unregisterDeviceHandler);

/**
 * GET /api/notifications
 * Query: page (default 1), limit (default 20)
 * Returns paginated notification history for the authenticated user.
 */
router.get('/', getNotificationsHandler);

/**
 * PATCH /api/notifications/read-all
 * Marks all notifications as read for the authenticated user.
 */
router.patch('/read-all', markAllNotificationsReadHandler);

/**
 * PATCH /api/notifications/:notificationId/read
 * Marks a single notification as read. Returns 404 if not found or not owned by the user.
 */
router.patch('/:notificationId/read', markNotificationReadHandler);

export default router;
