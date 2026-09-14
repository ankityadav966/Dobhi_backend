import { Router } from 'express';
import { authMiddleware, requireApprovedHelper } from '../../middlewares/auth.middleware';
import * as locationController from './location.controller';

const router = Router();

// Update partner location — only approved helpers
router.post('/update', requireApprovedHelper, locationController.updateUserLocation);

// Route/current/history/range/stream — require auth (customer or helper may call)
router.get('/route/:bookingId',       authMiddleware, locationController.getRealTimeRoute);
router.get('/current/:bookingId',     authMiddleware, locationController.getCurrentLocations);
router.get('/history/:userId',        authMiddleware, locationController.getLocationHistory);
router.get('/check-range/:bookingId', authMiddleware, locationController.checkPartnerInRange);
router.get('/stream/:bookingId',      authMiddleware, locationController.streamLocationUpdates);

export default router;
