/**
 * review.controller.ts
 *
 * Returns all ratings/reviews left for the authenticated helper.
 *
 * Route:  GET /api/partner/reviews
 * Auth:   requireApprovedHelper
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';

// ─── Handler ─────────────────────────────────────────────────────────────────

/**
 * GET /api/partner/reviews
 *
 * Fetches all ratings for the authenticated helper, sorted newest-first.
 * Each item includes the customer's name and the associated bookingId.
 */
export async function getPartnerReviewsHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  const userId = parseInt(req.user.userId, 10);

  // Resolve the Helper record that belongs to this user
  const helper = await prisma.helper.findUnique({
    where:  { userId },
    select: { id: true },
  });

  if (!helper) {
    res.status(403).json({ success: false, message: 'Helper profile not found' });
    return;
  }

  const ratings = await prisma.rating.findMany({
    where:  { helperId: helper.id },
    select: {
      rating:    true,
      review:    true,
      bookingId: true,
      createdAt: true,
      user: {
        select: { fullName: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const data = ratings.map((r) => ({
    rating:       r.rating,
    review:       r.review ?? null,
    customerName: r.user.fullName,
    bookingId:    r.bookingId,
    createdAt:    r.createdAt,
  }));

  logger.info('Fetched partner reviews', { helperId: helper.id, count: data.length });

  res.status(200).json({ success: true, data });
}
