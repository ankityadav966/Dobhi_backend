import { Router } from 'express';
import { authMiddleware, checkRole } from '../middlewares/auth.middleware';
import { UserRole } from '@prisma/client';
import { validate } from '../utils/validators';
import { body } from 'express-validator';
import {
  createBookingRequest,
  acceptRequest,
  rejectRequest,
  getRequestStatus,
  getPendingRequestsForHelper,
  getCustomerRequests,
} from './booking-request.controller';

const router = Router();

/**
 * ============ AUTHENTICATION REQUIRED ============
 */

/**
 * Create booking request
 * POST /api/booking-requests/create
 *
 * Customers create requests that get dispatched to nearby helpers
 * Acceptance window: 10 seconds
 */
router.post(
  '/create',
  authMiddleware,
  [
    body('serviceId').isInt({ min: 1 }).withMessage('Valid service ID required'),
    body('address')
      .trim()
      .isLength({ min: 5, max: 200 })
      .withMessage('Address must be 5-200 characters'),
    body('city')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('City must be 2-50 characters'),
    body('pinCode')
      .trim()
      .matches(/^[0-9]{6}$/)
      .withMessage('PIN code must be 6 digits'),
    body('latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Invalid latitude'),
    body('longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Invalid longitude'),
    body('estimatedHours')
      .isInt({ min: 1, max: 100 })
      .withMessage('Estimated hours must be between 1-100'),
    body('servicePlanId').isInt({ min: 1 }).withMessage('Valid service plan ID required'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description max 500 characters'),
    body('specialRequirements')
      .optional()
      .trim()
      .isLength({ max: 300 })
      .withMessage('Special requirements max 300 characters'),
    body('requestedTime')
      .optional()
      .trim()
      .matches(/^(0?[1-9]|1[0-2]):[0-5][0-9] [AP]M$/)
      .withMessage('Invalid time format. Use 12-hour format like "10:00 AM" or "08:00 PM"'),
  ],
  validate,
  createBookingRequest
);

/**
 * Accept booking request
 * POST /api/booking-requests/:requestId/accept
 *
 * Helpers accept requests dispatched to them
 * Must accept within 10-second window
 */
router.post(
  '/:requestId/accept',
  authMiddleware,
  checkRole(UserRole.HELPER),
  acceptRequest
);

/**
 * Reject booking request
 * POST /api/booking-requests/:requestId/reject
 *
 * Helpers can reject requests (with optional reason)
 * System auto-redispatches if time permits
 */
router.post(
  '/:requestId/reject',
  authMiddleware,
  checkRole(UserRole.HELPER),
  [
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Reason max 200 characters'),
  ],
  validate,
  rejectRequest
);

/**
 * Get request status
 * GET /api/booking-requests/:requestId/status
 *
 * Both customer and assigned helper can view
 */
router.get(
  '/:requestId/status',
  authMiddleware,
  getRequestStatus
);

/**
 * Get pending requests for helper
 * GET /api/booking-requests/helper/pending
 *
 * Shows all requests dispatched to this helper
 */
router.get(
  '/helper/pending',
  authMiddleware,
  checkRole(UserRole.HELPER),
  getPendingRequestsForHelper
);

/**
 * Get customer's booking requests
 * GET /api/booking-requests/customer/history
 *
 * Filter by status: PENDING, ACCEPTED, EXPIRED, REJECTED
 */
router.get(
  '/customer/history',
  authMiddleware,
  getCustomerRequests
);

export default router;
