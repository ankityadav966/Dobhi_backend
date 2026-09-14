import { Router } from 'express';
import adminAuthRoutes from './admin-auth.routes';
import adminRoutes from './admin.routes';
import onboardingRoutes from './onboarding.routes';
import payoutRoutes from './payout.routes';
import financeRoutes from './finance.routes';
import adminBookingRoutes from './admin-booking.routes';
import adminUserRoutes from './admin-user.routes';
import adminHelperRoutes from './admin-helper.routes';
import adminLocationRoutes from './admin-location.routes';
import adminCouponRoutes from './admin-coupon.routes';
import adminDisputeRoutes from './admin-dispute.routes';
import adminCategoryRoutes from './admin-category.routes';
import adminDashboardRoutes from './admin-dashboard.routes';
import adminPaymentRoutes from './admin-payment.routes';
import adminAnnouncementRoutes from './admin-announcement.routes';
import adminResourcesRoutes from './admin-resources.routes';
import adminFaqRoutes from './admin-faq.routes';
import adminReviewRoutes from './admin-review.routes';
import adminAnalyticsRoutes from './admin-analytics.routes';

import { verifyOtpCode } from '../../auth/auth.controller';

const router = Router();

// Public Admin Login & Auth endpoints (before JWT guard)
router.use('/', adminAuthRoutes);
router.use('/auth', adminAuthRoutes);
router.post('/auth/verify-otp', verifyOtpCode);

// Categories (public active listing + authenticated CRUD)
router.use('/categories', adminCategoryRoutes);
router.use('/service-categories', adminCategoryRoutes);

// Protected Admin Features
router.use('/', adminRoutes);
router.use('/dashboard', adminDashboardRoutes);
router.use('/announcements', adminAnnouncementRoutes);
router.use('/payments', adminPaymentRoutes);
router.use('/onboarding', onboardingRoutes);
router.use('/payout', payoutRoutes);
router.use('/finance', financeRoutes);
router.use('/bookings', adminBookingRoutes);
router.use('/users', adminUserRoutes);
router.use('/helpers', adminHelperRoutes);
router.use('/coupons', adminCouponRoutes);
router.use('/disputes', adminDisputeRoutes);
router.use('/faqs', adminFaqRoutes);
router.use('/reviews', adminReviewRoutes);
router.use('/analytics', adminAnalyticsRoutes);
router.use('/', adminLocationRoutes);
router.use('/', adminResourcesRoutes); // provides /sellers, /orders, /products, /workers, /revenue with category filtering

export default router;
