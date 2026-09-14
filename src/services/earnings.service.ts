import { prisma } from '../prisma.client';
import { BookingStatus } from '@prisma/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EarningsSummary {
  totalPaid: number;
  pending: number;
  processing: number;
  failed: number;
  lifetime: number;
}

export interface EarningsHistoryItem {
  bookingId: number;
  serviceId: number;
  date: string;
  totalAmount: number;
  commissionRate: number;
  platformCommission: number;
  helperEarning: number;
  payoutStatus: string;
  payoutAt: string | null;
}

export interface EarningsHistoryResult {
  items: EarningsHistoryItem[];
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    totalItems: number;
  };
}

export interface EarningsDetail {
  bookingId: number;
  totalAmount: number;
  commissionRateSnapshot: number;
  platformCommissionAmount: number;
  helperPayoutAmount: number;
  payoutStatus: string;
  payoutId: string | null;
  payoutAt: string | null;
  payoutEligibleAt: string | null;
  completedAt: string;
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Resolve the Helper.id for a given User.id.
 * Returns null if no Helper record exists for this user.
 */
export async function resolveHelperId(userId: number): Promise<number | null> {
  const helper = await prisma.helper.findUnique({
    where: { userId },
    select: { id: true },
  });
  return helper?.id ?? null;
}

/**
 * Aggregate earnings summary for a helper.
 * Uses snapshot helperPayoutAmount — never recomputes commission.
 */
export async function getEarningsSummary(helperId: number): Promise<EarningsSummary> {
  const base = {
    helperId,
    status: BookingStatus.COMPLETED,
  };

  const [paidAgg, pendingAgg, processingAgg, failedAgg] = await Promise.all([
    prisma.booking.aggregate({
      where: { ...base, payoutStatus: 'PAID' },
      _sum: { helperPayoutAmount: true },
    }),
    prisma.booking.aggregate({
      where: { ...base, payoutStatus: 'PENDING' },
      _sum: { helperPayoutAmount: true },
    }),
    prisma.booking.aggregate({
      where: { ...base, payoutStatus: 'PROCESSING' },
      _sum: { helperPayoutAmount: true },
    }),
    prisma.booking.aggregate({
      where: { ...base, payoutStatus: 'FAILED' },
      _sum: { helperPayoutAmount: true },
    }),
  ]);

  const totalPaid     = paidAgg._sum.helperPayoutAmount       ?? 0;
  const pending       = pendingAgg._sum.helperPayoutAmount     ?? 0;
  const processing    = processingAgg._sum.helperPayoutAmount  ?? 0;
  const failed        = failedAgg._sum.helperPayoutAmount      ?? 0;

  // Lifetime = paid + pending + processing (excludes FAILED)
  const lifetime = totalPaid + pending + processing;

  return { totalPaid, pending, processing, failed, lifetime };
}

/**
 * Paginated earnings history for a helper.
 * Ordered by completedAt DESC.
 */
export async function getEarningsHistory(
  helperId: number,
  page: number,
  limit: number,
  status?: string,
  fromDate?: Date,
  toDate?: Date,
): Promise<EarningsHistoryResult> {
  const where: Record<string, unknown> = {
    helperId,
    status: BookingStatus.COMPLETED,
  };

  if (status) {
    where.payoutStatus = status;
  }

  if (fromDate || toDate) {
    where.completedAt = {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate   ? { lte: toDate   } : {}),
    };
  }

  const [totalItems, rows] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      select: {
        id: true,
        serviceId: true,
        completedAt: true,
        totalAmount: true,
        commissionRateSnapshot: true,
        platformCommissionAmount: true,
        helperPayoutAmount: true,
        payoutStatus: true,
        payoutAt: true,
      },
      orderBy: { completedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const items: EarningsHistoryItem[] = rows.map(b => ({
    bookingId:          b.id,
    serviceId:          b.serviceId,
    date:               b.completedAt?.toISOString() ?? '',
    totalAmount:        b.totalAmount,
    commissionRate:     b.commissionRateSnapshot   ?? 0,
    platformCommission: b.platformCommissionAmount ?? 0,
    helperEarning:      b.helperPayoutAmount       ?? 0,
    payoutStatus:       b.payoutStatus,
    payoutAt:           b.payoutAt?.toISOString()  ?? null,
  }));

  return {
    items,
    pagination: {
      page,
      limit,
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
    },
  };
}

/**
 * Full earnings detail for a single booking.
 * Verifies ownership — throws if booking doesn't belong to this helper.
 */
export async function getEarningsDetail(
  helperId: number,
  bookingId: number,
): Promise<EarningsDetail | null> {
  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      helperId,
      status: BookingStatus.COMPLETED,
    },
    select: {
      id: true,
      totalAmount: true,
      commissionRateSnapshot: true,
      platformCommissionAmount: true,
      helperPayoutAmount: true,
      payoutStatus: true,
      payoutId: true,
      payoutAt: true,
      payoutEligibleAt: true,
      completedAt: true,
    },
  });

  if (!booking || booking.completedAt == null) return null;

  return {
    bookingId:               booking.id,
    totalAmount:             booking.totalAmount,
    commissionRateSnapshot:  booking.commissionRateSnapshot   ?? 0,
    platformCommissionAmount: booking.platformCommissionAmount ?? 0,
    helperPayoutAmount:      booking.helperPayoutAmount       ?? 0,
    payoutStatus:            booking.payoutStatus,
    payoutId:                booking.payoutId  ?? null,
    payoutAt:                booking.payoutAt?.toISOString()          ?? null,
    payoutEligibleAt:        booking.payoutEligibleAt?.toISOString()  ?? null,
    completedAt:             booking.completedAt.toISOString(),
  };
}
