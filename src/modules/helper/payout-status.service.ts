import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { prisma } from '../../prisma.client';

dayjs.extend(utc);
dayjs.extend(timezone);

const IST = 'Asia/Kolkata';

/**
 * Get payout status summary for a helper
 * Shows breakdown of earnings by payout status
 */
export async function getPayoutStatusSummary(helperId: number) {
  const helper = await prisma.helper.findUnique({
    where: { id: helperId },
    select: { userId: true },
  });

  if (!helper) {
    throw new Error('Helper not found');
  }

  const bookings = await prisma.booking.findMany({
    where: {
      helperId,
      status: 'COMPLETED',
    },
    select: {
      id: true,
      helperPayoutAmount: true,
      payoutStatus: true,
      completedAt: true,
    },
  });

  const statuses = {
    PENDING: 0,
    PROCESSING: 0,
    PAID: 0,
    FAILED: 0,
  };

  bookings.forEach((booking) => {
    const amount = booking.helperPayoutAmount || 0;
    if (booking.payoutStatus === 'PENDING') {
      statuses.PENDING += amount;
    } else if (booking.payoutStatus === 'PROCESSING') {
      statuses.PROCESSING += amount;
    } else if (booking.payoutStatus === 'PAID') {
      statuses.PAID += amount;
    } else if (booking.payoutStatus === 'FAILED') {
      statuses.FAILED += amount;
    }
  });

  const totalEarnings = bookings.reduce((sum, b) => sum + (b.helperPayoutAmount || 0), 0);

  return {
    totalEarnings: Math.floor(totalEarnings),
    pending: Math.floor(statuses.PENDING),
    processing: Math.floor(statuses.PROCESSING),
    completed: Math.floor(statuses.PAID),
    failed: Math.floor(statuses.FAILED),
    breakdown: {
      pendingPercentage:
        totalEarnings > 0 ? Math.round((statuses.PENDING / totalEarnings) * 100) : 0,
      processingPercentage:
        totalEarnings > 0 ? Math.round((statuses.PROCESSING / totalEarnings) * 100) : 0,
      completedPercentage:
        totalEarnings > 0 ? Math.round((statuses.PAID / totalEarnings) * 100) : 0,
      failedPercentage:
        totalEarnings > 0 ? Math.round((statuses.FAILED / totalEarnings) * 100) : 0,
    },
  };
}

/**
 * Get list of pending payouts for a helper
 * Shows individual bookings awaiting payout or in processing
 */
export async function getPendingPayouts(helperId: number) {
  const bookings = await prisma.booking.findMany({
    where: {
      helperId,
      status: 'COMPLETED',
      payoutStatus: { in: ['PENDING', 'PROCESSING'] },
    },
    select: {
      id: true,
      helperPayoutAmount: true,
      payoutStatus: true,
      completedAt: true,
      payoutEligibleAt: true,
      customer: {
        select: {
          fullName: true,
        },
      },
      service: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      completedAt: 'desc',
    },
  });

  return bookings.map((booking) => ({
    bookingId: booking.id,
    amount: Math.floor(booking.helperPayoutAmount || 0),
    status: booking.payoutStatus === 'PROCESSING' ? 'Processing' : 'Pending',
    customerName: booking.customer?.fullName || 'Unknown',
    serviceName: booking.service?.name || 'Unknown Service',
    completedAt: booking.completedAt
      ? dayjs(booking.completedAt).tz(IST).format('MMM DD, YYYY')
      : null,
    eligibleAt: booking.payoutEligibleAt
      ? dayjs(booking.payoutEligibleAt).tz(IST).format('MMM DD, YYYY HH:mm')
      : null,
  }));
}

/**
 * Get payout history (completed/failed payouts)
 */
export async function getPayoutHistory(helperId: number, limit: number = 50) {
  const bookings = await prisma.booking.findMany({
    where: {
      helperId,
      status: 'COMPLETED',
      payoutStatus: { in: ['PAID', 'FAILED'] },
    },
    select: {
      id: true,
      helperPayoutAmount: true,
      payoutStatus: true,
      payoutAt: true,
      customer: {
        select: {
          fullName: true,
        },
      },
      service: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      payoutAt: 'desc',
    },
    take: limit,
  });

  return bookings.map((booking) => ({
    bookingId: booking.id,
    amount: Math.floor(booking.helperPayoutAmount || 0),
    status: booking.payoutStatus === 'PAID' ? 'Completed' : 'Failed',
    customerName: booking.customer?.fullName || 'Unknown',
    serviceName: booking.service?.name || 'Unknown Service',
    payoutDate: booking.payoutAt
      ? dayjs(booking.payoutAt).tz(IST).format('MMM DD, YYYY HH:mm')
      : null,
  }));
}
