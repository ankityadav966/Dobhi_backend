import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validate, validateRatingCreation } from '../utils/validators';
import * as ratingController from './rating.controller';

const router = Router();

// Create rating
router.post('/', authMiddleware, validateRatingCreation, validate, ratingController.createRating);

// Get service ratings
router.get('/service/:serviceId', ratingController.getServiceRatings);

// Get helper ratings
router.get('/helper/:helperId', ratingController.getHelperRatings);

// Get rating stats
router.get('/stats/:helperId', ratingController.getRatingStats);

// Update rating
router.put('/:ratingId', authMiddleware, ratingController.updateRating);

// Delete rating
router.delete('/:ratingId', authMiddleware, ratingController.deleteRating);

export default router;
