import { Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { param, validationResult } from 'express-validator';
import { getEarningsDashboard, getEarningsHistory, getTransactionDetail } from './earnings.service';
import logger from '../../utils/logger';

export async function getDashboardHandler(
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

    const helper = await require('../../prisma.client').prisma.helper.findUnique({
      where: { userId: userIdNum },
    });

    if (!helper) {
      res.status(404).json({ success: false, message: 'Helper not found' });
      return;
    }

    const dashboard = await getEarningsDashboard(helper.id);

    res.status(200).json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    logger.error('Error fetching earnings dashboard:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch earnings dashboard' });
  }
}

export async function getHistoryHandler(
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

    const helper = await require('../../prisma.client').prisma.helper.findUnique({
      where: { userId: userIdNum },
    });

    if (!helper) {
      res.status(404).json({ success: false, message: 'Helper not found' });
      return;
    }

    const history = await getEarningsHistory(helper.id);

    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    logger.error('Error fetching earnings history:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch earnings history' });
  }
}

export const validateTransactionId = [
  param('transactionId').isNumeric().withMessage('transactionId must be a number'),
];

export async function getTransactionDetailHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ success: false, message: 'Validation failed', errors: errors.array() });
      return;
    }

    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const userIdNum = parseInt(userId, 10);
    const { transactionId } = req.params;

    const helper = await require('../../prisma.client').prisma.helper.findUnique({
      where: { userId: userIdNum },
    });

    if (!helper) {
      res.status(404).json({ success: false, message: 'Helper not found' });
      return;
    }

    const transaction = await getTransactionDetail(helper.id, transactionId);

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    logger.error('Error fetching transaction detail:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch transaction detail' });
  }
}
