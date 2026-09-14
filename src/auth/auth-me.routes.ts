import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { getMeHandler } from './auth-me.controller';

const router = Router();

router.get('/me', authMiddleware, getMeHandler);

export default router;
