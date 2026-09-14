import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../prisma.client';
import { verifyAccessToken } from '../../utils/jwt';
import logger from '../../utils/logger';

const router = Router();

interface SellerRequest extends Request {
  sellerId?: number;
}

/**
 * Seller Authorization Middleware:
 * Enforces valid JWT with role 'SELLER' and extracts authenticated sellerId
 */
const requireSeller = async (req: SellerRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const token = authHeader.substring(7);
    const decoded: any = verifyAccessToken(token);

    if (!decoded || (decoded.role !== 'SELLER' && decoded.role !== 'ADMIN')) {
      res.status(403).json({ success: false, message: 'Forbidden — Seller access only.' });
      return;
    }

    req.sellerId = decoded.sellerId ? parseInt(String(decoded.sellerId), 10) : (decoded.userId ? parseInt(decoded.userId, 10) : 1);
    next();
  } catch (error: any) {
    logger.error('requireSeller middleware error:', error);
    res.status(500).json({ success: false, message: 'Authentication error.' });
  }
};

router.use(requireSeller);

/**
 * GET /api/seller/workers
 * Lists all workers belonging to this seller
 */
router.get('/', async (req: SellerRequest, res: Response) => {
  try {
    const sellerId = req.sellerId!;
    const workers = await prisma.sellerWorker.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      data: workers,
    });
  } catch (error: any) {
    logger.error('Error fetching seller workers:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch workers' });
  }
});

/**
 * POST /api/seller/workers
 * Seller adds a new worker with Name, Email (mandatory), Phone, Role
 */
router.post('/', async (req: SellerRequest, res: Response) => {
  try {
    const sellerId = req.sellerId!;
    const { name, email, phone, role } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Worker name and registered email address are required.',
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPhone = String(phone || '9999999999').trim();

    // Check if worker already exists for this seller
    const existing = await prisma.sellerWorker.findFirst({
      where: {
        sellerId,
        email: cleanEmail,
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A worker with this email is already registered under your store.',
      });
    }

    // Auto-generate unique Worker ID: WRK-<prefix>-<num>
    const seller = await prisma.seller.findUnique({ where: { id: sellerId } });
    const prefix = (seller?.businessType || 'ST').substring(0, 3).toUpperCase();
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const workerId = `WRK-${prefix}-${randomSuffix}`;
    const passcode = String(Math.floor(1000 + Math.random() * 9000));

    const worker = await prisma.sellerWorker.create({
      data: {
        workerId,
        sellerId,
        name: String(name).trim(),
        email: cleanEmail,
        phone: cleanPhone,
        role: role || 'Delivery Partner',
        passcode,
        isActive: true,
        assignedOrdersCount: 0,
      }
    });

    logger.info(`[Worker Added] Store #${sellerId} added worker ${worker.name} (${worker.workerId})`);

    return res.status(201).json({
      success: true,
      message: `Worker "${worker.name}" added successfully! Assigned Worker ID: ${worker.workerId}`,
      data: worker,
    });
  } catch (error: any) {
    logger.error('Error adding worker:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to add worker' });
  }
});

/**
 * DELETE /api/seller/workers/:id
 * Remove / deactivate worker
 */
router.delete('/:id', async (req: SellerRequest, res: Response) => {
  try {
    const sellerId = req.sellerId!;
    const { id } = req.params;

    const numId = parseInt(id, 10);
    const worker = await prisma.sellerWorker.findFirst({
      where: {
        OR: [
          { workerId: id },
          ...(!isNaN(numId) ? [{ id: numId }] : []),
        ],
        sellerId,
      }
    });

    if (!worker) {
      return res.status(404).json({ success: false, message: 'Worker not found in your store.' });
    }

    await prisma.sellerWorker.delete({ where: { id: worker.id } });

    logger.info(`[Worker Deleted] Store #${sellerId} removed worker ${worker.workerId}`);

    return res.json({
      success: true,
      message: `Worker ${worker.name} (${worker.workerId}) removed successfully.`,
    });
  } catch (error: any) {
    logger.error('Error removing worker:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to remove worker' });
  }
});

/**
 * POST /api/seller/orders/:id/assign-worker
 * Assign order to worker (enforcing ownership)
 */
router.post('/orders/:id/assign-worker', async (req: SellerRequest, res: Response) => {
  try {
    const sellerId = req.sellerId!;
    const { id } = req.params;
    const { workerId } = req.body;

    if (!workerId) {
      return res.status(400).json({ success: false, message: 'workerId is required' });
    }

    // Verify worker belongs to this seller
    const worker = await prisma.sellerWorker.findFirst({
      where: { workerId, sellerId, isActive: true }
    });

    if (!worker) {
      return res.status(404).json({ success: false, message: 'Active worker not found in your store.' });
    }

    const numId = parseInt(id, 10);
    const order = await prisma.sellerOrder.findFirst({
      where: {
        OR: [
          { orderNumber: id },
          ...(!isNaN(numId) ? [{ id: numId }] : []),
        ],
        sellerId,
      }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found in your store.' });
    }

    const updated = await prisma.sellerOrder.update({
      where: { id: order.id },
      data: {
        assignedWorkerId: worker.workerId,
        status: 'Assigned',
      }
    });

    await prisma.sellerWorker.update({
      where: { id: worker.id },
      data: { assignedOrdersCount: { increment: 1 } }
    });

    logger.info(`Order #${order.orderNumber} assigned to worker ${worker.name} (${worker.workerId})`);

    return res.json({
      success: true,
      message: `Order #${order.orderNumber} successfully assigned to ${worker.name}!`,
      data: updated,
    });
  } catch (error: any) {
    logger.error('Error assigning worker:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to assign worker' });
  }
});

export default router;
