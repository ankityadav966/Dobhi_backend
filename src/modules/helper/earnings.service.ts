import { prisma } from '../../prisma.client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const IST = 'Asia/Kolkata';

/**
 * Get earnings dashboard for a helper
 * Shows total and pending earnings for today, week, month
 * All calculations use UTC timestamps, converted from IST
 */
export async function getEarningsDashboard(helperId: number) {
  const helper = await prisma.helper.findUnique({
    where: { id: helperId },
    select: { userId: true },
  });

  if (!helper) {
    throw new Error('Helper not found');
  }

  // Convert IST midnight/week/month start to UTC for database queries
  const now = dayjs().tz(IST);
  const startOfDayIST = now.startOf('day');
  const startOfWeekIST = now.startOf('week');
  const startOfMonthIST = now.startOf('month');

  // Convert to UTC for database comparison
  const startOfDay = startOfDayIST.utc().toDate();
  const startOfWeek = startOfWeekIST.utc().toDate();
  const startOfMonth = startOfMonthIST.utc().toDate();

  // Today earnings
  const todayBookings = await prisma.booking.findMany({
    where: {
      helperId,
      status: 'COMPLETED',
      completedAt: { gte: startOfDay },
    },
    select: {
      helperPayoutAmount: true,
      payoutStatus: true,
    },
  });

  const todayTotal = todayBookings.reduce((sum, b) => sum + (b.helperPayoutAmount || 0), 0);
  const todayPending = todayBookings
    .filter((b) => b.payoutStatus === 'PENDING' || b.payoutStatus === 'PROCESSING')
    .reduce((sum, b) => sum + (b.helperPayoutAmount || 0), 0);

  // Week earnings
  const weekBookings = await prisma.booking.findMany({
    where: {
      helperId,
      status: 'COMPLETED',
      completedAt: { gte: startOfWeek },
    },
    select: {
      helperPayoutAmount: true,
      payoutStatus: true,
    },
  });

  const weekTotal = weekBookings.reduce((sum, b) => sum + (b.helperPayoutAmount || 0), 0);
  const weekPending = weekBookings
    .filter((b) => b.payoutStatus === 'PENDING' || b.payoutStatus === 'PROCESSING')
    .reduce((sum, b) => sum + (b.helperPayoutAmount || 0), 0);

  // Month earnings
  const monthBookings = await prisma.booking.findMany({
    where: {
      helperId,
      status: 'COMPLETED',
      completedAt: { gte: startOfMonth },
    },
    select: {
      helperPayoutAmount: true,
      payoutStatus: true,
    },
  });

  const monthTotal = monthBookings.reduce((sum, b) => sum + (b.helperPayoutAmount || 0), 0);
  const monthPending = monthBookings
    .filter((b) => b.payoutStatus === 'PENDING' || b.payoutStatus === 'PROCESSING')
    .reduce((sum, b) => sum + (b.helperPayoutAmount || 0), 0);

  return {
    today: {
      totalEarnings: Math.floor(todayTotal),
      pendingEarnings: Math.floor(todayPending),
    },
    week: {
      totalEarnings: Math.floor(weekTotal),
      pendingEarnings: Math.floor(weekPending),
    },
    month: {
      totalEarnings: Math.floor(monthTotal),
      pendingEarnings: Math.floor(monthPending),
    },
  };
}

/**
 * Get earnings transaction history for a helper
 * Shows only HELPER_PAYOUT ledger entries
 */
export async function getEarningsHistory(helperId: number) {
  const helper = await prisma.helper.findUnique({
    where: { id: helperId },
    select: { userId: true },
  });

  if (!helper) {
    throw new Error('Helper not found');
  }

  const ledgerEntries = await prisma.ledgerEntry.findMany({
    where: {
      userId: helper.userId,
      type: 'HELPER_PAYOUT',
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return ledgerEntries.map((entry) => ({
    id: entry.id.toString(),
    type: entry.direction === 'CREDIT' ? 'CREDIT' : 'DEBIT',
    amount: parseInt(entry.amount.toString(), 10),
    title: mapLedgerTypeToTitle(entry.type),
    status: mapLedgerTypeToStatus(entry.type),
    date: dayjs(entry.createdAt).tz(IST).format('MMM DD, YYYY'),
  }));
}

/**
 * Get single transaction detail for a helper
 */
export async function getTransactionDetail(helperId: number, transactionId: string) {
  const helper = await prisma.helper.findUnique({
    where: { id: helperId },
    select: { userId: true },
  });

  if (!helper) {
    throw new Error('Helper not found');
  }

  const transactionIdNum = parseInt(transactionId, 10);

  const ledgerEntry = await prisma.ledgerEntry.findFirst({
    where: {
      id: transactionIdNum,
      userId: helper.userId,
    },
  });

  if (!ledgerEntry) {
    throw new Error('Transaction not found');
  }

  let booking = null;
  if (ledgerEntry.bookingId && ledgerEntry.bookingId > 0) {
    booking = await prisma.booking.findUnique({
      where: { id: ledgerEntry.bookingId },
      select: {
        id: true,
        helperPayoutAmount: true,
        platformCommissionAmount: true,
        finalAmount: true,
        payoutStatus: true,
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
        completedAt: true,
      },
    });
  }

  const amount = parseInt(ledgerEntry.amount.toString(), 10);
  const serviceAmount = booking?.finalAmount || 0;
  const platformFee = booking?.platformCommissionAmount || 0;
  const payoutStatus = booking?.payoutStatus || 'PENDING';

  return {
    type: ledgerEntry.direction === 'CREDIT' ? 'CREDIT' : 'DEBIT',
    amount,
    status: mapPayoutStatusToDisplay(payoutStatus),
    paymentMethod: 'UPI',
    date: dayjs(ledgerEntry.createdAt).tz(IST).format('MMM DD, YYYY hh:mm A'),
    customerName: booking?.customer?.fullName || 'Unknown',
    serviceName: booking?.service?.name || 'Unknown Service',
    bookingId: booking?.id ? booking.id.toString() : null,
    breakdown: {
      serviceAmount: Math.floor(serviceAmount),
      platformFee: Math.floor(platformFee),
      finalAmount: Math.floor(amount),
    },
  };
}

/**
 * Map PayoutStatus to display status
 */
function mapPayoutStatusToDisplay(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'Processing';
    case 'PROCESSING':
      return 'Processing';
    case 'PAID':
      return 'Completed';
    case 'FAILED':
      return 'Failed';
    default:
      return 'Pending';
  }
}

/**
 * Map LedgerType to display title
 */
function mapLedgerTypeToTitle(type: string): string {
  return 'Earnings from booking';
}

/**
 * Map LedgerType to display status value
 */
function mapLedgerTypeToStatus(type: string): string {
  return 'COMPLETED';
}
