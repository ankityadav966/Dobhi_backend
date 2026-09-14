/**
 * OTP Security Layer
 *
 * Responsibilities:
 * - Brute-force protection: lock phone after 3 failed OTP attempts for 15 min
 * - Resend cooldown: 60-second minimum between resends
 * - Resend rate cap: max 5 OTPs per hour per phone (rolling window)
 *
 * Backed by the OtpSecurity Prisma model.
 * All callers receive generic error messages — lock state is never disclosed.
 */

import { prisma } from '../prisma.client';
import logger from '../utils/logger';

const MAX_FAILED_ATTEMPTS  = 3;
const LOCK_DURATION_MS     = 15 * 60 * 1000; // 15 minutes
const RESEND_COOLDOWN_SEC  = 60;              // seconds
const RESEND_MAX_PER_HOUR  = 5;
const RESEND_WINDOW_MS     = 60 * 60 * 1000; // 1 hour

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getOrCreate(phone: string) {
  return prisma.otpSecurity.upsert({
    where: { phone },
    update: {},
    create: { phone },
  });
}

// ─── Lock checks ──────────────────────────────────────────────────────────────

/**
 * Returns true if the phone is currently locked.
 * Zero information is leaked about why.
 */
export async function isOtpLocked(phone: string): Promise<boolean> {
  try {
    const record = await prisma.otpSecurity.findUnique({ where: { phone } });
    if (!record?.lockedUntil) return false;
    if (new Date() < record.lockedUntil) return true;
    // Lock has expired — clear it
    await prisma.otpSecurity.update({
      where: { phone },
      data: { lockedUntil: null, failedAttempts: 0 },
    });
    return false;
  } catch (err) {
    logger.error('isOtpLocked check failed', { phone, err });
    return false; // fail open — don't block on DB error
  }
}

// ─── Attempt recording ────────────────────────────────────────────────────────

/**
 * Record a failed OTP attempt.
 * If attempts reach the threshold, lock the phone.
 */
export async function recordOtpFailure(phone: string): Promise<void> {
  try {
    const record = await getOrCreate(phone);
    const newCount = record.failedAttempts + 1;

    if (newCount >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
      await prisma.otpSecurity.update({
        where: { phone },
        data: { failedAttempts: newCount, lockedUntil },
      });
      logger.warn('OTP phone locked after failed attempts', {
        phone,
        attempts: newCount,
        lockedUntilEpoch: lockedUntil.getTime(),
      });
    } else {
      await prisma.otpSecurity.update({
        where: { phone },
        data: { failedAttempts: newCount },
      });
      logger.info('OTP failed attempt recorded', { phone, attempts: newCount });
    }
  } catch (err) {
    logger.error('recordOtpFailure failed', { phone, err });
  }
}

/**
 * Reset failure counter after a successful OTP verification.
 */
export async function recordOtpSuccess(phone: string): Promise<void> {
  try {
    await prisma.otpSecurity.upsert({
      where: { phone },
      update: { failedAttempts: 0, lockedUntil: null },
      create: { phone, failedAttempts: 0 },
    });
  } catch (err) {
    logger.error('recordOtpSuccess failed', { phone, err });
  }
}

// ─── Resend cooldown ──────────────────────────────────────────────────────────

/**
 * Check resend eligibility.
 * Returns { allowed: true } or { allowed: false, reason: string }.
 * The reason is for server-side logging only — DO NOT send to the client.
 */
export async function checkResendAllowed(phone: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const record = await prisma.otpSecurity.findUnique({ where: { phone } });
    if (!record) return { allowed: true };

    const now = Date.now();

    // 60-second cooldown between sends
    if (record.lastSentAt) {
      const elapsed = now - record.lastSentAt.getTime();
      if (elapsed < RESEND_COOLDOWN_SEC * 1000) {
        return { allowed: false, reason: `cooldown: ${Math.ceil((RESEND_COOLDOWN_SEC * 1000 - elapsed) / 1000)}s remaining` };
      }
    }

    // Rolling 1-hour window cap
    const windowStart = record.resendResetAt?.getTime() ?? 0;
    const withinWindow = windowStart > now - RESEND_WINDOW_MS;

    if (withinWindow && record.resendCount >= RESEND_MAX_PER_HOUR) {
      return { allowed: false, reason: `hourly cap: ${RESEND_MAX_PER_HOUR} OTPs/hr reached` };
    }

    return { allowed: true };
  } catch (err) {
    logger.error('checkResendAllowed failed', { phone, err });
    return { allowed: true }; // fail open
  }
}

/**
 * Record that an OTP was sent.
 * Updates lastSentAt and increments the rolling resend counter.
 */
export async function recordResendSent(phone: string): Promise<void> {
  try {
    const record = await prisma.otpSecurity.findUnique({ where: { phone } });
    const now = new Date();
    const windowStart = record?.resendResetAt?.getTime() ?? 0;
    const withinWindow = windowStart > now.getTime() - RESEND_WINDOW_MS;

    await prisma.otpSecurity.upsert({
      where: { phone },
      update: {
        lastSentAt: now,
        resendCount: withinWindow ? { increment: 1 } : 1,
        resendResetAt: withinWindow ? undefined : now,
      },
      create: {
        phone,
        lastSentAt: now,
        resendCount: 1,
        resendResetAt: now,
      },
    });
  } catch (err) {
    logger.error('recordResendSent failed', { phone, err });
  }
}
