import { Router } from 'express';
import onboardingRoutes from './onboarding.routes';
import earningsRoutes from './earnings.routes';
import operationalRoutes from './operational.routes';
import kycRoutes from './kyc.routes';
import locationRoutes from './location.routes';
import jobRoutes from './job.routes';
import partnerBookingRoutes from './partner-booking.routes';
import reviewRoutes from './review.routes';
import bankRoutes from './bank.routes';
import addressRoutes from './address.routes';
import servicesRoutes from './services.routes';
import profileRoutes from './profile.routes';

const router = Router();

/**
 * Partner (Helper) module
 * Mounted at: /api/partner
 *
 * Routes included:
 *   /api/partner/profile           — get/update full profile
 *   /api/partner/onboarding/*     — onboarding steps (profile, kyc, bank, status)
 *   /api/partner/earnings/*       — earnings summary, history, detail
 *   /api/partner/ops/status       — toggle online/offline
 *   /api/partner/ops/dashboard    — unified operational snapshot
 *   /api/partner/ops/discipline   — discipline record
 *   /api/partner/kyc/*            — KYC document uploads (selfie, PAN, police)
 *   /api/partner/location/*       — location updates and tracking
 *   /api/partner/jobs/*           — job listing / management
 *   /api/partner/bookings/*       — helper's assigned bookings
 *   /api/partner/bookings/history — past jobs (COMPLETED/CANCELLED)
 *   /api/partner/reviews           — reviews received from customers
 *   /api/partner/bank-details       — helper's registered bank details
 *   /api/partner/address            — helper's service address
 *   /api/partner/services            — helper's offered services (manage)
 */
router.use('/profile', profileRoutes);
router.use('/onboarding', onboardingRoutes);
router.use('/earnings', earningsRoutes);
router.use('/ops', operationalRoutes);   // requireApprovedHelper scoped here only
router.use('/kyc', kycRoutes);
router.use('/location', locationRoutes);
router.use('/jobs', jobRoutes);
router.use('/bookings', partnerBookingRoutes);
router.use('/reviews', reviewRoutes);
router.use('/bank-details', bankRoutes);
router.use('/address', addressRoutes);
router.use('/services', servicesRoutes);

export default router;
