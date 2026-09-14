import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { 
  otpLimiter, 
  loginLimiter, 
  signupLimiter,
  refreshTokenLimiter,
} from '../middlewares/rateLimiter';
import { 
  validate, 
  validatePhoneRegistration, 
  validateOTPVerification 
} from '../utils/validators';
import * as authController from './auth.controller';
import { getMeHandler } from './auth-me.controller';

const router = Router();

/**
 * Signup endpoints
 * Rate limited to 5 per day per IP
 */
router.post(
  '/signup',
  signupLimiter,
  validatePhoneRegistration,
  validate,
  authController.signup
);

/**
 * Login endpoint
 * Rate limited to 5 attempts per 15 minutes
 */
router.post(
  '/login',
  loginLimiter,
  validatePhoneRegistration,
  validate,
  authController.login
);

/**
 * Verify OTP Code
 * Rate limited to 3 per 30 minutes per IP
 */
router.post(
  '/verify-otp',
  //otpLimiter,
  validateOTPVerification,
  validate,
  authController.verifyOtpCode
);

/**
 * Helper verify-otp (capability-based)
 * Creates User + Helper record if absent — no role mutation.
 * Rate limited to 3 per 30 minutes per IP
 */
router.post(
  '/helper/verify-otp',
  //otpLimiter,
  validateOTPVerification,
  validate,
  authController.verifyHelperOtpCode
);

/**
 * Refresh Access Token
 * Rate limited to 10 per hour
 */
router.post(
  '/refresh-token',
  refreshTokenLimiter,
  authController.refresh
);

/**
 * Logout
 * Requires valid access token
 * Blacklists refresh token
 */
router.post(
  '/logout',
  authMiddleware,
  authController.logout
);

/**
 * Get logged-in user info
 * Requires valid access token
 */
router.get(
  '/me',
  authMiddleware,
  getMeHandler
);

export default router;
