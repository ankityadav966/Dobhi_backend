import { Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import logger from '../../utils/logger';
import {
  resolveHelperId,
  getEarningsSummary,
  getEarningsHistory,
  getEarningsDetail,
} from '../../services/earnings.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveOrFail(
  req: AuthenticatedRequest,
  res: Response,
): Promise<number | null> {
  const userId = parseInt(req.user!.userId, 10);
  const helperId = await resolveHelperId(userId);
  if (helperId == null) {
    res.status(404).json({ success: false, message: 'Helper profile not found' });
    return null;
  }
  return helperId;
}

// ─── GET /summary ─────────────────────────────────────────────────────────────

export async function getEarningsSummaryHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const helperId = await resolveOrFail(req, res);
    if (helperId == null) return;

    const summary = await getEarningsSummary(helperId);

    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    logger.error('EarningsController: getEarningsSummary error', { error });
    res.status(500).json({ success: false, message: 'Failed to fetch earnings summary' });
  }
}

// ─── GET /history ─────────────────────────────────────────────────────────────

export async function getEarningsHistoryHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const helperId = await resolveOrFail(req, res);
    if (helperId == null) return;

    // Parse pagination
    const page  = Math.max(1, parseInt(String(req.query.page  ?? '1'),  10) || 1);
    const rawLimit = parseInt(String(req.query.limit ?? '10'), 10) || 10;
    const limit = Math.min(50, Math.max(1, rawLimit)); // cap at 50

    // Optional filters
    const status   = typeof req.query.status   === 'string' ? req.query.status   : undefined;
    const fromDate = typeof req.query.fromDate  === 'string' ? new Date(req.query.fromDate)  : undefined;
    const toDate   = typeof req.query.toDate    === 'string' ? new Date(req.query.toDate)    : undefined;

    // Validate dates if provided
    if (fromDate && isNaN(fromDate.getTime())) {
      res.status(400).json({ success: false, message: 'Invalid fromDate' });
      return;
    }
    if (toDate && isNaN(toDate.getTime())) {
      res.status(400).json({ success: false, message: 'Invalid toDate' });
      return;
    }

    const result = await getEarningsHistory(helperId, page, limit, status, fromDate, toDate);

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error('EarningsController: getEarningsHistory error', { error });
    res.status(500).json({ success: false, message: 'Failed to fetch earnings history' });
  }
}

// ─── GET /:bookingId ──────────────────────────────────────────────────────────

export async function getEarningsDetailHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const helperId = await resolveOrFail(req, res);
    if (helperId == null) return;

    const bookingId = parseInt(req.params.bookingId, 10);
    if (isNaN(bookingId)) {
      res.status(400).json({ success: false, message: 'Invalid bookingId' });
      return;
    }

    const detail = await getEarningsDetail(helperId, bookingId);

    if (!detail) {
      res.status(404).json({
        success: false,
        message: 'Booking not found or does not belong to this helper',
      });
      return;
    }

    res.status(200).json({ success: true, data: detail });
  } catch (error) {
    logger.error('EarningsController: getEarningsDetail error', { error });
    res.status(500).json({ success: false, message: 'Failed to fetch earnings detail' });
  }
}
