/**
 * admin-bookings.controller.ts
 *
 * Admin Order Management list API.
 *
 * Route (mounted on /api/admin/bookings):
 *   GET / — paginated booking list with search, status filter, and dashboard stats
 */

import { Request, Response } from 'express';
import { BookingStatus } from '@prisma/client';
import { prisma } from '../../prisma.client';
import { resolveCategoryFilter } from '../../utils/category-helper';
import logger from '../../utils/logger';

const ALLOWED_STATUSES: BookingStatus[] = [
  'PENDING_PAYMENT',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

/**
 * GET /api/admin/bookings
 *
 * Returns paginated booking list for the Admin Order Management table,
 * plus top-level stats cards (total, activeNow, pending, completed).
 *
 * Query params:
 *   page   {number} — default 1
 *   limit  {number} — default 20 (max 100)
 *   search {string} — customer name, customer phone, helper name, or bookingId
 *   status {string} — PENDING_PAYMENT | CONFIRMED | IN_PROGRESS | COMPLETED | CANCELLED
 *   category_id {string} — filter by category ID or slug
 */
export const getAdminBookingsHandler = async (
  req: Request,
  res: Response,
): Promise<any> => {
  const page   = Math.max(1, parseInt(String(req.query.page  ?? '1'),  10) || 1);
  const limit  = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
  const search = String(req.query.search ?? '').trim() || undefined;
  const statusParam = String(req.query.status ?? '').trim().toUpperCase() as BookingStatus;
  const statusFilter = ALLOWED_STATUSES.includes(statusParam) ? statusParam : undefined;
  const skip = (page - 1) * limit;

  // Build where clause
  const where: Parameters<typeof prisma.booking.findMany>[0]['where'] = {};

  const cat = await resolveCategoryFilter(req);
  if (cat) {
    where.service = {
      OR: [
        { name: { contains: cat.name, mode: 'insensitive' } },
        { name: { contains: cat.slug, mode: 'insensitive' } },
      ],
    };
  }

  if (statusFilter) {
    where.status = statusFilter;
  }

  if (search) {
    const bookingIdNum = parseInt(search, 10);
    where.OR = [
      { customer: { fullName: { contains: search, mode: 'insensitive' } } },
      { customer: { phone:    { contains: search, mode: 'insensitive' } } },
      { helper:   { user: { fullName: { contains: search, mode: 'insensitive' } } } },
      ...(isNaN(bookingIdNum) ? [] : [{ id: bookingIdNum }]),
    ];
  }

  try {
    const [bookings, total, activeNow, pending, completed] = await Promise.all([
      prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id:          true,
          bookingDate: true,
          status:      true,
          finalAmount: true,
          address:     true,
          customer: {
            select: { fullName: true, phone: true },
          },
          helper: {
            select: {
              id:   true,
              user: { select: { fullName: true } },
            },
          },
          service:     { select: { name: true } },
          servicePlan: { select: { name: true } },
        },
      }),
      prisma.booking.count({ where }),
      prisma.booking.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.booking.count({ where: { status: 'CONFIRMED' } }),
      prisma.booking.count({ where: { status: 'COMPLETED' } }),
    ]);

    const totalBookings = await prisma.booking.count({});

    return res.json({
      success: true,
      stats: {
        totalBookings,
        activeNow,
        pending,
        completed,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: bookings.map(b => ({
        bookingId:     b.id,
        customerName:  b.customer?.fullName ?? 'Customer',
        customerPhone: b.customer?.phone ?? '',
        helperName:    b.helper?.user?.fullName ?? null,
        helperId:      b.helper?.id ?? null,
        serviceName:   b.service?.name ?? 'Service',
        planType:      b.servicePlan?.name ?? 'Standard',
        bookingDate:   b.bookingDate,
        amount:        b.finalAmount,
        status:        b.status,
        address:       b.address,
      })),
    });
  } catch (error) {
    logger.error('admin getAdminBookingsHandler: error', { error });
    return res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
};
