import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import logger from './logger';

/**
 * Validation error handler middleware
 */
export const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorData = errors.array().map((err: any) => ({
      field: err.param || err.path || 'unknown',
      message: err.msg,
      value: typeof err.value === 'string' ? err.value.substring(0, 50) : err.value,
    }));

    logger.warn('Validation error', {
      errors: errorData,
      path: req.path,
    });

    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorData,
    });
    return;
  }
  next();
};

/**
 * SECURITY ENHANCED VALIDATORS
 */

// ============ AUTH VALIDATIONS ============

export const validatePhoneRegistration = [
  body('phone')
    .trim()
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Invalid Indian phone number (must be 10 digits starting with 6-9)')
    .customSanitizer(value => value.replace(/\D/g, '')),
];

export const validateOTPVerification = [
  body('phone')
    .trim()
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Invalid phone number')
    .customSanitizer(value => value.replace(/\D/g, '')),
  body('otp')
    .trim()
    .isLength({ min: 4, max: 6 })
    .withMessage('OTP must be 4-6 digits')
    .isNumeric()
    .withMessage('OTP must contain only numbers'),
];

export const validateUserSignup = [
  body('phone')
    .trim()
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Invalid phone number')
    .customSanitizer(value => value.replace(/\D/g, '')),
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2-100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens, and apostrophes')
    .customSanitizer(value => value.replace(/\s+/g, ' ').trim()),
  body('role')
    .trim()
    .isIn(['HELPER', 'ADMIN'])
    .withMessage('Invalid role'),
  body('gender')
    .optional()
    .trim()
    .isIn(['MALE', 'FEMALE', 'OTHER'])
    .withMessage('Invalid gender'),
];

export const validatePassword = [
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character (@$!%*?&)'),
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),
];

// ============ PARTNER/HELPER VALIDATIONS ============

export const validateHelperRegistration = [
  body('phone')
    .trim()
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Invalid phone number')
    .customSanitizer(value => value.replace(/\D/g, '')),
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2-100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Full name can only contain letters, spaces, hyphens, and apostrophes'),
  body('gender')
    .optional()
    .isIn(['MALE', 'FEMALE', 'OTHER'])
    .withMessage('Invalid gender'),
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
];

export const validatePartnerRegistration = [
  ...validateHelperRegistration,
  body('businessName')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Business name must be 3-100 characters'),
  body('gst')
    .optional()
    .trim()
    .toUpperCase()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .withMessage('Invalid GST format'),
];

// ============ PROFILE VALIDATIONS ============

export const validateProfileUpdate = [
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be 2-100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Full name contains invalid characters'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  body('address')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Address must be 5-200 characters'),
  body('city')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('City must be 2-50 characters'),
  body('pinCode')
    .optional()
    .trim()
    .matches(/^[0-9]{6}$/)
    .withMessage('PIN code must be 6 digits'),
];

// ============ BANK DETAILS VALIDATIONS ============

export const validateBankDetails = [
  body('bankAccountName')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Account holder name must be 3-100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Account holder name contains invalid characters'),
  body('bankAccountNumber')
    .trim()
    .isLength({ min: 9, max: 18 })
    .withMessage('Account number must be 9-18 digits')
    .isNumeric()
    .withMessage('Account number must contain only digits'),
  body('bankIFSCCode')
    .trim()
    .toUpperCase()
    .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/)
    .withMessage('Invalid IFSC code format'),
  body('bankName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Bank name must be 2-100 characters'),
  body('accountType')
    .trim()
    .isIn(['SAVINGS', 'CURRENT'])
    .withMessage('Invalid account type'),
];

// ============ SERVICE VALIDATIONS ============

export const validateServiceCreation = [
  body('category')
    .trim()
    .isIn([
      'PLUMBING', 'ELECTRICAL', 'CARPENTRY', 'PAINTING', 'CLEANING',
      'GARDENING', 'APPLIANCE_REPAIR', 'FURNITURE_REPAIR', 'PEST_CONTROL',
      'AC_SERVICE', 'OTHER'
    ])
    .withMessage('Invalid category'),
  body('title')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Service title must be 3-100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('hourlyRate')
    .isFloat({ min: 0, max: 999999 })
    .withMessage('Hourly rate must be a valid positive number'),
  body('minimumHours')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Minimum hours must be between 1-100'),
];

// ============ BOOKING VALIDATIONS ============

export const validateBookingCreation = [
  body('serviceId')
    .trim()
    .notEmpty()
    .withMessage('Service ID is required'),
  body('startTime')
    .isISO8601()
    .toDate()
    .withMessage('Invalid start time format')
    .custom(value => value.getTime() > Date.now())
    .withMessage('Start time must be in the future'),
  body('totalHours')
    .isInt({ min: 1, max: 100 })
    .withMessage('Hours must be between 1-100'),
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
];

// ============ RATING VALIDATIONS ============

export const validateRatingCreation = [
  body('bookingId')
    .trim()
    .notEmpty()
    .withMessage('Booking ID is required'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('review')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Review must not exceed 500 characters'),
];

// ============ JOB VALIDATIONS ============

export const validateJobDetailsCreation = [
  body('jobTitle')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Job title must be 3-100 characters'),
  body('jobDescription')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
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
  body('jobDate')
    .isISO8601()
    .toDate()
    .withMessage('Invalid job date')
    .custom(value => value.getTime() > Date.now())
    .withMessage('Job date must be in the future'),
  body('timeSlot')
    .trim()
    .notEmpty()
    .withMessage('Time slot is required'),
  body('estimatedHours')
    .isInt({ min: 1, max: 100 })
    .withMessage('Estimated hours must be between 1-100'),
  body('estimatedBudget')
    .isFloat({ min: 0, max: 9999999 })
    .withMessage('Budget must be a valid positive number'),
];

// ============ PAN VALIDATION ============

export const validatePANVerification = [
  body('panNumber')
    .trim()
    .toUpperCase()
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .withMessage('Invalid PAN format'),
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be 2-100 characters'),
];

// ============ LOCATION VALIDATION ============

export const validateLocationUpdate = [
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
  body('accuracy')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Accuracy must be a positive number'),
];

// ============ ID VALIDATIONS ============

export const validateUserId = [
  param('id')
    .trim()
    .notEmpty()
    .withMessage('User ID is required')
    .isUUID()
    .withMessage('Invalid user ID format'),
];

export const validateServiceId = [
  param('serviceId')
    .trim()
    .notEmpty()
    .withMessage('Service ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid service ID format')
    .toInt(),
];

export const validateBookingId = [
  param('bookingId')
    .trim()
    .notEmpty()
    .withMessage('Booking ID is required')
    .isInt({ min: 1 })
    .withMessage('Invalid booking ID format')
    .toInt(),
];

// ============ PAGINATION VALIDATION ============

export const validatePagination = () => [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sortBy')
    .optional()
    .trim()
    .isString()
    .withMessage('Invalid sort field'),
];
