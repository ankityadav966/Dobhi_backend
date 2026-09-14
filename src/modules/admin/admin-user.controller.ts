/**
 * admin-user.controller.ts
 *
 * Admin User Management APIs — powers the admin dashboard User Management page.
 *
 * Routes (all mounted on /api/admin/users):
 *   GET  /                  — paginated user list with search + status filter
 *   GET  /stats             — aggregate counts (total / active / blocked)
 *   GET  /:userId           — single user detail with booking history
 *   POST /:userId/block     — block a user
 *   POST /:userId/unblock   — unblock a user
 *
 * Design notes:
 *   • totalBookings and totalSpent are resolved in a single aggregation query
 *     per page (no N+1).
 *   • User.email does not exist in the schema — search is by fullName or phone.
 *   • status filter values: "active" | "blocked"
 *   • blockedReason is persisted on block; cleared on unblock.
 */

import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';

// ─── Internal types ───────────────────────────────────────────────────────────

interface UserAggRow {
  customerId: number;
  totalBookings: bigint;
  totalSpent: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetch per-user booking count + captured payment total in a single SQL round-trip.
 * Returns a map keyed by customerId for O(1) lookup when building response objects.
 */
async function fetchUserAggregates(
  userIds: number[],
): Promise<Map<number, { totalBookings: number; totalSpent: number }>> {
  if (userIds.length === 0) {
    return new Map();
  }

  // One JOIN query; avoids N+1 by computing both aggregates together.
  const rows = await prisma.$queryRaw<UserAggRow[]>`
    SELECT
      b."customerId",
      COUNT(b.id)                                                          AS "totalBookings",
      COALESCE(SUM(CASE WHEN p.status = 'CAPTURED' THEN p.amount ELSE 0 END), 0) AS "totalSpent"
    FROM "Booking" b
    LEFT JOIN "Payment" p ON p."bookingId" = b.id
    WHERE b."customerId" = ANY(${Prisma.raw(`ARRAY[${userIds.join(',')}]::int[]`)})
    GROUP BY b."customerId"
  `;

  const map = new Map<number, { totalBookings: number; totalSpent: number }>();
  for (const row of rows) {
    map.set(row.customerId, {
      totalBookings: Number(row.totalBookings), // bigint → number
      totalSpent:    Number(row.totalSpent),
    });
  }
  return map;
}

// ─── Build Prisma where clause from query params ──────────────────────────────

function buildUserWhere(
  search?: string,
  status?: string,
): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};

  if (search && search.trim()) {
    const term = search.trim();
    where.OR = [
      { fullName: { contains: term, mode: 'insensitive' } },
      { phone:    { contains: term, mode: 'insensitive' } },
    ];
  }

  if (status === 'active') {
    where.isActive  = true;
    where.isBlocked = false;
  } else if (status === 'blocked') {
    where.isBlocked = true;
  }

  return where;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/users
 *
 * Returns a paginated list of all users with booking stats.
 *
 * Query params:
 *   page   {number}  — default 1
 *   limit  {number}  — default 20 (max 100)
 *   search {string}  — partial match on fullName or phone
 *   status {string}  — "active" | "blocked"
 *
 * Response includes top-level aggregate counts (total / active / blocked)
 * independent of any filter so the UI can always show the summary cards.
 */
export const getUsersHandler = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const page   = Math.max(1, parseInt(String(req.query.page  ?? '1'),  10) || 1);
  const limit  = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
  const search = String(req.query.search ?? '').trim() || undefined;
  const status = String(req.query.status ?? '').trim() || undefined;
  const skip   = (page - 1) * limit;

  try {
    const where = buildUserWhere(search, status);

    // ── 1. Fetch page + global stats in parallel ──────────────────────────
    const [users, filteredTotal, totalCount, activeCount, blockedCount] =
      await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id:           true,
            fullName:     true,
            phone:        true,
            role:         true,
            isActive:     true,
            isBlocked:    true,
            blockedReason: true,
            createdAt:    true,
          },
        }),
        prisma.user.count({ where }),
        prisma.user.count({}),
        prisma.user.count({ where: { isActive: true,  isBlocked: false } }),
        prisma.user.count({ where: { isBlocked: true } }),
      ]);

    // ── 2. Aggregate booking data for this page (single query) ────────────
    const userIds   = users.map(u => u.id);
    const aggMap    = await fetchUserAggregates(userIds);

    // ── 3. Build response rows ─────────────────────────────────────────────
    const data = users.map(u => {
      const agg = aggMap.get(u.id) ?? { totalBookings: 0, totalSpent: 0 };
      return {
        id:            u.id,
        name:          u.fullName,
        phone:         u.phone,
        role:          u.role,
        status:        u.isBlocked ? 'blocked' : u.isActive ? 'active' : 'inactive',
        blockedReason: u.blockedReason ?? null,
        joinedAt:      u.createdAt,
        totalBookings: agg.totalBookings,
        totalSpent:    agg.totalSpent,
      };
    });

    return res.json({
      success: true,
      total:   totalCount,
      active:  activeCount,
      blocked: blockedCount,
      pagination: {
        page,
        limit,
        filteredTotal,
        totalPages: Math.ceil(filteredTotal / limit),
      },
      data,
    });
  } catch (error) {
    logger.error('admin getUsersHandler: error', { error });
    return res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/users/stats
 *
 * Returns top-level user counts for dashboard summary cards.
 * Registered before /:userId to avoid route shadowing.
 */
export const getUserStatsHandler = async (
  _req: Request,
  res:  Response,
): Promise<any> => {
  try {
    const [total, active, blocked] = await Promise.all([
      prisma.user.count({}),
      prisma.user.count({ where: { isActive: true,  isBlocked: false } }),
      prisma.user.count({ where: { isBlocked: true } }),
    ]);

    return res.json({ success: true, data: { total, active, blocked } });
  } catch (error) {
    logger.error('admin getUserStatsHandler: error', { error });
    return res.status(500).json({ success: false, message: 'Failed to fetch user stats' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/users/:userId
 *
 * Returns full user profile, lifetime booking stats, and 10 most recent bookings.
 */
export const getUserDetailsHandler = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ success: false, message: 'Invalid userId' });
  }

  try {
    const [user, bookingAgg, recentBookings] = await Promise.all([
      // Full user record
      prisma.user.findUnique({
        where:  { id: userId },
        select: {
          id:            true,
          fullName:      true,
          phone:         true,
          role:          true,
          isActive:      true,
          isBlocked:     true,
          blockedReason: true,
          createdAt:     true,
          updatedAt:     true,
          helper: {
            select: {
              id:               true,
              onboardingStatus: true,
              rating:           true,
              totalRatings:     true,
            },
          },
        },
      }),

      // Aggregate booking count + total spent in one query
      fetchUserAggregates([userId]),

      // 10 most recent bookings
      prisma.booking.findMany({
        where:   { customerId: userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id:          true,
          status:      true,
          totalAmount: true,
          finalAmount: true,
          createdAt:   true,
          bookingDate: true,
          service: { select: { name: true } },
          helper:  {
            select: {
              user: { select: { fullName: true, phone: true } },
            },
          },
        },
      }),
    ]);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const agg = bookingAgg.get(userId) ?? { totalBookings: 0, totalSpent: 0 };

    return res.json({
      success: true,
      data: {
        id:            user.id,
        name:          user.fullName,
        phone:         user.phone,
        role:          user.role,
        status:        user.isBlocked ? 'blocked' : user.isActive ? 'active' : 'inactive',
        blockedReason: user.blockedReason ?? null,
        joinedAt:      user.createdAt,
        updatedAt:     user.updatedAt,
        helperProfile: user.helper ?? null,
        totalBookings: agg.totalBookings,
        totalSpent:    agg.totalSpent,
        bookings:      recentBookings,
      },
    });
  } catch (error) {
    logger.error('admin getUserDetailsHandler: error', { userId, error });
    return res.status(500).json({ success: false, message: 'Failed to fetch user details' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/users/:userId/block
 *
 * Blocks a user account.
 * Body: { reason: string }
 *
 * Errors:
 *   400 — missing reason or invalid userId
 *   404 — user not found
 *   409 — user already blocked
 */
export const blockUserHandler = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ success: false, message: 'Invalid userId' });
  }

  const reason = String(req.body?.reason ?? '').trim();
  if (!reason) {
    return res.status(400).json({ success: false, message: 'reason is required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true, isBlocked: true, fullName: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isBlocked) {
      return res.status(409).json({ success: false, message: 'User is already blocked' });
    }

    await prisma.user.update({
      where: { id: userId },
      data:  { isBlocked: true, blockedReason: reason },
    });

    logger.info('admin blockUser: user blocked', { userId, reason });

    return res.json({ success: true, message: 'User blocked successfully' });
  } catch (error) {
    logger.error('admin blockUserHandler: error', { userId, error });
    return res.status(500).json({ success: false, message: 'Failed to block user' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/users/:userId/unblock
 *
 * Unblocks a previously blocked user and clears the block reason.
 *
 * Errors:
 *   400 — invalid userId
 *   404 — user not found
 *   409 — user is not currently blocked
 */
export const unblockUserHandler = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ success: false, message: 'Invalid userId' });
  }

  try {
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true, isBlocked: true, fullName: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.isBlocked) {
      return res.status(409).json({ success: false, message: 'User is not currently blocked' });
    }

    await prisma.user.update({
      where: { id: userId },
      data:  { isBlocked: false, blockedReason: null },
    });

    logger.info('admin unblockUser: user unblocked', { userId });

    return res.json({ success: true, message: 'User unblocked successfully' });
  } catch (error) {
    logger.error('admin unblockUserHandler: error', { userId, error });
    return res.status(500).json({ success: false, message: 'Failed to unblock user' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/users/:userId/bookings
 *
 * Returns a paginated booking history for a specific user.
 *
 * Query params:
 *   page  {number} — default 1
 *   limit {number} — default 20 (max 100)
 *
 * Errors:
 *   400 — invalid userId
 *   404 — user not found
 *   500 — server error
 */
export const getUserBookingsHandler = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ success: false, message: 'Invalid userId' });
  }

  const page  = Math.max(1, parseInt(String(req.query.page  ?? '1'),  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
  const skip  = (page - 1) * limit;

  try {
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where:   { customerId: userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id:          true,
          status:      true,
          totalAmount: true,
          finalAmount: true,
          bookingDate: true,
          createdAt:   true,
          address:     true,
          service: { select: { name: true } },
          helper:  {
            select: {
              user: { select: { fullName: true } },
            },
          },
        },
      }),
      prisma.booking.count({ where: { customerId: userId } }),
    ]);

    return res.json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: bookings,
    });
  } catch (error) {
    logger.error('admin getUserBookingsHandler: error', { userId, error });
    return res.status(500).json({ success: false, message: 'Failed to fetch user bookings' });
  }
};
