import { Router } from 'express';
import { authMiddleware, checkRole } from '../../middlewares/auth.middleware';
import { UserRole } from '@prisma/client';
import {
  updateCommission,
  getCommission,
  listServices,
  createService,
  updateService,
  deleteService,
  listServicePlans,
  createServicePlan,
  updateServicePlan,
  deleteServicePlan,
  updatePlatformSettings,
} from './admin.controller';

const router = Router();

// All admin routes require authentication + ADMIN role
router.use(authMiddleware);
router.use(checkRole(UserRole.ADMIN));

// ── Legacy commission endpoints (kept for backwards compat) ──────────────────
router.get('/settings/commission', getCommission);
router.put('/settings/commission', updateCommission);

// ── Services ─────────────────────────────────────────────────────────────────
router.get('/services', listServices);
router.post('/services', createService);
router.patch('/services/:id', updateService);
router.put('/services/:id', updateService);
router.patch('/services/:id/status', updateService);
router.delete('/services/:id', deleteService);

// ── Service Plans ─────────────────────────────────────────────────────────────
router.get('/service-plans', listServicePlans);
router.post('/service-plans', createServicePlan);
router.patch('/service-plans/:id', updateServicePlan);
router.delete('/service-plans/:id', deleteServicePlan);

// ── Platform Settings ─────────────────────────────────────────────────────────
router.patch('/platform-settings', updatePlatformSettings);

export default router;
