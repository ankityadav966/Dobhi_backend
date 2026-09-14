import { prisma } from '../prisma.client';
import logger from '../utils/logger';
import { BookingStatus, EscrowStatus, OnboardingStatus, PaymentStatus } from '@prisma/client';
import { addStandardFields } from '../utils/id-generator';
import { recordIgnore } from './helper-discipline.service';
import { emitToHelper, emitToHelpers } from '../socket/socket.service';
import { sendPushToHelperIds, sendPushNotification } from './push.service';
import { convertISTToUTC } from '../utils/timezone';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import tz from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(tz);

export interface BookingRequestInput {
  customerId: number;
  serviceId: number;
  servicePlanId: number;
  totalAmount: number;
  address: string;
  city: string;
  pinCode: string;
  latitude: number;
  longitude: number;
  requestedDate: Date;
  requestedTime?: string;
  estimatedHours: number;
  description?: string;
  specialRequirements?: string;
  notes?: string;
}

export interface BookingRequestResponse {
  id: number;
  status: string;
  expiresAt: Date;
  acceptanceWindowSeconds: number;
  dispatchedTo?: number[];
}

const ACCEPTANCE_WINDOW_SECONDS = 30; // Configurable via env
const EARTH_RADIUS_KM = 6371;
const MAX_DISPATCH_RADIUS_KM = 5;
const BATCH_SIZE = 3; // Smart batching: dispatch 3 helpers per batch
const MAX_RETRIES = 3; // Max 3 batches total (90 seconds across 3x30s windows)

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  return distance;
}

/**
 * Check if helper has conflicting bookings during requested time period
 * 
 * CRITICAL: Queries Booking table directly, NOT via bookingRequest relation
 * Checks for overlapping PENDING_PAYMENT, CONFIRMED, or IN_PROGRESS bookings
 */
async function hasConflictingBooking(
  helperId: number,
  requestedDate: Date,
  estimatedHours: number
): Promise<boolean> {
  try {
    const bookingPeriodEnd = new Date(
      requestedDate.getTime() + estimatedHours * 60 * 60 * 1000
    );

    // Query Booking table directly by helperId
    // Check for overlapping time periods with active statuses
    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        helperId, // Direct field lookup
        status: {
          in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS],
        },
        startTime: {
          lt: bookingPeriodEnd, // Existing booking starts before our period ends
        },
        OR: [
          {
            endTime: {
              gt: requestedDate, // Existing booking ends after our period starts
            },
          },
          {
            endTime: null, // Active booking with no end time set yet
          },
        ],
      },
    });

    return !!conflictingBooking;
  } catch (error) {
    logger.error('Error checking conflicting bookings:', error);
    throw error;
  }
}

/**
 * Check whether the requested start time violates the admin-configured minimum
 * gap between a helper's last booking end and the next booking start.
 *
 * Returns true (helper ineligible) when:
 *   requestedDate < lastBooking.endTime + gapHours
 */
async function violatesBookingGap(
  helperId: number,
  requestedDate: Date,
  gapHours: number
): Promise<boolean> {
  try {
    const lastBooking = await prisma.booking.findFirst({
      where: {
        helperId,
        status: { in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS, BookingStatus.COMPLETED] },
        endTime: { not: null },
      },
      orderBy: { endTime: 'desc' },
      select: { endTime: true },
    });

    if (!lastBooking?.endTime) return false;

    const nextAllowedTime = new Date(lastBooking.endTime.getTime() + gapHours * 60 * 60 * 1000);
    return requestedDate < nextAllowedTime;
  } catch (error) {
    logger.error('Error checking booking gap:', error);
    throw error;
  }
}

/**
 * Check if helper has a CONFIRMED booking starting within the next 30 minutes.
 * Prevents dispatching to a helper who is about to begin another job.
 */
async function hasUpcomingBookingSoon(helperId: number): Promise<boolean> {
  try {
    const now = new Date();
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);

    const upcomingBooking = await prisma.booking.findFirst({
      where: {
        helperId,
        status: BookingStatus.CONFIRMED,
        startTime: {
          gt: now,
          lte: thirtyMinutesFromNow,
        },
      },
    });

    return !!upcomingBooking;
  } catch (error) {
    logger.error('Error checking upcoming bookings:', error);
    throw error;
  }
}

/**
 * Find nearby helpers based on location and serviceId
 * Returns helpers sorted by distance ASC then rating DESC, excluding those with conflicting bookings
 */
async function findNearbyHelpers(
  latitude: number,
  longitude: number,
  serviceId: number,
  customerId: number,
  requestedDate: Date,
  estimatedHours: number,
  maxDistance: number = MAX_DISPATCH_RADIUS_KM,
  excludeHelperIds: number[] = [] // Exclude helpers from previous batches
): Promise<number[]> {
  try {
    // Get all active, approved helpers offering the exact requested service
    // Availability is determined by isOnline + onboardingStatus + user status + time-conflict checks below
    const helpers = await prisma.helper.findMany({
      where: {
        isOnline: true,
        onboardingStatus: OnboardingStatus.APPROVED,
        user: { isActive: true, isBlocked: false, suspendedUntil: null },
        helperServices: {
          some: {
            serviceId,
          },
        },
        profile: {
          isNot: null,
        },
        id: {
          notIn: excludeHelperIds, // INTELLIGENT RETRY: Skip already-dispatched helpers
        },
      },
      select: {
        id: true,
        rating: true,
        lastJobAssignedAt: true, // FAIRNESS: Track job assignment history
        profile: { select: { latitude: true, longitude: true } },
      },
    });

    // Compute distance, filter by radius, sort by distance + fairness
    const nearbyHelpers = helpers
      .reduce<{ id: number; rating: number; distance: number; lastJobAssignedAt: Date | null }[]>((acc, helper) => {
        const lat = helper.profile?.latitude;
        const lng = helper.profile?.longitude;
        if (lat == null || lng == null) return acc;
        const distance = calculateDistance(latitude, longitude, lat, lng);
        if (distance <= maxDistance) {
          acc.push({ id: helper.id, rating: helper.rating, distance, lastJobAssignedAt: helper.lastJobAssignedAt });
        }
        return acc;
      }, [])
      .sort((a, b) => {
        // FAIRNESS ROTATION: Sort by distance first, then by least recently assigned
        if (a.distance !== b.distance) return a.distance - b.distance; // Nearest first
        
        // If same distance, prioritize helpers not recently assigned (fairness rotation)
        // Nulls come first (never assigned), then oldest assignments first
        if (a.lastJobAssignedAt === null && b.lastJobAssignedAt === null) return 0;
        if (a.lastJobAssignedAt === null) return -1; // a has never been assigned, prioritize a
        if (b.lastJobAssignedAt === null) return 1;  // b has never been assigned, prioritize b
        
        // Both have been assigned - prioritize the one assigned least recently
        return a.lastJobAssignedAt.getTime() - b.lastJobAssignedAt.getTime();
      })
      .slice(0, BATCH_SIZE) // Batch dispatch: take first 3 helpers
      .map(h => h.id);

    logger.info('Found nearby helpers', {
      count: nearbyHelpers.length,
      serviceId,
      batchSize: BATCH_SIZE,
      fairnessEnabled: true,
    });

    // Fetch admin-configured booking gap (default 2 h if row missing)
    const platformSetting = await prisma.platformSetting.findUnique({
      where: { id: 1 },
      select: { helperBookingGapHours: true },
    });
    const gapHours = platformSetting?.helperBookingGapHours ?? 2;

    // Run all three availability checks for each helper in parallel
    const checkResults = await Promise.all(
      nearbyHelpers.map(async helperIdToCheck => {
        const [hasConflict, startingSoon, gapViolation] = await Promise.all([
          hasConflictingBooking(helperIdToCheck, requestedDate, estimatedHours),
          hasUpcomingBookingSoon(helperIdToCheck),
          violatesBookingGap(helperIdToCheck, requestedDate, gapHours),
        ]);
        return { helperIdToCheck, eligible: !hasConflict && !startingSoon && !gapViolation };
      })
    );

    const availableHelpers = checkResults
      .filter(r => r.eligible)
      .map(r => r.helperIdToCheck);

    logger.info('Filtered helpers after conflict check', {
      beforeFilter: nearbyHelpers.length,
      afterFilter: availableHelpers.length,
      gapHours,
      excludedFromPreviousBatches: excludeHelperIds.length,
    });

    return availableHelpers;
  } catch (error) {
    logger.error('Error finding nearby helpers:', error);
    return [];
  }
}

/**
 * Create booking request and dispatch to nearby helpers
 * 
 * DB-based expiry: expiresAt timestamp is set, cron job handles cleanup
 * Stores list of dispatched helper IDs for intelligent redispatch
 */
export async function createAndDispatchBookingRequest(
  input: BookingRequestInput
): Promise<BookingRequestResponse> {
  try {
    if (typeof input.totalAmount !== 'number' || input.totalAmount <= 0) {
      throw new Error('Invalid totalAmount');
    }

    const expiresAt = new Date(Date.now() + ACCEPTANCE_WINDOW_SECONDS * 1000);

    // Find potential helpers BEFORE creating request
    const nearbyHelpers = await findNearbyHelpers(
      input.latitude,
      input.longitude,
      input.serviceId,
      input.customerId,
      input.requestedDate,
      input.estimatedHours
    );

    if (nearbyHelpers.length === 0) {
      logger.warn('No available helpers found for dispatch', {
        serviceId: input.serviceId,
        latitude: input.latitude,
        longitude: input.longitude,
      });
    }

    // Explicitly extract clean integer IDs for safe DB persistence (Int[] field)
    const helperIds: number[] = nearbyHelpers.map(id => Number(id));
    console.log('Helper IDs to save:', helperIds);

    // Create booking request with initial dispatch list
    const bookingRequest = await prisma.bookingRequest.create({
      data: {
        customerId: input.customerId,
        serviceId: input.serviceId,
        servicePlanId: input.servicePlanId,
        address: input.address,
        city: input.city,
        pinCode: input.pinCode,
        latitude: input.latitude,
        longitude: input.longitude,
        requestedDate: input.requestedDate,
        requestedTime: input.requestedTime,
        estimatedHours: input.estimatedHours,
        description: input.description,
        specialRequirements: input.specialRequirements,
        notes: input.notes,
        expiresAt,
        status: 'PENDING',
        helperId: null, // Set to null; assigned during acceptance
        dispatchedHelperIds: helperIds, // CRITICAL: full array of clean integer IDs
        bookingId: null, // Assigned when booking is created upon acceptance
        totalAmount: input.totalAmount,
      },
    });

    console.log('Saved in DB:', bookingRequest.dispatchedHelperIds);

    logger.info('Booking request created and dispatched', {
      requestId: bookingRequest.id,
      customerId: input.customerId,
      dispatchedHelpersCount: helperIds.length,
      dispatchedHelperIds: helperIds,
      dispatchedHelpersFromDB: bookingRequest.dispatchedHelperIds, // Verify what was saved
      expiresInSeconds: ACCEPTANCE_WINDOW_SECONDS,
    });

    // ── Real-time: notify each dispatched helper ────────────────────────────
    if (helperIds.length > 0) {
      // Fetch UI data in parallel — one query per entity, no per-helper loops
      const [customer, service, helperProfiles] = await Promise.all([
        prisma.user.findUnique({ where: { id: input.customerId }, select: { id: true, fullName: true } }),
        prisma.service.findUnique({ where: { id: input.serviceId }, select: { id: true, name: true } }),
        prisma.helper.findMany({
          where: { id: { in: helperIds } },
          select: { id: true, profile: { select: { latitude: true, longitude: true } } },
        }),
      ]);

      const startTime = dayjs(input.requestedDate).format('hh:mm A');
      const endTime = dayjs(input.requestedDate).add(input.estimatedHours, 'hour').format('hh:mm A');

      const basePayload = {
        requestId: bookingRequest.id,
        customer: { id: customer?.id ?? input.customerId, name: customer?.fullName ?? '' },
        service: { id: service?.id ?? input.serviceId, name: service?.name ?? '' },
        earnings: { amount: input.totalAmount },
        timing: {
          date: input.requestedDate,
          startTime,
          endTime,
          durationHours: input.estimatedHours,
        },
        location: { address: input.address, city: input.city },
        meta: { expiresInSeconds: ACCEPTANCE_WINDOW_SECONDS },
      };

      for (const helper of helperProfiles) {
        const hlat = helper.profile?.latitude ?? input.latitude;
        const hlng = helper.profile?.longitude ?? input.longitude;
        let distanceKm = Number(calculateDistance(input.latitude, input.longitude, hlat, hlng).toFixed(2));
        if (distanceKm === 0) distanceKm = 0.1;
        const payload = { ...basePayload, location: { ...basePayload.location, distanceKm } };
        console.log(
          'DISPATCH PAYLOAD',
          JSON.stringify({ helperId: helper.id, requestId: bookingRequest.id, payload }, null, 2)
        );
        emitToHelper(helper.id, 'booking:new', payload);
      }
      // Non-blocking: push to each dispatched helper
      sendPushToHelperIds(
        helperIds,
        'New Job Available',
        'A new booking request is available near you',
        { type: 'BOOKING_NEW', requestId: String(bookingRequest.id) },
        'BOOKING_NEW',
      ).catch(() => {});
    }

    return {
      id: bookingRequest.id,
      status: 'PENDING',
      expiresAt,
      acceptanceWindowSeconds: ACCEPTANCE_WINDOW_SECONDS,
      dispatchedTo: helperIds,
    };
  } catch (error) {
    logger.error('Error creating booking request:', error);
    throw error;
  }
}

/**
 * Accept booking request with ACID transaction
 * 
 * CRITICAL FLOW:
 * 1. Validate request exists and not expired
 * 2. Check helper has no conflicting bookings
 * 3. Use conditional UPDATE where {id, status: 'PENDING'} - NO helperId check
 *    Only one helper can win the race
 * 4. Create Booking with status: 'PENDING_PAYMENT', helperId: accepting helper
 * 5. Update BookingRequest with helperId: accepting helper
 * 6. Reject competing BookingRequests from same customer
 */
export async function acceptBookingRequest(
  requestId: number,
  userId: number
): Promise<{ bookingId: number; message: string }> {
  // Resolve User → Helper before entering the transaction.
  // BookingRequest.helperId and Booking.helperId both reference Helper.id,
  // not User.id, so we must look this up once here and close over it.
  const helperRecord = await prisma.helper.findUnique({
    where: { userId },
    select: { id: true, userId: true, onboardingStatus: true, isOnline: true, isAvailable: true },
  });

  if (!helperRecord) {
    throw new Error('Helper profile not found for this user. Onboarding may be incomplete.');
  }

  if (helperRecord.onboardingStatus !== OnboardingStatus.APPROVED) {
    throw new Error('Onboarding not approved. Cannot accept booking.');
  }

  if (!helperRecord.isOnline) {
    throw new Error('Helper must be online to accept booking');
  }

  if (!helperRecord.isAvailable) {
    throw new Error('Helper is not available');
  }

  const helperId = helperRecord.id;
  let _notifyCustomerId = 0;

  const transactionResult = await prisma.$transaction(async tx => {
    // STEP 1: Load request
    const request = await tx.bookingRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error('Request not found');
    }

    // STEP 1.5: Idempotency guard — reject if already accepted to prevent duplicate bookings
    if (request.status === 'ACCEPTED') {
      throw new Error('Booking already accepted');
    }

    // STEP 2: Validate not expired
    if (new Date() > request.expiresAt) {
      await tx.bookingRequest.update({
        where: { id: requestId },
        data: {
          status: 'EXPIRED',
          expiresAt: new Date(),
        },
      });
      throw new Error('Request has expired');
    }

    // STEP 2.5: ATOMIC HELPER AVAILABILITY CHECK
    // Use conditional UPDATE to ensure helper is still available
    // This prevents race condition where multiple requests try to claim same helper
    const helperAvailabilityCheck = await tx.helper.updateMany({
      where: {
        id: helperId,
        isAvailable: true, // CRITICAL: Only proceed if currently available
      },
      data: {
        isAvailable: false, // Lock helper immediately
      },
    });

    // Check if update succeeded - count > 0 means we got the lock
    if (helperAvailabilityCheck.count === 0) {
      throw new Error('Helper is no longer available (race condition)');
    }

    // STEP 3: Verify helper availability
    const hasConflict = await hasConflictingBooking(
      helperId,
      request.requestedDate,
      request.estimatedHours
    );

    if (hasConflict) {
      // Restore helper availability if conflict detected
      await tx.helper.update({
        where: { id: helperId },
        data: { isAvailable: true },
      });
      throw new Error(
        'Helper has conflicting booking during this time period'
      );
    }

    // Fetch service plan to determine totalAmount
    const plan = await tx.servicePlan.findUnique({
      where: { id: request.servicePlanId },
      select: { price: true },
    });
    if (!plan) {
      throw new Error('Service plan not found for this booking request');
    }
    const budgetAmount = plan.price;

    // Fetch platform commission rate — snapshot it immediately so admin changes
    // never retroactively affect already-created bookings.
    const platformSetting = await tx.platformSetting.findUnique({
      where: { id: 1 },
      select: { commissionRate: true },
    });
    const commissionRate = platformSetting?.commissionRate ?? 0.20;
    const platformCommissionAmount = parseFloat((budgetAmount * commissionRate).toFixed(2));
    const helperPayoutAmount       = parseFloat((budgetAmount - platformCommissionAmount).toFixed(2));

    // STEP 4B: CRITICAL - Conditional update on status only (NO helperId check)
    // This allows ANY helper to accept, but only the first one succeeds
    // The updateMany condition already handles race safety
    const updatedRequest = await tx.bookingRequest.updateMany({
      where: {
        id: requestId,
        status: 'PENDING', // Only proceed if still PENDING
        // DO NOT filter by helperId - any helper can accept
      },
      data: {
        status: 'ACCEPTED',
        helperId, // Update to assigning helper
        respondedAt: new Date(),
      },
    });

    // Check if update succeeded - count > 0 means we won the race
    if (updatedRequest.count === 0) {
      // Notify the losing helper in real-time
      emitToHelper(helperId, 'booking:alreadyAccepted', {
        requestId,
        message: 'This booking was accepted by another helper.',
      });
      throw new Error('Request was already accepted by another helper');
    }

    // STEP 5: Create Booking + Payment atomically (PENDING_PAYMENT status)
    // Payment row is ALWAYS created here and nowhere else.
    // Uniqueness is enforced by Payment.bookingId @unique.
    // ✅ CRITICAL FIX: Combine date + time BEFORE converting IST → UTC
    // User selects time in IST (e.g., "06:00 PM"), we must convert to UTC
    const date = dayjs(request.requestedDate).format('YYYY-MM-DD');
    const istDateTime = dayjs.tz(`${date} ${request.requestedTime}`, 'YYYY-MM-DD hh:mm A', 'Asia/Kolkata');
    const utcStartTime = istDateTime.utc().toDate();
    const utcEndTime = new Date(
      utcStartTime.getTime() + request.estimatedHours * 60 * 60 * 1000
    );
    const utcBookingDate = new Date(utcStartTime);
    utcBookingDate.setHours(0, 0, 0, 0);

    const booking = await tx.booking.create({
      data: {
        customerId: request.customerId,
        helperId, // CRITICAL: Direct helperId in Booking
        serviceId: request.serviceId,
        servicePlanId: request.servicePlanId, // Sourced from booking request, not hardcoded
        address: request.address,
        city: request.city,
        pinCode: request.pinCode,
        latitude: request.latitude,
        longitude: request.longitude,
        bookingDate: utcBookingDate,
        startTime: utcStartTime,
        endTime: utcEndTime,
        totalAmount: budgetAmount,
        totalHours: request.estimatedHours,
        specialRequirements: request.specialRequirements,
        notes: request.notes,
        bookingRequestId: String(requestId),
        duration: request.estimatedHours,
        finalAmount: budgetAmount,
        location: request.address,
        status: BookingStatus.PENDING_PAYMENT,
        paymentExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        // Commission snapshot — frozen at booking creation
        commissionRateSnapshot:   commissionRate,
        platformCommissionAmount: platformCommissionAmount,
        helperPayoutAmount:       helperPayoutAmount,
      },
    });

    // STEP 5b: Create Payment row atomically — no orphan bookings allowed.
    // This is the ONLY place a Payment row is ever created.
    await tx.payment.create({
      data: {
        bookingId: booking.id,
        amount: booking.finalAmount,
        status: PaymentStatus.CREATED,
        escrowStatus: EscrowStatus.PENDING, // Escrow is NOT locked until payment is captured
        // razorpayOrderId will be set later when customer initiates payment
      },
    });

    logger.info('Booking + Payment created atomically', {
      requestId,
      helperId,
      bookingId: booking.id,
      amount: booking.finalAmount,
      status: BookingStatus.PENDING_PAYMENT,
    });

    // FAIRNESS ROTATION: Update helper's lastJobAssignedAt timestamp
    // This tracks when the helper last received a job for fair distribution
    await tx.helper.update({
      where: { id: helperId },
      data: {
        lastJobAssignedAt: new Date(),
      },
    });

    logger.info('Helper job assignment timestamp updated', {
      helperId,
      lastJobAssignedAt: new Date(),
    });

    // ── Real-time: AUTO-REJECT other dispatched helpers ──
    // Immediately notify every OTHER dispatched helper that request is taken
    // This prevents multiple helpers from accepting the same request
    if (request.dispatchedHelperIds && request.dispatchedHelperIds.length > 0) {
      emitToHelpers(request.dispatchedHelperIds, 'booking:closed', {
        requestId,
        reason: 'accepted_by_another',
        message: 'This booking request was accepted by another helper.',
      }, helperId /* exclude the winning helper */);
    }

    // STEP 6: Reject other pending requests from same customer in same transaction
    await tx.bookingRequest.updateMany({
      where: {
        customerId: request.customerId,
        status: 'PENDING',
        id: { not: requestId },
      },
      data: {
        status: 'REJECTED',
        rejectionReason: 'Another request was accepted',
        rejectedAt: new Date(),
      },
    });

    _notifyCustomerId = request.customerId;
    return {
      bookingId: booking.id,
      message: 'Booking reserved. Awaiting payment confirmation.',
    };
  });

  // Non-blocking push notifications — fire after transaction commits
  if (_notifyCustomerId) {
    sendPushNotification(
      _notifyCustomerId,
      'Booking Confirmed',
      'A helper has accepted your booking request',
      { type: 'BOOKING_ACCEPTED', bookingId: String(transactionResult.bookingId) },
      'BOOKING_ACCEPTED',
    ).catch(() => {});
  }
  sendPushNotification(
    helperRecord.userId,
    'Job Assigned',
    'You have been assigned a new booking',
    { type: 'BOOKING_ASSIGNED', bookingId: String(transactionResult.bookingId) },
    'BOOKING_ASSIGNED',
  ).catch(() => {});

  return transactionResult;
}

/**
 * Reject booking request — production-grade Uber-style multi-helper dispatch
 *
 * Flow:
 * 1. Resolve userId → helperId (dispatchedHelperIds stores Helper.id, not User.id)
 * 2. Inside transaction: validate, remove helper, determine next action
 *    - NOTIFY_REMAINING  → other helpers still in batch, stay PENDING
 *    - REDISPATCH        → batch emptied but time remaining, find new batch outside tx
 *    - TERMINAL          → batch emptied and time expired → EXPIRED
 * 3. Outside transaction: emit real-time events, and run redispatch if needed
 *    - findNearbyHelpers excludes everyone already tried
 *    - If new helpers found: update DB + emit booking:new + push
 *    - If none found: mark FAILED
 */
export async function rejectBookingRequest(
  requestId: number,
  userId: number,
  reason?: string
): Promise<{ remainingHelpers: number; status: string }> {
  // ── Resolve User → Helper (must happen before transaction) ────────────────
  const helperRecord = await prisma.helper.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!helperRecord) {
    throw new Error('Helper profile not found for this user');
  }
  const helperId = helperRecord.id;

  // ── Phase 1: Atomic DB validation + state transition ─────────────────────
  type TxResult =
    | { action: 'NOTIFY_REMAINING'; updatedHelpers: number[] }
    | {
        action: 'REDISPATCH';
        allTriedHelpers: number[];
        reqInfo: {
          latitude: number; longitude: number; serviceId: number;
          customerId: number; requestedDate: Date; estimatedHours: number;
          servicePlanId: number; address: string; city: string;
          expiresAt: Date | null; totalAmount: number;
        };
      }
    | { action: 'TERMINAL'; terminalStatus: 'EXPIRED'; lastBatch: number[] };

  const txResult: TxResult = await prisma.$transaction(async tx => {
    const request = await tx.bookingRequest.findUnique({ where: { id: requestId } });

    if (!request) throw new Error('Request not found');
    if (request.status !== 'PENDING') {
      throw new Error(`Cannot reject request with status: ${request.status}`);
    }
    // Race condition guard — if another helper already accepted, abort
    if (request.helperId !== null) {
      throw new Error('Request already accepted by another helper');
    }

    const dispatchedHelpers = request.dispatchedHelperIds || [];
    if (!dispatchedHelpers.includes(helperId)) {
      logger.warn('Rejection attempt by non-dispatched helper', {
        requestId, helperId, userId, dispatchedHelpers,
      });
      throw new Error('Only dispatched helpers can reject this request');
    }

    const updatedHelpers = dispatchedHelpers.filter(id => id !== helperId);
    const now = new Date();
    const timeExpired = request.expiresAt ? now > request.expiresAt : true;

    if (updatedHelpers.length > 0) {
      // ── CASE A: Other helpers still in batch → stay PENDING ──────────────
      await tx.bookingRequest.update({
        where: { id: requestId },
        data: { dispatchedHelperIds: updatedHelpers },
      });
      return { action: 'NOTIFY_REMAINING' as const, updatedHelpers };
    }

    if (timeExpired) {
      // ── CASE C: All rejected + time expired → EXPIRED ────────────────────
      // Capture the batch before clearing so we can notify them after the tx.
      await tx.bookingRequest.update({
        where: { id: requestId },
        data: {
          status: 'EXPIRED',
          dispatchedHelperIds: [],
          rejectedAt: now,
          rejectionReason: reason ?? 'All dispatched helpers rejected and request expired',
        },
      });
      return {
        action: 'TERMINAL' as const,
        terminalStatus: 'EXPIRED' as const,
        lastBatch: dispatchedHelpers, // carry out for post-tx notification
      };
    }

    // ── CASE B: All rejected but time remains → prepare for redispatch ──────
    // Do NOT touch dispatchedHelperIds here — leaving the old batch in place
    // ensures the row is never in the invalid state (PENDING + empty array).
    // The redispatch step outside the transaction will atomically overwrite it
    // with the new batch only after successfully finding new helpers.
    return {
      action: 'REDISPATCH' as const,
      allTriedHelpers: dispatchedHelpers, // full original batch — used for exclusion
      reqInfo: {
        latitude: request.latitude,
        longitude: request.longitude,
        serviceId: request.serviceId,
        customerId: request.customerId,
        requestedDate: request.requestedDate,
        estimatedHours: request.estimatedHours,
        servicePlanId: request.servicePlanId,
        address: request.address,
        city: request.city,
        expiresAt: request.expiresAt ?? null,
        totalAmount: request.totalAmount,
      },
    };
  });

  // ── Phase 2: Post-transaction side effects ────────────────────────────────

  // Always ACK the rejecting helper immediately
  emitToHelper(helperId, 'booking:rejected_ack', {
    requestId,
    message: 'Your rejection has been recorded.',
  });

  if (txResult.action === 'NOTIFY_REMAINING') {
    const { updatedHelpers } = txResult;

    // Inform remaining helpers that the batch size changed
    emitToHelpers(updatedHelpers, 'booking:update', {
      requestId,
      remainingHelpers: updatedHelpers.length,
    });

    logger.info('Helper rejected — request PENDING for remaining helpers', {
      requestId, rejectingHelperId: helperId, remainingHelpers: updatedHelpers, reason,
    });

    return { remainingHelpers: updatedHelpers.length, status: 'PENDING' };
  }

  if (txResult.action === 'TERMINAL') {
    // Notify the last batch that the request is gone so their UIs clear
    if (txResult.lastBatch.length > 0) {
      emitToHelpers(txResult.lastBatch, 'booking:closed', {
        requestId,
        reason: 'expired_or_failed',
        message: 'This booking request has expired.',
      });
    }
    logger.info('All helpers rejected + time expired — request EXPIRED', {
      requestId, rejectingHelperId: helperId, lastBatch: txResult.lastBatch, reason,
    });
    return { remainingHelpers: 0, status: 'EXPIRED' };
  }

  // ── REDISPATCH path ───────────────────────────────────────────────────────
  const { allTriedHelpers, reqInfo } = txResult;

  const newHelpers = await findNearbyHelpers(
    reqInfo.latitude,
    reqInfo.longitude,
    reqInfo.serviceId,
    reqInfo.customerId,
    reqInfo.requestedDate,
    reqInfo.estimatedHours,
    MAX_DISPATCH_RADIUS_KM,
    allTriedHelpers, // exclude everyone tried in the current batch
  );

  const newHelperIds: number[] = newHelpers.map(id => Number(id));

  if (newHelperIds.length > 0) {
    // Atomically set the new batch (guard: request must still be PENDING)
    await prisma.bookingRequest.updateMany({
      where: { id: requestId, status: 'PENDING' },
      data: { dispatchedHelperIds: newHelperIds },
    });

    const expiresAt = reqInfo.expiresAt ?? new Date(Date.now() + ACCEPTANCE_WINDOW_SECONDS * 1000);

    // Fetch UI data for redispatch payload — one query per entity, no per-helper loops
    const [rdCustomer, rdService, rdHelperProfiles] = await Promise.all([
      prisma.user.findUnique({ where: { id: reqInfo.customerId }, select: { id: true, fullName: true } }),
      prisma.service.findUnique({ where: { id: reqInfo.serviceId }, select: { id: true, name: true } }),
      prisma.helper.findMany({
        where: { id: { in: newHelperIds } },
        select: { id: true, profile: { select: { latitude: true, longitude: true } } },
      }),
    ]);

    const rdStartTime = dayjs(reqInfo.requestedDate).format('hh:mm A');
    const rdEndTime = dayjs(reqInfo.requestedDate).add(reqInfo.estimatedHours, 'hour').format('hh:mm A');

    const rdBasePayload = {
      requestId,
      customer: { id: rdCustomer?.id ?? reqInfo.customerId, name: rdCustomer?.fullName ?? '' },
      service: { id: rdService?.id ?? reqInfo.serviceId, name: rdService?.name ?? '' },
      earnings: { amount: reqInfo.totalAmount },
      timing: {
        date: reqInfo.requestedDate,
        startTime: rdStartTime,
        endTime: rdEndTime,
        durationHours: reqInfo.estimatedHours,
      },
      location: { address: reqInfo.address, city: reqInfo.city },
      meta: { expiresInSeconds: ACCEPTANCE_WINDOW_SECONDS },
    };

    for (const rdHelper of rdHelperProfiles) {
      const hlat = rdHelper.profile?.latitude ?? reqInfo.latitude;
      const hlng = rdHelper.profile?.longitude ?? reqInfo.longitude;
      let distanceKm = Number(calculateDistance(reqInfo.latitude, reqInfo.longitude, hlat, hlng).toFixed(2));
      if (distanceKm === 0) distanceKm = 0.1;
      const rdPayload = { ...rdBasePayload, location: { ...rdBasePayload.location, distanceKm } };
      console.log(
        'DISPATCH PAYLOAD',
        JSON.stringify({ helperId: rdHelper.id, requestId, payload: rdPayload }, null, 2)
      );
      emitToHelper(rdHelper.id, 'booking:new', rdPayload);
    }
    sendPushToHelperIds(
      newHelperIds,
      'New Job Available',
      'A new booking request is available near you',
      { type: 'BOOKING_NEW', requestId: String(requestId) },
      'BOOKING_NEW',
    ).catch(() => {});

    logger.info('All batch helpers rejected — redispatched to new batch', {
      requestId, rejectingHelperId: helperId,
      newHelpers: newHelperIds, excludedHelpers: allTriedHelpers, reason,
    });

    return { remainingHelpers: newHelperIds.length, status: 'PENDING' };
  }

  // No new helpers available at all → FAILED
  // Notify the last known batch before the array is cleared
  if (allTriedHelpers.length > 0) {
    emitToHelpers(allTriedHelpers, 'booking:closed', {
      requestId,
      reason: 'expired_or_failed',
      message: 'This booking request could not be filled.',
    });
  }

  await prisma.bookingRequest.updateMany({
    where: { id: requestId, status: 'PENDING' },
    data: {
      status: 'FAILED',
      dispatchedHelperIds: [],
      rejectedAt: new Date(),
      rejectionReason: reason ?? 'All dispatched helpers rejected and no new helpers available',
    },
  });

  logger.info('No new helpers for redispatch — request FAILED', {
    requestId, rejectingHelperId: helperId, triedHelpers: allTriedHelpers, reason,
  });

  return { remainingHelpers: 0, status: 'FAILED' };
}

/**
 * Process expired booking requests via cron job
 * Implements sophisticated retry logic:
 * - Phase 1 (0-30s): Initial batch of 3 helpers
 * - Phase 2 (30-60s): Timeout triggers redispatch to next 3 helpers
 * - Phase 3 (60-90s): Final retry to next 3 helpers
 * - Final (90+s): Mark as FAILED if all 3 batches expire
 * 
 * Batching Strategy:
 * - Each batch gets 30-second acceptance window
 * - Max 3 batches = 90 seconds total dispatch window
 * - Intelligent redispatch excludes previously-dispatched helpers
 * - Maintains dispatchedHelperIds array for tracking all attempted helpers
 * 
 * Called every 5 seconds to clean up PENDING requests past expiresAt
 */
export async function processExpiredRequests(): Promise<{
  processedCount: number;
  errorCount: number;
  errors: Array<{ requestId: string; error: string }>;
  ignoreRecordedCount: number;
}> {
  const now = new Date();
  const result = {
    processedCount: 0,
    errorCount: 0,
    errors: [] as Array<{ requestId: string; error: string }>,
    ignoreRecordedCount: 0,
  };

  try {
    // Find all PENDING requests where expiresAt <= NOW (lte includes exact-second expiry)
    // Need to fetch dispatchedHelperIds and helperId to record ignore discipline
    const expiredRequests = await prisma.bookingRequest.findMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          lte: now,
        },
      },
      select: { 
        id: true,
        bookingId: true,
        helperId: true,
        dispatchedHelperIds: true,
      },
    });

    if (expiredRequests.length === 0) {
      logger.debug('No expired requests to process');
      return result;
    }

    logger.info(`Processing ${expiredRequests.length} expired booking requests`, {
      maxRetries: MAX_RETRIES,
      batchSize: BATCH_SIZE,
      totalDispatchWindow: `${MAX_RETRIES * ACCEPTANCE_WINDOW_SECONDS}s`,
    });

    // Batch update all expired requests
    const updateResult = await prisma.bookingRequest.updateMany({
      where: {
        id: { in: expiredRequests.map(r => r.id) },
        status: 'PENDING', // Race condition check
      },
      data: {
        status: 'EXPIRED',
      },
    });

    result.processedCount = updateResult.count;

    if (updateResult.count > 0) {
      logger.info('Booking requests expired by cron', {
        count: updateResult.count,
        retryPolicy: `Max ${MAX_RETRIES} batches of ${BATCH_SIZE} helpers each`,
      });

      // ── Real-time: notify every dispatched helper their request expired ──
      for (const req of expiredRequests) {
        if (req.dispatchedHelperIds && req.dispatchedHelperIds.length > 0) {
          emitToHelpers(req.dispatchedHelperIds, 'booking:expired', {
            requestId: req.id,
            message: 'This booking request has expired.',
          });
        }
      }
    }

    // Record ignore discipline for helpers who were dispatched but didn't respond
    // Only record if helperId is null (no helper accepted the request)
    for (const request of expiredRequests) {
      if (!request.helperId && request.dispatchedHelperIds && request.dispatchedHelperIds.length > 0) {
        for (const helperId of request.dispatchedHelperIds) {
          try {
            const ignoreResult = await recordIgnore(String(helperId));
            if (ignoreResult.suspended) {
              logger.warn('Ignore discipline recorded: Helper suspended', {
                requestId: request.id,
                helperId,
                ignoreCount: ignoreResult.ignoreCount,
                suspendedUntil: ignoreResult.suspendedUntil,
              });
              result.ignoreRecordedCount++;
            } else {
              result.ignoreRecordedCount++;
            }
          } catch (error) {
            logger.error('Failed to record ignore discipline', {
              requestId: request.id,
              helperId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            // Don't fail the overall process if discipline recording fails
          }
        }
      }
    }
  } catch (error) {
    logger.error('Error processing expired requests:', error);
    result.errorCount++;
    result.errors.push({
      requestId: 'batch_process',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return result;
}


/**
 * Get booking request status with complete state information
 * 
 * BookingRequest Status:
 * - PENDING: Awaiting acceptance
 * - ACCEPTED: Helper accepted, booking created
 * - REJECTED: Helper rejected or customer cancelled
 * - EXPIRED: No helpers accepted within window
 * 
 * Booking Status:
 * - PENDING_PAYMENT: Reserved, awaiting payment
 * - CONFIRMED: Payment confirmed
 * - IN_PROGRESS: Service ongoing
 * - COMPLETED: Service finished
 * - CANCELLED: Cancelled
 */
export async function getBookingRequestStatus(requestId: number): Promise<any> {
  try {
    const request = await prisma.bookingRequest.findUnique({
      where: { id: requestId },
      include: {
        helper: {
          select: {
            id: true,
            rating: true,
            user: { select: { fullName: true } },
            profile: { select: { latitude: true, longitude: true } },
          },
        },
        service: {
          select: { id: true, name: true },
        },
        booking: {
          select: {
            id: true,
            status: true,
            totalAmount: true,
          },
        },
      },
    });

    if (!request) {
      throw new Error('Request not found');
    }

    return {
      id: request.id,
      status: request.status,
      customer: { id: request.customerId },
      helper: request.helper,
      service: request.service,
      location: {
        address: request.address,
        city: request.city,
        latitude: request.latitude,
        longitude: request.longitude,
      },
      timing: {
        createdAt: request.createdAt,
        expiresAt: request.expiresAt,
        respondedAt: request.respondedAt,
        timeRemaining: Math.max(
          0,
          Math.ceil((request.expiresAt.getTime() - Date.now()) / 1000)
        ),
      },
      request: {
        estimatedHours: request.estimatedHours,
        description: request.description,
        dispatchedHelpers: request.dispatchedHelperIds?.length || 0,
      },
      booking: request.booking ?? null,
    };
  } catch (error) {
    logger.error('Error getting request status:', error);
    throw error;
  }
}

/**
 * Process expired payment timeouts for PENDING_PAYMENT bookings
 * Marks bookings as CANCELLED if payment wasn't completed within the deadline.
 * Called every 5 seconds by cron job.
 *
 * Bulk pattern (single atomic transaction):
 *  1. Snapshot IDs of all eligible PENDING_PAYMENT bookings (paymentExpiresAt <= now)
 *  2. Bulk-cancel those IDs in ONE updateMany — status guard in WHERE prevents double-cancellation
 *  3. Bulk-fail related Payment rows in ONE updateMany against the same ID set
 *
 * Race-condition safety: the `status: PENDING_PAYMENT` condition inside updateMany
 * acts as an optimistic lock — any booking already moved to another status by a
 * concurrent request is silently skipped, and cancelledCount reflects only real changes.
 */
export async function processPaymentExpirations(): Promise<{
  processedCount: number;
  errorCount: number;
  errors: Error[];
}> {
  try {
    const now = new Date();

    logger.info('processPaymentExpirations: function started', { now });

    // ── Step 1: Snapshot eligible booking IDs ──────────────────────────────
    // findMany here is non-atomic intentionally: the updateMany below re-checks
    // status, so any booking that changes state between here and the update is
    // safely excluded by the WHERE clause.
    const eligibleBookings = await prisma.booking.findMany({
      where: {
        status: BookingStatus.PENDING_PAYMENT,
        paymentExpiresAt: { lte: now },
      },
      select: { id: true },
    });

    const totalPendingPayment = await prisma.booking.count({
      where: { status: BookingStatus.PENDING_PAYMENT },
    });

    logger.info('processPaymentExpirations: snapshot complete', {
      totalPendingPayment,
      eligibleForCancellation: eligibleBookings.length,
      now,
    });

    if (eligibleBookings.length === 0) {
      logger.debug('processPaymentExpirations: no expired bookings found, skipping');
      return { processedCount: 0, errorCount: 0, errors: [] };
    }

    const eligibleIds = eligibleBookings.map(b => b.id);

    // ── Step 2 + 3: Atomic bulk cancel + bulk payment fail ──────────────────
    const [cancelResult, paymentResult] = await prisma.$transaction([
      // Bulk cancel — WHERE status guard ensures race-condition safety:
      // any booking already moved away from PENDING_PAYMENT is skipped
      prisma.booking.updateMany({
        where: {
          id: { in: eligibleIds },
          status: BookingStatus.PENDING_PAYMENT,   // optimistic lock
        },
        data: {
          status: BookingStatus.CANCELLED,
          cancelReason: 'Payment timeout - 5 minutes expired',
          cancelledBy: 'SYSTEM',
        },
      }),

      // Bulk fail payments — targets the same ID snapshot.
      // Idempotent: marking FAILED on a payment whose booking was already
      // handled concurrently is benign and correct.
      prisma.payment.updateMany({
        where: { bookingId: { in: eligibleIds } },
        data: { status: PaymentStatus.FAILED },
      }),
    ]);

    const cancelledCount = cancelResult.count;
    const paymentUpdatedCount = paymentResult.count;

    if (cancelledCount === 0) {
      logger.debug('processPaymentExpirations: updateMany returned 0 — all eligible bookings were already handled by a concurrent process', {
        eligibleIds,
      });
    } else {
      logger.info('processPaymentExpirations: bulk cancellation complete', {
        cancelledCount,
        paymentUpdatedCount,
        eligibleCount: eligibleIds.length,
        skippedByRaceCondition: eligibleIds.length - cancelledCount,
      });
    }

    return {
      processedCount: cancelledCount,
      errorCount: 0,
      errors: [],
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errMeta = (error as any)?.meta ?? null;
    logger.error('processPaymentExpirations: fatal error in bulk update', { error: errMsg, meta: errMeta });
    return {
      processedCount: 0,
      errorCount: 1,
      errors: [error instanceof Error ? error : new Error(String(error))],
    };
  }
}
