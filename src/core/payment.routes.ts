import { Router } from 'express';
import { authMiddleware, checkRole } from '../middlewares/auth.middleware';
import { UserRole } from '@prisma/client';
import * as paymentController from './payment.controller';

const router = Router();

// Create Razorpay order
router.post('/create-order', authMiddleware, paymentController.createRazorpayOrderController);

// Initiate payment
router.post('/initiate', authMiddleware, paymentController.initiatePayment);

// Verify payment
router.post('/verify', authMiddleware, paymentController.verifyPayment);

// Get payment details
router.get('/:paymentId', authMiddleware, paymentController.getPaymentDetails);

// Get payment history
router.get('/', authMiddleware, paymentController.getPaymentHistory);

// Refund payment (ADMIN only)
router.post('/:paymentId/refund', authMiddleware, checkRole(UserRole.ADMIN), paymentController.refundPayment);

export default router;
