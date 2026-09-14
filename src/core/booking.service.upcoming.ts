/**
 * booking.service.ts (extension)
 *
 * getUpcomingHelperBookings — fetch upcoming bookings for helper with filters.
 * 
 * CORE RULE (NON-NEGOTIABLE):
 * - Database stores time in UTC
 * - ALL filtering/comparisons must be in UTC
 * - ONLY formatting (labels) should be in IST
 */
import { prisma } from '../prisma.client';
import { BookingStatus } from '@prisma/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tz from 'dayjs/plugin/timezone';
import logger from '../utils/logger';

dayjs.extend(utc);
dayjs.extend(tz);

const IST_TZ = 'Asia/Kolkata';

export async function getUpcomingHelperBookings(
  helperId: number,
  query: {
    day?: string;
    serviceId?: number;
    page?: number;
    limit?: number;
  }
) {
  const { day, serviceId, page = 1, limit = 10 } = query;

  // ✅ CRITICAL: Use dayjs().utc() not new Date() for timezone safety
  const nowUTC = dayjs().utc().toDate();

  // DEBUG — remove once confirmed working
  console.log('helperId:', helperId);
  console.log('nowUTC:', nowUTC.toISOString());

  // ============ BUILD IMMUTABLE BASE WHERE ============
  // Create base where — never mutate, always clone for each query
  const baseWhere: any = {
    helperId,
    status: BookingStatus.CONFIRMED,
    endTime: { gt: nowUTC },
  };

  // Add serviceId filter if provided (to base)
  if (serviceId) {
    baseWhere.serviceId = serviceId;
  }

  console.log('baseWhere:', JSON.stringify(baseWhere, null, 2));

  logger.info('Booking query filter', { helperId, serviceId, nowUTC: nowUTC.toISOString() });

  // ============ TODAY JOBS COUNT (separate, for dashboard metric) ============
  const istNow = dayjs().tz(IST_TZ);
  const startOfTodayUTC = istNow.clone().startOf('day').utc().toDate();
  const endOfTodayUTC = istNow.clone().endOf('day').utc().toDate();

  const todayJobsCountWhere = {
    helperId,
    status: BookingStatus.CONFIRMED,
    startTime: {
      gte: startOfTodayUTC,
      lte: endOfTodayUTC,
    },
  };

  // ============ PAGINATION ============
  const skip = (page - 1) * limit;

  // ============ QUERY DATABASE ============
  // CRITICAL: Clone baseWhere for each query to avoid mutation issues
  const whereForFind = { ...baseWhere };
  const whereForCount = { ...baseWhere };

  const [bookings, total, todayJobsCount] = await Promise.all([
    prisma.booking.findMany({
      where: whereForFind,
      skip,
      take: limit,
      orderBy: [
        { startTime: 'asc' },
        { id: 'asc' },
      ],
      include: {
        customer: true,
        service: true,
        helper: {
          include: {
            user: true,
          },
        },
      },
    }),
    prisma.booking.count({ where: whereForCount }),
    prisma.booking.count({ where: todayJobsCountWhere }),
  ]);

  logger.info('Bookings fetched', { count: bookings.length, total, todayJobsCount });

  // DEBUG — show first booking times (remove once confirmed working)
  if (bookings.length > 0) {
    const first = bookings[0];
    console.log('First booking:', {
      id: first.id,
      startTime: first.startTime?.toISOString(),
      endTime: first.endTime?.toISOString(),
      endTimeVsNowUTC: first.endTime > nowUTC ? 'FUTURE ✓' : 'PAST ✗',
    });
  } else {
    console.log('No bookings found! Debug info:', {
      helperId,
      nowUTC: nowUTC.toISOString(),
      baseWhere: JSON.stringify(baseWhere, null, 2),
    });
  }

  // ============ FORMAT RESPONSE (IST labels only, raw UTC timestamps) ============
  const data = bookings.map(booking => {
    try {
      // Convert UTC times to IST for formatting ONLY
      const startIST = dayjs(booking.startTime).tz(IST_TZ);
      const endIST = dayjs(booking.endTime).tz(IST_TZ);
      const nowIST = dayjs().tz(IST_TZ);

      // Calculate day label
      let dayLabel: string;
      if (startIST.isSame(nowIST, 'day')) {
        dayLabel = 'Today';
      } else if (startIST.isSame(nowIST.add(1, 'day'), 'day')) {
        dayLabel = 'Tomorrow';
      } else {
        dayLabel = startIST.format('MMM D');
      }

      // Format time label
      const timeLabel = `${startIST.format('hh:mm A')} - ${endIST.format('hh:mm A')}`;

      return {
        bookingId: booking.id,
        customerName: booking.customer?.fullName || 'Customer',
        serviceName: booking.service?.name || 'Service',
        serviceType: booking.service?.name?.toUpperCase() || 'UNKNOWN',
        
        helperName: booking.helper?.user?.fullName || null,
        helperRating: booking.helper?.rating || 0,

        // Return raw UTC times (frontend will display them)
        bookingDate: booking.startTime,
        startTime: booking.startTime,
        endTime: booking.endTime,

        // Formatted labels (IST-based)
        dayLabel,
        timeLabel,

        duration: booking.duration || 0,
        durationLabel: `${booking.duration || 0} hours`,

        address: booking.address || '',
        latitude: booking.latitude,
        longitude: booking.longitude,

        finalAmount: booking.finalAmount || 0,
        amountLabel: `₹${(booking.finalAmount || 0).toLocaleString('en-IN')}`,

        jobStatus: 'UPCOMING',
      };
    } catch (err) {
      logger.error('Error formatting booking', { bookingId: booking.id, error: err });
      return null;
    }
  }).filter(b => b !== null);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
    },
    totalUpcomingJobs: total,
    todayJobsCount,
  };
}
