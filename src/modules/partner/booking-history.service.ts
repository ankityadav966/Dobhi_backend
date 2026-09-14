import { prisma } from '../../prisma.client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

export async function getBookingHistory(userId: string | undefined) {
  if (!userId) {
    throw new Error('Invalid user ID');
  }

  const userIdNum = parseInt(userId, 10);
  const helper = await prisma.helper.findUnique({
    where: { userId: userIdNum },
    select: { id: true },
  });

  if (!helper) {
    throw new Error('Helper not found');
  }

  const bookings = await prisma.booking.findMany({
    where: {
      helperId: helper.id,
      status: {
        in: ['COMPLETED', 'CANCELLED'],
      },
    },
    include: {
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
      rating: {
        select: {
          rating: true,
        },
      },
    },
    orderBy: {
      startTime: 'desc',
    },
  });

  return bookings.map((booking) => ({
    bookingId: booking.id,
    customerName: booking.customer?.fullName || 'Customer',
    serviceName: booking.service?.name || 'Service',
    serviceType: booking.service?.name || 'Service',
    address: booking.address || 'N/A',
    rating: booking.rating?.rating ?? null,
    dateLabel: booking.startTime ? dayjs(booking.startTime).tz('Asia/Kolkata').format('MMM DD') : 'N/A',
    timeLabel: booking.startTime && booking.endTime
      ? `${dayjs(booking.startTime).tz('Asia/Kolkata').format('hh:mm A')} - ${dayjs(booking.endTime).tz('Asia/Kolkata').format('hh:mm A')}`
      : 'N/A',
    amount: booking.finalAmount || 0,
    status: booking.status,
  }));
}
