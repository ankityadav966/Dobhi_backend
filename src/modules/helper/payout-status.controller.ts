import { Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';
import {
  getPayoutStatusSummary,
  getPendingPayouts,
  getPayoutHistory,
} from './payout-status.service';

/**
 * GET /api/helper/payout/status
 * Get payout status summary (breakdown by status with percentages)
 */
export async function getPayoutStatusHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const userIdNum = parseInt(userId, 10);

    const helper = await prisma.helper.findUnique({
      where: { userId: userIdNum },
    });

    if (!helper) {
      res.status(404).json({ success: false, message: 'Helper not found' });
      return;
    }

    const statusSummary = await getPayoutStatusSummary(helper.id);

    res.status(200).json({
      success: true,
      data: statusSummary,
    });
  } catch (error) {
    logger.error('Error fetching payout status:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payout status' });
  }
}

/**
 * GET /api/helper/payout/pending
 * Get list of pending payouts awaiting release
 */
export async function getPendingPayoutsHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const userIdNum = parseInt(userId, 10);

    const helper = await prisma.helper.findUnique({
      where: { userId: userIdNum },
    });

    if (!helper) {
      res.status(404).json({ success: false, message: 'Helper not found' });
      return;
    }

    const pendingPayouts = await getPendingPayouts(helper.id);

    res.status(200).json({
      success: true,
      data: pendingPayouts,
      count: pendingPayouts.length,
    });
  } catch (error) {
    logger.error('Error fetching pending payouts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pending payouts' });
  }
}

/**
 * GET /api/helper/payout/history
 * Get payout history (completed and failed payouts)
 */
export async function getPayoutHistoryHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const userIdNum = parseInt(userId, 10);

    const helper = await prisma.helper.findUnique({
      where: { userId: userIdNum },
    });

    if (!helper) {
      res.status(404).json({ success: false, message: 'Helper not found' });
      return;
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const payoutHistory = await getPayoutHistory(helper.id, limit);

    res.status(200).json({
      success: true,
      data: payoutHistory,
      count: payoutHistory.length,
    });
  } catch (error) {
    logger.error('Error fetching payout history:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payout history' });
  }
}
