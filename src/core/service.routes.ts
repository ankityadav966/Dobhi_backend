import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validate, validateServiceCreation, validateServiceId } from '../utils/validators';
import * as serviceController from './service.controller';

const router = Router();

// Create service
router.post('/', authMiddleware, validateServiceCreation, validate, serviceController.createService);

// List services
router.get('/', serviceController.listServices);

// Get helper services (must be before /:serviceId to avoid param conflict)
router.get('/helper/:helperId', serviceController.getHelperServices);

// Get service by ID
router.get('/:serviceId', validateServiceId, validate, serviceController.getServiceById);

// Update service
router.put('/:serviceId', authMiddleware, serviceController.updateService);

// Delete service
router.delete('/:serviceId', authMiddleware, serviceController.deleteService);

export default router;
