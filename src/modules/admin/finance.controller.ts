import { Response } from 'express';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { BookingStatus, PayoutStatus } from '@prisma/client';

// ─── GET /api/admin/finance/summary ──────────────────────────────────────────

export const getFinanceSummary = async (
  _req: AuthenticatedRequest,
  res: Response,
): Promise<any> => {
  try {
    const [
      totalBookings,
      totalCompleted,
      completedAgg,
      paidAgg,
      pendingAgg,
      failedAgg,
    ] = await Promise.all([
      // 1. Total bookings ever created
      prisma.booking.count(),

      // 2. Total completed bookings
      prisma.booking.count({ where: { status: BookingStatus.COMPLETED } }),

      // 3. Revenue / commission / helper payout from COMPLETED bookings
      prisma.booking.aggregate({
        where: { status: BookingStatus.COMPLETED },
        _sum: {
          totalAmount:               true,
          platformCommissionAmount:  true,
          helperPayoutAmount:        true,
        },
      }),

      // 4. Sum of amounts actually paid out (PAID)
      prisma.booking.aggregate({
        where: { payoutStatus: PayoutStatus.PAID },
        _sum: { helperPayoutAmount: true },
      }),

      // 5. Sum of amounts pending payout (PENDING + PROCESSING)
      prisma.booking.aggregate({
        where: { payoutStatus: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] } },
        _sum: { helperPayoutAmount: true },
      }),

      // 6. Sum of amounts in failed payouts (FAILED)
      prisma.booking.aggregate({
        where: { payoutStatus: PayoutStatus.FAILED },
        _sum: { helperPayoutAmount: true },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        totalBookings,
        totalCompleted,
        totalRevenue:         completedAgg._sum.totalAmount              ?? 0,
        totalCommission:      completedAgg._sum.platformCommissionAmount ?? 0,
        totalHelperPayout:    completedAgg._sum.helperPayoutAmount       ?? 0,
        totalPaidOut:         paidAgg._sum.helperPayoutAmount            ?? 0,
        totalPendingPayout:   pendingAgg._sum.helperPayoutAmount         ?? 0,
        totalFailedPayout:    failedAgg._sum.helperPayoutAmount          ?? 0,
      },
    });
  } catch (error) {
    logger.error('Admin Finance: getFinanceSummary error', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch finance summary' });
  }
};

// ─── GET /api/admin/finance/payouts ──────────────────────────────────────────

export const listPayouts = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<any> => {
  try {
    const {
      status,
      from,
      to,
      helperId,
      page  = '1',
      limit = '20',
    } = req.query as Record<string, string | undefined>;

    const pageNum  = Math.max(1, parseInt(page  ?? '1',  10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '20', 10)));
    const skip     = (pageNum - 1) * limitNum;

    // ── Build where clause ───────────────────────────────────────────────────
    const where: Record<string, unknown> = {
      status: BookingStatus.COMPLETED, // only completed bookings carry meaningful payout data
    };

    if (status) {
      const validStatuses = Object.values(PayoutStatus) as string[];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Allowed values: ${validStatuses.join(', ')}`,
        });
      }
      where.payoutStatus = status as PayoutStatus;
    }

    if (helperId) {
      const helperIdNum = parseInt(helperId, 10);
      if (isNaN(helperIdNum)) {
        return res.status(400).json({ success: false, message: 'helperId must be a number' });
      }
      where.helperId = helperIdNum;
    }

    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) {
        const d = new Date(from);
        if (isNaN(d.getTime())) return res.status(400).json({ success: false, message: 'Invalid "from" date' });
        dateFilter.gte = d;
      }
      if (to) {
        const d = new Date(to);
        if (isNaN(d.getTime())) return res.status(400).json({ success: false, message: 'Invalid "to" date' });
        dateFilter.lte = d;
      }
      where.createdAt = dateFilter;
    }

    // ── Query (count + records in parallel) ──────────────────────────────────
    const [total, bookings] = await Promise.all([
      prisma.booking.count({ where: where as any }),
      prisma.booking.findMany({
        where: where as any,
        skip,
        take:    limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id:                       true,
          helperId:                 true,
          payoutStatus:             true,
          totalAmount:              true,
          helperPayoutAmount:       true,
          platformCommissionAmount: true,
          payoutAt:                 true,
          createdAt:                true,
          helper: {
            select: {
              user: {
                select: { fullName: true },
              },
            },
          },
        } as any,
      }),
    ]);

    const records = (bookings as any[]).map((b: any) => ({
      bookingId:                b.id,
      helperId:                 b.helperId,
      helperName:               b.helper?.user?.fullName ?? null,
      payoutStatus:             b.payoutStatus,
      totalAmount:              b.totalAmount,
      helperPayoutAmount:       b.helperPayoutAmount,
      platformCommissionAmount: b.platformCommissionAmount,
      payoutAt:                 b.payoutAt,
      retryCount:               b.retryCount ?? 0,
      createdAt:                b.createdAt,
    }));

    return res.json({
      success: true,
      data: {
        records,
        pagination: {
          total,
          page:       pageNum,
          limit:      limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    logger.error('Admin Finance: listPayouts error', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch payout records' });
  }
};

// ─── GET /api/admin/finance/payouts/:bookingId ────────────────────────────────

export const getPayoutAudit = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<any> => {
  try {
    const bookingId = parseInt(req.params.bookingId, 10);
    if (isNaN(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid bookingId' });
    }

    const booking = await (prisma.booking.findUnique as any)({
      where: { id: bookingId },
      include: {
        payment: {
          select: {
            id:                 true,
            status:             true,
            escrowStatus:       true,
            amount:             true,
            razorpayOrderId:    true,
            razorpayPaymentId:  true,
            createdAt:          true,
            updatedAt:          true,
          },
        },
        helper: {
          select: {
            id:   true,
            user: { select: { fullName: true, phone: true } },
            bank: {
              select: {
                accountName:           true,
                accountNumber:         true,
                ifsc:                  true,
                razorpayFundAccountId: true,
              } as any,
            },
          },
        },
        customer: {
          select: { id: true, fullName: true, phone: true },
        },
      },
    }) as any;

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    return res.json({
      success: true,
      data: {
        bookingId:                booking.id,
        status:                   booking.status,
        createdAt:                booking.createdAt,
        completedAt:              booking.completedAt,

        // Financial snapshot
        totalAmount:              booking.totalAmount,
        finalAmount:              booking.finalAmount,
        commissionRateSnapshot:   booking.commissionRateSnapshot,
        platformCommissionAmount: booking.platformCommissionAmount,
        helperPayoutAmount:       booking.helperPayoutAmount,

        // Payout audit trail
        payoutStatus:             booking.payoutStatus,
        payoutEligibleAt:         booking.payoutEligibleAt,
        payoutId:                 booking.payoutId,
        payoutAt:                 booking.payoutAt,
        retryCount:               booking.retryCount      ?? 0,
        lastRetryAt:              booking.lastRetryAt     ?? null,
        nextRetryAt:              booking.nextRetryAt     ?? null,

        // Payment & escrow
        payment: booking.payment
          ? {
              paymentId:          booking.payment.id,
              status:             booking.payment.status,
              escrowStatus:       booking.payment.escrowStatus,
              amount:             booking.payment.amount,
              razorpayOrderId:    booking.payment.razorpayOrderId,
              razorpayPaymentId:  booking.payment.razorpayPaymentId,
              createdAt:          booking.payment.createdAt,
              updatedAt:          booking.payment.updatedAt,
            }
          : null,

        // Participants
        customer: booking.customer,
        helper: booking.helper
          ? {
              id:       booking.helper.id,
              fullName: booking.helper.user.fullName,
              phone:    booking.helper.user.phone,
              bank:     booking.helper.bank
                ? {
                    accountName:           booking.helper.bank.accountName,
                    accountNumber:         booking.helper.bank.accountNumber,
                    ifsc:                  booking.helper.bank.ifsc,
                    razorpayFundAccountId: booking.helper.bank.razorpayFundAccountId ?? null,
                  }
                : null,
            }
          : null,
      },
    });
  } catch (error) {
    logger.error('Admin Finance: getPayoutAudit error', { bookingId: req.params.bookingId, error });
    return res.status(500).json({ success: false, message: 'Failed to fetch payout audit' });
  }
};
