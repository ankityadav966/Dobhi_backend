import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate } from '../../utils/validators';
import { createTicketHandler, validateCreateTicket } from './support.controller';

const router = Router();

router.post('/ticket', authMiddleware, validateCreateTicket, validate, createTicketHandler);

export default router;
