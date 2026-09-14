import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma.client';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';
import logger from '../utils/logger';
import { UserRole, OnboardingStatus } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
  helper?: { id: number; onboardingStatus: OnboardingStatus; isAvailable: boolean };
  file?: any;
  files?: any;
}

// ─── Core auth middleware ─────────────────────────────────────────────────────

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      res.status(401).json({ success: false, message: 'Invalid or expired token' });
      return;
    }

    req.user = decoded;

    // Check suspension for HELPER role
    if (decoded.role === UserRole.HELPER) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: parseInt(decoded.userId, 10) },
          select: { suspendedUntil: true },
        });

        if (user?.suspendedUntil && new Date() < user.suspendedUntil) {
          logger.warn('Helper access blocked — suspended', {
            helperId: decoded.userId,
            suspendedUntil: user.suspendedUntil,
          });
          res.status(403).json({
            success: false,
            message: `Account suspended until ${user.suspendedUntil.toISOString()}.`,
            suspendedUntil: user.suspendedUntil,
          });
          return;
        }
      } catch (dbError) {
        logger.error('Error checking suspension status:', dbError);
        // Non-blocking — proceed
      }
    }

    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({ success: false, message: 'Authentication failed' });
  }
};

// ─── Optional auth ────────────────────────────────────────────────────────────

export const optionalAuthMiddleware = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const decoded = verifyAccessToken(authHeader.substring(7));
      if (decoded) {
        req.user = decoded;
      }
    }
    next();
  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    next();
  }
};

// ─── Role check ───────────────────────────────────────────────────────────────

/**
 * Role-based access control.
 * Partner backend only — valid roles are HELPER and ADMIN.
 */
export const checkRole = (...roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!(roles as string[]).includes(req.user.role)) {
      logger.warn('checkRole: Access denied', {
        userId: req.user.userId,
        userRole: req.user.role,
        requiredRoles: roles,
      });
      res.status(403).json({ success: false, message: 'Forbidden — partner access only' });
      return;
    }

    next();
  };
};

// ─── Approved helper gate ─────────────────────────────────────────────────────

/**
 * requireApprovedHelper
 *
 * Composite middleware that enforces:
 *   1. Valid JWT
 *   2. JWT role === HELPER  (fast path)
 *   3. User.role === HELPER from DB  (single source of truth — prevents stale-token escalation)
 *   4. User.isActive === true  (account not suspended by admin)
 *   5. User.suspendedUntil has not passed
 *   6. Helper record exists for User.id
 *   7. Helper.onboardingStatus === APPROVED
 *
 * Attaches the Helper record to req.helper for downstream use.
 * Apply to all operational routes (bookings, payments, location).
 * Do NOT apply to onboarding routes.
 */
export const requireApprovedHelper = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Verify JWT
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'No token provided' });
      return;
    }

    const decoded = verifyAccessToken(authHeader.substring(7));
    if (!decoded) {
      res.status(401).json({ success: false, message: 'Invalid or expired token' });
      return;
    }

    // 2. Quick role check from JWT  (fail fast before DB hit)
    if (decoded.role !== UserRole.HELPER) {
      res.status(403).json({ success: false, message: 'Forbidden — helper access only' });
      return;
    }

    req.user = decoded;
    const userId = parseInt(decoded.userId, 10);

    // 3. DB role validation + suspension check
    //    User.role is the single source of truth — JWT role alone is not sufficient.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true, suspendedUntil: true },
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }

    // Confirm DB role — prevents privilege escalation via stale/tampered tokens
    if (user.role !== UserRole.HELPER) {
      logger.warn('requireApprovedHelper: DB role mismatch', {
        userId,
        dbRole:  user.role,
        jwtRole: decoded.role,
      });
      res.status(403).json({ success: false, message: 'Forbidden — helper access only' });
      return;
    }

    // isActive = account not suspended by admin (separate from onboardingStatus)
    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: 'Account not yet active. Please complete onboarding and wait for approval.',
      });
      return;
    }

    if (user.suspendedUntil && new Date() < user.suspendedUntil) {
      res.status(403).json({
        success: false,
        message: `Account suspended until ${user.suspendedUntil.toISOString()}.`,
        suspendedUntil: user.suspendedUntil,
      });
      return;
    }

    // 4 & 5. Helper must exist and be APPROVED
    const helper = await prisma.helper.findUnique({
      where: { userId },
      select: { id: true, onboardingStatus: true, isAvailable: true },
    });

    if (!helper) {
      res.status(403).json({
        success: false,
        message: 'Helper profile not found. Please complete onboarding.',
      });
      return;
    }

    if (helper.onboardingStatus !== OnboardingStatus.APPROVED) {
      res.status(403).json({
        success: false,
        message: `Onboarding not approved. Current status: ${helper.onboardingStatus}`,
        onboardingStatus: helper.onboardingStatus,
      });
      return;
    }

    req.helper = helper;
    // Attach helperId to req.user for downstream APIs
    if (req.user) {
      req.user.helperId = helper.id;
    }
    next();
  } catch (error) {
    logger.error('requireApprovedHelper error:', error);
    res.status(500).json({ success: false, message: 'Authentication failed' });
  }
};
