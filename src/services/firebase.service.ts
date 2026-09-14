/**
 * firebase.service.ts
 *
 * Firebase Admin SDK initializer.
 * Called once at server startup from app.ts / server.ts.
 * All other modules import getMessaging() to send FCM messages.
 *
 * Required env vars:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY   (newlines encoded as \n)
 */
import * as admin from 'firebase-admin';
import logger from '../utils/logger';

let _initialized = false;

/**
 * Initialize Firebase Admin SDK from environment variables.
 * Safe to call multiple times — only initialises once.
 * If credentials are absent warns and returns; push notifications are silently skipped.
 */
export function initializeFirebase(): void {
  if (_initialized) return;

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    logger.warn(
      'Firebase credentials not configured (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY). ' +
      'Push notifications will be silently skipped.'
    );
    return;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        // Private key is stored with literal \n in .env; restore real newlines.
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });

    _initialized = true;
    logger.info('Firebase Admin SDK initialized', { projectId });
  } catch (error) {
    logger.error('Firebase Admin SDK initialization failed', { error });
    // Do not rethrow — push is optional, never crash the server for it
  }
}

/** Returns true if Firebase was successfully initialized. */
export function isFirebaseReady(): boolean {
  return _initialized;
}

/**
 * Returns the Firebase Messaging instance.
 * Returns null if Firebase is not initialized (e.g. credentials missing in dev).
 */
export function getFirebaseMessaging(): admin.messaging.Messaging | null {
  if (!_initialized) return null;
  return admin.messaging();
}
