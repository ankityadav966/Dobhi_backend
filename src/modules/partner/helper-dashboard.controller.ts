/**
 * helper-dashboard.controller.ts
 *
 * GET /api/helper/dashboard   — unified operational snapshot
 * GET /api/helper/discipline  — strike & suspension visibility
 */

import { Response } from 'express';
import { prisma } from '../../prisma.client';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { resolveHelperId, getEarningsSummary } from '../../services/earnings.service';
import { BookingStatus } from '@prisma/client';
import logger from '../../utils/logger';

// ─── Dashboard ─────────────────────────────────────────────────────────────────

export const getDashboard = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = parseInt(req.user!.userId, 10);

    const helperId = await resolveHelperId(userId);
    if (!helperId) {
      res.status(404).json({ success: false, message: 'Helper profile not found' });
      return;
    }

    const now = new Date();

    // Fan-out: all independent queries in parallel
    const [
      helperRow,
      userRow,
      activeBooking,
      upcomingBooking,
      pendingRequestsCount,
      earnings,
      completedToday,
    ] = await Promise.all([
      // Helper core fields
      prisma.helper.findUnique({
        where: { id: helperId },
        select: {
          id: true,
          isOnline: true,
          isAvailable: true,
          lastActiveAt: true,
          rating: true,
          totalRatings: true,
          strikeCount: true,
          noShowCount: true,
          cancelCount: true,
          onboardingStatus: true,
        },
      }),

      // Suspension status from User
      prisma.user.findUnique({
        where: { id: userId },
        select: { suspendedUntil: true, fullName: true, avatar: true },
      }),

      // Currently active job
      prisma.booking.findFirst({
        where: { helperId, status: BookingStatus.IN_PROGRESS },
        select: {
          id: true,
          status: true,
          startTime: true,
          endTime: true,
          address: true,
          city: true,
          totalAmount: true,
          serviceId: true,
        },
      }),

      // Next confirmed job
      prisma.booking.findFirst({
        where: {
          helperId,
          status: BookingStatus.CONFIRMED,
          startTime: { gt: now },
        },
        orderBy: { startTime: 'asc' },
        select: {
          id: true,
          status: true,
          startTime: true,
          endTime: true,
          address: true,
          city: true,
          totalAmount: true,
          serviceId: true,
        },
      }),

      // Open requests this helper was dispatched to (still PENDING)
      prisma.bookingRequest.count({
        where: {
          status: 'PENDING',
          dispatchedHelperIds: { has: helperId },
          expiresAt: { gt: now },
        },
      }),

      // Earnings summary (today / week / month / all-time)
      getEarningsSummary(helperId),

      // Jobs completed today (midnight to now)
      prisma.booking.count({
        where: {
          helperId,
          status: BookingStatus.COMPLETED,
          OR: [
            { completedAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0) } },
            {
              completedAt: null,
              updatedAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0) },
            },
          ],
        },
      }),
    ]);

    if (!helperRow) {
      res.status(404).json({ success: false, message: 'Helper not found' });
      return;
    }

    const isSuspended =
      !!userRow?.suspendedUntil && new Date() < userRow.suspendedUntil;

    // Auto-offline: treat helper as offline if lastActiveAt is stale (> 5 min)
    const ONLINE_TIMEOUT_MS = 5 * 60 * 1000;
    const effectiveIsOnline =
      helperRow.isOnline &&
      !!helperRow.lastActiveAt &&
      (Date.now() - helperRow.lastActiveAt.getTime()) < ONLINE_TIMEOUT_MS;

    res.status(200).json({
      success: true,
      data: {
        helper: {
          id: helperRow.id,
          name: userRow?.fullName ?? null,
          avatar: userRow?.avatar ?? null,
          isOnline: effectiveIsOnline,
          isAvailable: helperRow.isAvailable,
          lastActiveAt: helperRow.lastActiveAt,
          rating: helperRow.rating,
          totalRatings: helperRow.totalRatings,
          onboardingStatus: helperRow.onboardingStatus,
        },
        suspension: {
          isSuspended,
          suspendedUntil: isSuspended ? userRow?.suspendedUntil : null,
        },
        discipline: {
          strikeCount: helperRow.strikeCount,
          noShowCount: helperRow.noShowCount,
          cancelCount: helperRow.cancelCount,
        },
        activeBooking: activeBooking ?? null,
        upcomingBooking: upcomingBooking ?? null,
        pendingRequestsCount,
        completedToday,
        earnings,
      },
    });
  } catch (error) {
    logger.error('getDashboard error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Discipline ────────────────────────────────────────────────────────────────

export const getDiscipline = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = parseInt(req.user!.userId, 10);

    const helperId = await resolveHelperId(userId);
    if (!helperId) {
      res.status(404).json({ success: false, message: 'Helper profile not found' });
      return;
    }

    const [helperRow, userRow, recentStrikes] = await Promise.all([
      prisma.helper.findUnique({
        where: { id: helperId },
        select: {
          strikeCount: true,
          lastStrikeAt: true,
          noShowCount: true,
          cancelCount: true,
          ignoreCount: true,
          penaltyCount: true,
        },
      }),

      prisma.user.findUnique({
        where: { id: userId },
        select: { suspendedUntil: true },
      }),

      // Last 10 disciplinary bookings (cancelled by helper)
      prisma.booking.findMany({
        where: {
          helperId,
          status: BookingStatus.CANCELLED,
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          status: true,
          cancelReason: true,
          updatedAt: true,
          startTime: true,
        },
      }),
    ]);

    if (!helperRow) {
      res.status(404).json({ success: false, message: 'Helper not found' });
      return;
    }

    const now = new Date();
    const isSuspended = !!userRow?.suspendedUntil && now < userRow.suspendedUntil;

    // Time left if suspended
    const suspensionRemainingMs =
      isSuspended && userRow?.suspendedUntil
        ? userRow.suspendedUntil.getTime() - now.getTime()
        : 0;

    res.status(200).json({
      success: true,
      data: {
        counts: {
          strikes: helperRow.strikeCount,
          noShows: helperRow.noShowCount,
          cancelledByHelper: helperRow.cancelCount,
          ignoredRequests: helperRow.ignoreCount,
          penalties: helperRow.penaltyCount,
        },
        lastStrikeAt: helperRow.lastStrikeAt,
        suspension: {
          isSuspended,
          suspendedUntil: userRow?.suspendedUntil ?? null,
          remainingMs: suspensionRemainingMs,
          remainingHours: suspensionRemainingMs > 0
            ? Math.ceil(suspensionRemainingMs / (1000 * 60 * 60))
            : 0,
        },
        recentCancelledBookings: recentStrikes,
      },
    });
  } catch (error) {
    logger.error('getDiscipline error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
