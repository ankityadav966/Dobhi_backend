import { Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { body, validationResult } from 'express-validator';
import { createSupportTicket } from './support.service';
import logger from '../../utils/logger';

export const validateCreateTicket = [
  body('message').isString().trim().notEmpty().withMessage('message is required'),
  body('bookingId').optional().isInt().withMessage('bookingId must be an integer'),
];

export async function createTicketHandler(
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({ success: false, message: 'Validation failed', errors: errors.array() });
      return;
    }

    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { message, bookingId } = req.body;

    const ticket = await createSupportTicket(userId, message, bookingId);

    res.status(201).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    logger.error('Error creating support ticket:', error);
    res.status(500).json({ success: false, message: 'Failed to create support ticket' });
  }
}
