/**
 * admin-helper.controller.ts
 *
 * Admin Helper Management APIs.
 *
 * Routes (all mounted on /api/admin/helpers):
 *   GET  /            — paginated helper list with search + status filter
 *   GET  /stats       — aggregate counts (total / active / inactive)
 *   GET  /:helperId   — single helper detail with recent bookings + earnings
 */

import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';

// ─── Internal types ───────────────────────────────────────────────────────────

interface HelperListRow {
  id:          number;
  fullName:    string;
  phone:       string;
  rating:      number;
  orders:      bigint;
  earnings:    number;
  isAvailable: boolean;
  isActive:    boolean;
  isBlocked:   boolean;
  createdAt:   Date;
}

interface HelperAggRow {
  helperId:  number;
  orders:    bigint;
  earnings:  number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetch per-helper order count + earnings in a single SQL round-trip.
 * Used by getHelperDetailsHandler.
 */
async function fetchHelperAggregates(
  helperIds: number[],
): Promise<Map<number, { orders: number; earnings: number }>> {
  if (helperIds.length === 0) return new Map();

  const rows = await prisma.$queryRaw<HelperAggRow[]>`
    SELECT
      b."helperId",
      COUNT(b.id)                                      AS "orders",
      COALESCE(SUM(b."helperPayoutAmount"), 0)         AS "earnings"
    FROM "Booking" b
    WHERE b."helperId" = ANY(${Prisma.raw(`ARRAY[${helperIds.join(',')}]::int[]`)})
    GROUP BY b."helperId"
  `;

  const map = new Map<number, { orders: number; earnings: number }>();
  for (const row of rows) {
    map.set(Number(row.helperId), {
      orders:   Number(row.orders),
      earnings: Number(row.earnings ?? 0),
    });
  }
  return map;
}

// ─── GET /api/admin/helpers ───────────────────────────────────────────────────

/**
 * Returns a paginated list of helpers for the Admin Partner Management screen.
 *
 * Uses a single aggregated SQL query (JOIN + GROUP BY) — no N+1 queries.
 *
 * Query params:
 *   page   {number} — default 1
 *   limit  {number} — default 20 (max 100)
 *   search {string} — partial match on helper name or phone
 *   status {string} — "active" | "inactive"  (filters on h.isAvailable)
 */
export const getHelpersHandler = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const page   = Math.max(1, parseInt(String(req.query.page  ?? '1'),  10) || 1);
  const limit  = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
  const search = String(req.query.search ?? '').trim() || undefined;
  const status = String(req.query.status ?? '').trim() || undefined;
  const skip   = (page - 1) * limit;

  // Build WHERE fragments safely using Prisma.sql
  const conditions: Prisma.Sql[] = [];

  if (search) {
    conditions.push(
      Prisma.sql`(u."fullName" ILIKE ${`%${search}%`} OR u.phone ILIKE ${`%${search}%`})`,
    );
  }
  if (status === 'active') {
    conditions.push(Prisma.sql`h."isAvailable" = true`);
  } else if (status === 'inactive') {
    conditions.push(Prisma.sql`h."isAvailable" = false`);
  }

  const whereClause = conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
    : Prisma.sql``;

  try {
    // Single aggregated query — orders from Booking, earnings from CAPTURED Payments
    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<HelperListRow[]>`
        SELECT
          h.id,
          u."fullName",
          u.phone,
          h.rating,
          COUNT(b.id)                                                                    AS orders,
          COALESCE(SUM(CASE WHEN p.status = 'CAPTURED' THEN p.amount ELSE 0 END), 0)    AS earnings,
          h."isAvailable",
          u."isActive",
          u."isBlocked",
          h."createdAt"
        FROM "Helper" h
        JOIN  "User"    u ON u.id        = h."userId"
        LEFT JOIN "Booking" b ON b."helperId" = h.id
        LEFT JOIN "Payment" p ON p."bookingId" = b.id
        ${whereClause}
        GROUP BY h.id, u."fullName", u.phone, h.rating, h."isAvailable", u."isActive", u."isBlocked", h."createdAt"
        ORDER BY h."createdAt" DESC
        LIMIT  ${limit}
        OFFSET ${skip}
      `,
      prisma.$queryRaw<Array<{ total: bigint }>>`
        SELECT COUNT(*) AS total
        FROM (
          SELECT h.id
          FROM "Helper" h
          JOIN "User" u ON u.id = h."userId"
          ${whereClause}
          GROUP BY h.id
        ) AS sub
      `,
    ]);

    const total = Number(countRows[0]?.total ?? 0);

    const data = rows.map(r => ({
      id:       Number(r.id),
      name:     r.fullName,
      phone:    r.phone,
      rating:   Number(r.rating),
      orders:   Number(r.orders),
      earnings: Number(r.earnings),
      status:   r.isBlocked ? 'blocked' : r.isAvailable ? 'active' : 'inactive',
      joinedAt: r.createdAt,
    }));

    return res.json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data,
    });
  } catch (error) {
    logger.error('admin getHelpersHandler: error', { error });
    return res.status(500).json({ success: false, message: 'Failed to fetch helpers' });
  }
};

// ─── GET /api/admin/helpers/stats ────────────────────────────────────────────

/**
 * Returns aggregate helper counts for dashboard summary cards.
 * Registered before /:helperId to avoid route shadowing.
 */
export const getHelperStatsHandler = async (
  _req: Request,
  res:  Response,
): Promise<any> => {
  try {
    const [totalHelpers, activeHelpers, inactiveHelpers] = await Promise.all([
      prisma.helper.count({}),
      prisma.helper.count({ where: { user: { isActive: true,  isBlocked: false } } }),
      prisma.helper.count({ where: { user: { OR: [{ isActive: false }, { isBlocked: true }] } } }),
    ]);

    return res.json({
      success: true,
      data: { totalHelpers, activeHelpers, inactiveHelpers },
    });
  } catch (error) {
    logger.error('admin getHelperStatsHandler: error', { error });
    return res.status(500).json({ success: false, message: 'Failed to fetch helper stats' });
  }
};

// ─── GET /api/admin/helpers/:helperId ────────────────────────────────────────

/**
 * Returns full helper detail, services, recent bookings, and earnings.
 *
 * Errors:
 *   400 — invalid helperId
 *   404 — helper not found
 *   500 — server error
 */
export const getHelperDetailsHandler = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const helperId = parseInt(req.params.helperId, 10);
  if (isNaN(helperId)) {
    return res.status(400).json({ success: false, message: 'Invalid helperId' });
  }

  try {
    const [helper, aggMap, recentBookings] = await Promise.all([
      prisma.helper.findUnique({
        where:  { id: helperId },
        select: {
          id:           true,
          rating:       true,
          totalRatings: true,
          createdAt:    true,
          user: {
            select: {
              fullName:  true,
              phone:     true,
              isActive:  true,
              isBlocked: true,
            },
          },
          profile: {
            select: {
              address: true,
              city:    true,
              pinCode: true,
            },
          },
          helperServices: {
            select: {
              service: { select: { id: true, name: true } },
            },
          },
        },
      }),
      fetchHelperAggregates([helperId]),
      prisma.booking.findMany({
        where:   { helperId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id:          true,
          status:      true,
          finalAmount: true,
          bookingDate: true,
          service: { select: { name: true } },
        },
      }),
    ]);

    if (!helper) {
      return res.status(404).json({ success: false, message: 'Helper not found' });
    }

    const agg = aggMap.get(helperId) ?? { orders: 0, earnings: 0 };

    return res.json({
      success: true,
      data: {
        helperId:     helper.id,
        name:         helper.user.fullName,
        phone:        helper.user.phone,
        address:      helper.profile?.address ?? null,
        city:         helper.profile?.city    ?? null,
        rating:       helper.rating,
        totalRatings: helper.totalRatings,
        status:       helper.user.isBlocked ? 'blocked' : helper.user.isActive ? 'active' : 'inactive',
        joinedAt:     helper.createdAt,
        services:     helper.helperServices.map(hs => hs.service),
        orders:       agg.orders,
        earnings:     agg.earnings,
        recentBookings: recentBookings.map(b => ({
          bookingId:   b.id,
          serviceName: b.service.name,
          amount:      b.finalAmount,
          status:      b.status,
          bookingDate: b.bookingDate,
        })),
      },
    });
  } catch (error) {
    logger.error('admin getHelperDetailsHandler: error', { helperId, error });
    return res.status(500).json({ success: false, message: 'Failed to fetch helper details' });
  }
};

// ─── PATCH /api/admin/helpers/:helperId/status ────────────────────────────────

/**
 * Activate or deactivate a helper partner.
 *
 * Body: { status: "active" | "inactive" }
 *
 * active   → user.isActive = true,  user.isBlocked = false
 * inactive → user.isActive = false, helper.isOnline = false
 *
 * Errors:
 *   400 — invalid helperId or invalid status value
 *   404 — helper not found
 *   500 — server error
 */
export const updateHelperStatusHandler = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const helperId = parseInt(req.params.helperId, 10);
  if (isNaN(helperId)) {
    return res.status(400).json({ success: false, message: 'Invalid helperId' });
  }

  const status = String(req.body?.status ?? '').trim();
  if (status !== 'active' && status !== 'inactive') {
    return res.status(400).json({ success: false, message: 'status must be "active" or "inactive"' });
  }

  try {
    const helper = await prisma.helper.findUnique({
      where:  { id: helperId },
      select: { id: true, userId: true },
    });

    if (!helper) {
      return res.status(404).json({ success: false, message: 'Helper not found' });
    }

    if (status === 'active') {
      await prisma.user.update({
        where: { id: helper.userId },
        data:  { isActive: true, isBlocked: false },
      });
    } else {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: helper.userId },
          data:  { isActive: false },
        }),
        prisma.helper.update({
          where: { id: helperId },
          data:  { isOnline: false, isAvailable: false },
        }),
      ]);
    }

    logger.info('admin updateHelperStatus: status changed', { helperId, status });
    return res.json({ success: true, message: `Helper status updated to ${status}` });
  } catch (error) {
    logger.error('admin updateHelperStatusHandler: error', { helperId, error });
    return res.status(500).json({ success: false, message: 'Failed to update helper status' });
  }
};

// ─── GET /api/admin/helpers/:helperId/bookings ────────────────────────────────

/**
 * Returns paginated booking history for a specific helper.
 *
 * Query params:
 *   page  {number} — default 1
 *   limit {number} — default 20 (max 100)
 *
 * Errors:
 *   400 — invalid helperId
 *   404 — helper not found
 *   500 — server error
 */
export const getHelperBookingsHandler = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const helperId = parseInt(req.params.helperId, 10);
  if (isNaN(helperId)) {
    return res.status(400).json({ success: false, message: 'Invalid helperId' });
  }

  const page   = Math.max(1, parseInt(String(req.query.page  ?? '1'),  10) || 1);
  const limit  = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
  const skip   = (page - 1) * limit;

  const ALLOWED_STATUSES = ['COMPLETED', 'CONFIRMED', 'IN_PROGRESS', 'CANCELLED'] as const;
  type AllowedStatus = typeof ALLOWED_STATUSES[number];
  const statusParam = String(req.query.status ?? '').trim().toUpperCase();
  const statusFilter = ALLOWED_STATUSES.includes(statusParam as AllowedStatus)
    ? (statusParam as AllowedStatus)
    : undefined;

  try {
    const helper = await prisma.helper.findUnique({
      where:  { id: helperId },
      select: { id: true },
    });

    if (!helper) {
      return res.status(404).json({ success: false, message: 'Helper not found' });
    }

    const where = {
      helperId,
      ...(statusFilter ? { status: statusFilter } : {}),
    };

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id:          true,
          bookingDate: true,
          address:     true,
          totalAmount: true,
          status:      true,
          service:  { select: { name: true } },
          customer: { select: { fullName: true } },
        },
      }),
      prisma.booking.count({ where }),
    ]);

    return res.json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: bookings.map(b => ({
        bookingId: b.id,
        service:   b.service.name,
        customer:  b.customer.fullName,
        date:      b.bookingDate,
        address:   b.address ?? null,
        amount:    b.totalAmount,
        status:    b.status,
      })),
    });
  } catch (error) {
    logger.error('admin getHelperBookingsHandler: error', { helperId, error });
    return res.status(500).json({ success: false, message: 'Failed to fetch helper bookings' });
  }
};
