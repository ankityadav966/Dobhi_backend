/**
 * helper-status.controller.ts
 *
 * PATCH /api/helper/status  — toggle isOnline for the authenticated helper
 *
 * Business rules:
 *   • Cannot go ONLINE if account is suspended (User.suspendedUntil > now)
 *   • Cannot go OFFLINE if there is an IN_PROGRESS booking (guard with `force` flag)
 *   • Sets Helper.isOnline and touches Helper.lastActiveAt
 */

import { Response } from 'express';
import { prisma } from '../../prisma.client';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { resolveHelperId } from '../../services/earnings.service';
import { BookingStatus } from '@prisma/client';
import logger from '../../utils/logger';

export const toggleOnlineStatus = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = parseInt(req.user!.userId, 10);

    // Resolve helper id
    const helperId = await resolveHelperId(userId);
    if (!helperId) {
      res.status(404).json({ success: false, message: 'Helper profile not found' });
      return;
    }

    const { isOnline } = req.body as { isOnline: boolean };
    if (typeof isOnline !== 'boolean') {
      res.status(400).json({ success: false, message: '`isOnline` must be a boolean' });
      return;
    }

    // ── Guard: suspended helpers may not come online ──────────────────────────
    if (isOnline) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { suspendedUntil: true },
      });
      if (user?.suspendedUntil && new Date() < user.suspendedUntil) {
        res.status(403).json({
          success: false,
          message: `Account suspended until ${user.suspendedUntil.toISOString()}. Cannot come online.`,
          suspendedUntil: user.suspendedUntil,
        });
        return;
      }
    }

    // ── Guard: cannot go offline mid-job unless forced ────────────────────────
    if (!isOnline) {
      const force = req.body.force === true;
      if (!force) {
        const activeJob = await prisma.booking.findFirst({
          where: { helperId, status: BookingStatus.IN_PROGRESS },
          select: { id: true },
        });
        if (activeJob) {
          res.status(409).json({
            success: false,
            message:
              'Cannot go offline while a job is in progress. Pass `force: true` to override.',
            activeBookingId: activeJob.id,
          });
          return;
        }
      }
    }

    // ── Commit ────────────────────────────────────────────────────────────────
    const updated = await prisma.helper.update({
      where: { id: helperId },
      data: {
        isOnline,
        lastActiveAt: new Date(),
      },
      select: { id: true, isOnline: true, lastActiveAt: true },
    });

    logger.info('Helper online status updated', { helperId, isOnline });

    res.status(200).json({
      success: true,
      message: isOnline ? 'You are now online and visible to customers.' : 'You are now offline.',
      data: updated,
    });
  } catch (error) {
    logger.error('toggleOnlineStatus error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
