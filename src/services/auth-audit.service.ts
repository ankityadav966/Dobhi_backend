/**
 * Auth Audit Service
 *
 * Appends immutable audit records for all authentication events.
 * Events: OTP_SENT | OTP_FAILED | OTP_VERIFIED | LOGIN_SUCCESS |
 *         TOKEN_REFRESH | LOGOUT | LOCKED_OUT
 *
 * Rules:
 * - OTP values are NEVER logged.
 * - Tokens are NEVER logged.
 * - Failures are non-blocking — audit errors must not break auth flows.
 */

import { prisma } from '../prisma.client';
import logger from '../utils/logger';

export type AuthEvent =
  | 'OTP_SENT'
  | 'OTP_FAILED'
  | 'OTP_VERIFIED'
  | 'LOGIN_SUCCESS'
  | 'TOKEN_REFRESH'
  | 'LOGOUT'
  | 'LOCKED_OUT'
  | 'KYC_SUBMITTED'
  | 'KYC_VERIFIED'
  | 'KYC_REVIEW_REQUIRED';

interface AuditContext {
  userId?: number;
  ip?: string;
  userAgent?: string;
}

/**
 * Write an audit entry. Fire-and-forget — never throws.
 */
export async function audit(
  phone: string,
  event: AuthEvent,
  ctx: AuditContext = {}
): Promise<void> {
  try {
    await prisma.authAudit.create({
      data: {
        phone,
        event,
        userId: ctx.userId ?? null,
        ip:        ctx.ip        ? ctx.ip.slice(0, 45)        : null, // IPv4/v6 max
        userAgent: ctx.userAgent ? ctx.userAgent.slice(0, 512) : null,
      },
    });
  } catch (err) {
    // Non-blocking: log but never fail the caller
    logger.error('AuthAudit write failed', { phone, event, err });
  }
}

/**
 * Extract IP and User-Agent from an Express request into the audit context shape.
 */
export function requestContext(req: { ip?: string; headers: Record<string, any> }): Pick<AuditContext, 'ip' | 'userAgent'> {
  const forwardedFor = req.headers['x-forwarded-for'];
  const ip = typeof forwardedFor === 'string'
    ? forwardedFor.split(',')[0].trim()
    : req.ip ?? undefined;

  const userAgent = typeof req.headers['user-agent'] === 'string'
    ? req.headers['user-agent']
    : undefined;

  return { ip, userAgent };
}
