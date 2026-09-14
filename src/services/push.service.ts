/**
 * push.service.ts
 *
 * Reusable push-notification helpers built on top of Firebase Cloud Messaging (FCM).
 *
 * Public API:
 *   sendPushNotification(userId, title, body, data?, type?)
 *     — send to all registered devices of one user
 *
 *   sendPushToMany(userIds, title, body, data?, type?)
 *     — batch send to multiple users
 *
 *   sendPushToRole(role, title, body, data?, type?)
 *     — broadcast to all users with a given role (e.g. all ADMINs)
 *
 *   sendPushToHelperIds(helperIds, title, body, data?, type?)
 *     — convenience overload: takes Helper.id array, resolves → User.id, then sends
 *
 * Design principles:
 *   • Never throws — all errors are logged internally; caller fire-and-forgets
 *   • Stale / invalid FCM tokens are removed from the database automatically
 *   • Every sent notification is written to NotificationLog for audit / history
 */
import { getFirebaseMessaging } from './firebase.service';
import { prisma } from '../prisma.client';
import { UserRole } from '@prisma/client';
import logger from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

type StringRecord = Record<string, string>;

// FCM token error codes that indicate a permanently dead token
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

// ─── Core send ────────────────────────────────────────────────────────────────

/**
 * Send a push notification to every registered device of a single user.
 * After sending, expired tokens are pruned and the notification is logged.
 *
 * @param userId  User.id (not Helper.id)
 * @param title   Notification title
 * @param body    Notification body text
 * @param data    Optional key-value pairs forwarded to the client app
 * @param type    Notification type string stored in the log (e.g. 'JOB_STARTED')
 */
export async function sendPushNotification(
  userId: number,
  title: string,
  body: string,
  data: StringRecord = {},
  type = 'GENERAL',
): Promise<void> {
  try {
    const messaging = getFirebaseMessaging();
    if (!messaging) return; // Firebase not configured — silent no-op

    // ── 1. Fetch tokens ──────────────────────────────────────────────────
    const rows = await prisma.deviceToken.findMany({
      where: { userId },
      select: { id: true, token: true },
    });
    if (rows.length === 0) return;

    const tokens = rows.map(r => r.token);

    // ── 2. Build & send multicast message ────────────────────────────────
    const message: import('firebase-admin').messaging.MulticastMessage = {
      tokens,
      notification: { title, body },
      data: { ...data, type },
      android: {
        priority: 'high',
        notification: { sound: 'default' },
      },
      apns: {
        payload: {
          aps: { sound: 'default', badge: 1 },
        },
      },
    };

    const batchResponse = await messaging.sendEachForMulticast(message);

    // ── 3. Prune dead tokens ──────────────────────────────────────────────
    const deadTokenIds: number[] = [];
    batchResponse.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        const code = resp.error.code ?? '';
        if (DEAD_TOKEN_CODES.has(code)) {
          deadTokenIds.push(rows[idx].id);
          logger.warn('push: removing dead FCM token', {
            userId,
            tokenId: rows[idx].id,
            errorCode: code,
          });
        }
      }
    });

    if (deadTokenIds.length > 0) {
      await prisma.deviceToken.deleteMany({ where: { id: { in: deadTokenIds } } });
    }

    // ── 4. Log notification ───────────────────────────────────────────────
    await prisma.notificationLog.create({
      data: {
        userId,
        title,
        body,
        type,
        data: { ...data } as object,
      },
    });

    logger.info('push: notification sent', {
      userId,
      type,
      successCount: batchResponse.successCount,
      failureCount: batchResponse.failureCount,
    });
  } catch (error) {
    // Never propagate — push must not crash the caller
    logger.error('push: sendPushNotification failed', { userId, type, error });
  }
}

// ─── Multi-user helpers ───────────────────────────────────────────────────────

/**
 * Send the same notification to multiple users.
 * Runs sends concurrently (Promise.allSettled — failures don't cancel others).
 */
export async function sendPushToMany(
  userIds: number[],
  title: string,
  body: string,
  data: StringRecord = {},
  type = 'GENERAL',
): Promise<void> {
  if (userIds.length === 0) return;
  await Promise.allSettled(
    userIds.map(uid => sendPushNotification(uid, title, body, data, type))
  );
}

/**
 * Broadcast to every user that holds the given role.
 * Useful for notifying all admins about an issue.
 */
export async function sendPushToRole(
  role: UserRole,
  title: string,
  body: string,
  data: StringRecord = {},
  type = 'GENERAL',
): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where:  { role },
      select: { id: true },
    });
    if (users.length === 0) return;
    await sendPushToMany(
      users.map(u => u.id),
      title,
      body,
      data,
      type,
    );
  } catch (error) {
    logger.error('push: sendPushToRole failed', { role, type, error });
  }
}

/**
 * Send to a list of Helper.id values.
 * Resolves Helper.id → User.id in a single batched query before sending.
 */
export async function sendPushToHelperIds(
  helperIds: number[],
  title: string,
  body: string,
  data: StringRecord = {},
  type = 'GENERAL',
): Promise<void> {
  try {
    if (helperIds.length === 0) return;
    const helpers = await prisma.helper.findMany({
      where:  { id: { in: helperIds } },
      select: { userId: true },
    });
    const userIds = helpers.map(h => h.userId);
    await sendPushToMany(userIds, title, body, data, type);
  } catch (error) {
    logger.error('push: sendPushToHelperIds failed', { type, error });
  }
}
