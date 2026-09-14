import { Router } from 'express';
import {
  createCity,
  createArea,
  createServiceCoverage,
  getServiceCoverage,
} from './admin-location.controller';

const router = Router();

router.post('/cities', createCity);
router.post('/areas', createArea);
router.post('/service-coverage', createServiceCoverage);
router.get('/services/:serviceId/coverage', getServiceCoverage);

export default router;
