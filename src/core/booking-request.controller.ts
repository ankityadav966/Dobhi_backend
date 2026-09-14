import { Response } from 'express';
import {
  createAndDispatchBookingRequest,
  acceptBookingRequest,
  rejectBookingRequest,
  getBookingRequestStatus,
} from '../services/booking-dispatch.service';
import { prisma } from '../prisma.client';
import logger from '../utils/logger';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

/**
 * Create booking request and dispatch to nearby helpers
 * POST /api/booking-requests/create
 */
export const createBookingRequest = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const { serviceId, address, city, pinCode, latitude, longitude, estimatedHours, servicePlanId, description, specialRequirements, notes, requestedDate, requestedTime } = req.body;

    // Validate required fields
    if (!serviceId || !address || !city || !pinCode || latitude === undefined || longitude === undefined || !estimatedHours || !requestedDate || !requestedTime || !servicePlanId) {
      logger.warn('Booking request validation failed');
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: serviceId, servicePlanId, address, city, pinCode, latitude, longitude, estimatedHours, requestedDate, requestedTime',
      });
    }

    // Convert numeric values safely
    const lat = Number(latitude);
    const lon = Number(longitude);
    const hours = Number(estimatedHours);
    const planId = parseInt(servicePlanId, 10);

    // Validate numeric conversions
    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({
        success: false,
        message: 'latitude and longitude must be valid numbers',
      });
    }

    // Validate estimatedHours is a valid number between 1 and 12
    if (isNaN(hours) || hours < 1 || hours > 12) {
      return res.status(400).json({
        success: false,
        message: 'estimatedHours must be a number between 1 and 12',
      });
    }

    if (isNaN(planId) || planId < 1) {
      return res.status(400).json({
        success: false,
        message: 'servicePlanId must be a valid positive integer',
      });
    }

    // Validate requestedDate exists and is in the future with 1 hour buffer
    const requestDate = new Date(requestedDate);
    if (isNaN(requestDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'requestedDate must be a valid date',
      });
    }

    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    if (requestDate < oneHourFromNow) {
      return res.status(400).json({
        success: false,
        message: 'Booking must be scheduled at least 1 hour from now',
      });
    }

    // Validate requestedTime matches fixed time slots
    const validTimeSlots = [
      '06:00 AM', '07:00 AM', '08:00 AM', '09:00 AM', '10:00 AM',
      '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM',
      '03:00 PM', '04:00 PM', '05:00 PM',
      '06:00 PM', '07:00 PM', '08:00 PM',
    ];

    const timeStr = (requestedTime as string).trim();
    if (!validTimeSlots.includes(timeStr)) {
      return res.status(400).json({
        success: false,
        message: `Invalid time slot. Must be one of: ${validTimeSlots.join(', ')}`,
      });
    }

    // Get service and verify it exists
    const serviceIdNum = parseInt(serviceId, 10);
    if (isNaN(serviceIdNum)) {
      return res.status(400).json({ success: false, message: 'Invalid service ID' });
    }
    const service = await prisma.service.findUnique({
      where: { id: serviceIdNum },
      select: { id: true },
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    // Fetch service plan and compute totalAmount
    const plan = await prisma.servicePlan.findUnique({
      where: { id: planId },
      select: { id: true, price: true, serviceId: true },
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Service plan not found',
      });
    }

    if (plan.serviceId !== serviceIdNum) {
      return res.status(400).json({
        success: false,
        message: 'Service plan does not belong to the selected service',
      });
    }

    const totalAmount = plan.price;

    // Get user and verify is customer
    const userIdNum = parseInt(req.user?.userId ?? '0', 10);
    const user = await prisma.user.findUnique({
      where: { id: userIdNum },
      select: { id: true, role: true },
    });

    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'User not found',
      });
    }

    // Create and dispatch booking request
    const result = await createAndDispatchBookingRequest({
      customerId: userIdNum,
      serviceId: serviceIdNum,
      servicePlanId: planId,
      totalAmount,
      address,
      city,
      pinCode,
      latitude: lat,
      longitude: lon,
      estimatedHours: hours,
      description,
      specialRequirements,
      notes,
      requestedDate: requestDate,
      requestedTime: timeStr,
    });

    logger.info('Booking request created and dispatched', {
      requestId: result.id,
      userId: req.user?.userId,
    });

    return res.status(201).json({
      success: true,
      message: 'Booking request created and dispatched',
      data: result,
    });
  } catch (error) {
    logger.error('Error creating booking request:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create booking request',
      error: (error as Error).message,
    });
  }
};

/**
 * Accept booking request
 * POST /api/booking-requests/:requestId/accept
 */
export const acceptRequest = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  const { requestId } = req.params;

  try {
    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: 'Request ID is required',
      });
    }

    // Verify user is a helper
    const helperCheckUserId = parseInt(req.user?.userId ?? '0', 10);
    const user = await prisma.user.findUnique({
      where: { id: helperCheckUserId },
      select: { role: true },
    });

    if (!user || user.role !== 'HELPER') {
      return res.status(403).json({
        success: false,
        message: 'Only helpers can accept requests',
      });
    }

    // Accept the request
    const result = await acceptBookingRequest(parseInt(requestId, 10), helperCheckUserId);

    logger.info('Booking request accepted', {
      requestId,
      helperId: req.user?.userId,
    });

    return res.status(200).json({
      success: true,
      message: 'Request accepted successfully',
      data: result,
    });
  } catch (error) {
    const message = (error as Error).message;

    if (message.includes('expired')) {
      return res.status(410).json({
        success: false,
        message: 'This request has expired',
      });
    }

    if (message === 'Booking already accepted') {
      return res.status(409).json({
        success: false,
        message: 'Booking already accepted',
      });
    }

    if (message.includes('Onboarding not approved')) {
      return res.status(403).json({
        success: false,
        message: 'Onboarding not approved. Cannot accept booking.',
      });
    }

    if (message.includes('Helper profile not found')) {
      return res.status(403).json({
        success: false,
        message: 'Helper profile not found. Onboarding may be incomplete.',
      });
    }

    if (message.includes('not dispatched to you')) {
      return res.status(403).json({
        success: false,
        message: "This request wasn't dispatched to you",
      });
    }

    if (message.includes('already')) {
      return res.status(400).json({
        success: false,
        message: message,
      });
    }

    logger.error('Error accepting booking request:', error, { requestId });
    return res.status(500).json({
      success: false,
      message: 'Failed to accept request',
      error: message,
    });
  }
};

/**
 * Reject booking request
 * POST /api/booking-requests/:requestId/reject
 */
export const rejectRequest = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  const { requestId } = req.params;
  const { reason } = req.body;

  try {

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: 'Request ID is required',
      });
    }

    // Verify user is a helper
    const rejectUserId = parseInt(req.user?.userId ?? '0', 10);
    const user = await prisma.user.findUnique({
      where: { id: rejectUserId },
      select: { role: true },
    });

    if (!user || user.role !== 'HELPER') {
      return res.status(403).json({
        success: false,
        message: 'Only helpers can reject requests',
      });
    }

    // Reject the request
    const result = await rejectBookingRequest(
      parseInt(requestId, 10),
      rejectUserId,
      reason
    );

    logger.info('Booking request rejected', {
      requestId,
      helperId: req.user?.userId,
      reason,
    });

    return res.status(200).json({
      success: true,
      message: 'Request rejected',
      data: {
        remainingHelpers: result.remainingHelpers,
        requestStatus: result.status,
        message: result.remainingHelpers > 0
          ? 'Rejection recorded. Other dispatched helpers can still accept.'
          : 'All dispatched helpers rejected. Request marked as FAILED.',
      },
    });
  } catch (error) {
    logger.error('Error rejecting booking request:', error, { requestId });
    return res.status(500).json({
      success: false,
      message: 'Failed to reject request',
      error: (error as Error).message,
    });
  }
};

/**
 * Get booking request status
 * GET /api/booking-requests/:requestId/status
 */
export const getRequestStatus = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  const { requestId } = req.params;

  try {
    if (!requestId) {
      return res.status(400).json({
        success: false,
        message: 'Request ID is required',
      });
    }

    const status = await getBookingRequestStatus(parseInt(requestId, 10));

    // Verify user is the customer or assigned helper
    const currentUserId = parseInt(req.user?.userId ?? '0', 10);
    if (
      status.customer.id !== currentUserId &&
      (!status.helper || status.helper.id !== currentUserId)
    ) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this request',
      });
    }

    return res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error('Error getting request status:', error, { requestId });
    return res.status(500).json({
      success: false,
      message: 'Failed to get request status',
      error: (error as Error).message,
    });
  }
};

/**
 * Get pending requests for a helper
 * GET /api/booking-requests/helper/pending
 */
export const getPendingRequestsForHelper = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    // Verify user is a helper
    const pendingUserId = parseInt(req.user?.userId ?? '0', 10);
    const user = await prisma.user.findUnique({
      where: { id: pendingUserId },
      select: { role: true },
    });

    if (!user || user.role !== 'HELPER') {
      return res.status(403).json({
        success: false,
        message: 'Only helpers can view pending requests',
      });
    }

    const requests = await prisma.bookingRequest.findMany({
      where: {
        helperId: pendingUserId,
        status: 'PENDING',
      },
      include: {
        service: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const enriched = requests.map(req => ({
      ...req,
      timeRemaining: Math.max(
        0,
        Math.ceil((req.expiresAt.getTime() - Date.now()) / 1000)
      ),
    }));

    return res.status(200).json({
      success: true,
      count: enriched.length,
      data: enriched,
    });
  } catch (error) {
    logger.error('Error getting pending requests:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get pending requests',
      error: (error as Error).message,
    });
  }
};

/**
 * Get booking requests for a customer
 * GET /api/booking-requests/customer/history
 */
export const getCustomerRequests = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    // Verify user is a customer
    const customerUserId = parseInt(req.user?.userId ?? '0', 10);
    const user = await prisma.user.findUnique({
      where: { id: customerUserId },
      select: { role: true },
    });

    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'User not found',
      });
    }

    const { status } = req.query;

    const requests = await prisma.bookingRequest.findMany({
      where: {
        customerId: customerUserId,
        ...(status && { status: status as any }),
      },
      include: {
        helper: {
          select: { id: true, rating: true, user: { select: { fullName: true } } },
        },
        service: {
          select: { id: true, name: true },
        },
        booking: {
          select: { id: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    logger.error('Error getting customer requests:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get requests',
      error: (error as Error).message,
    });
  }
};
