import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate, validateJobDetailsCreation } from '../../utils/validators';
import * as jobController from './job.controller';

const router = Router();

// STATIC ROUTES FIRST (Express route matching order - must be before dynamic routes)

// Get user jobs (static route - /user/jobs)
router.get('/user/jobs', authMiddleware, jobController.getUserJobs);

// Then DYNAMIC ROUTES

// Create job details
router.post('/', authMiddleware, validateJobDetailsCreation, validate, jobController.createJobDetails);

// Get job details (dynamic route - /:jobId)
router.get('/:jobId', jobController.getJobDetails);

// List jobs (root)
router.get('/', jobController.listJobs);

// Update job details
router.put('/:jobId', authMiddleware, jobController.updateJobDetails);

// Delete job details
router.delete('/:jobId', authMiddleware, jobController.deleteJobDetails);

export default router;
