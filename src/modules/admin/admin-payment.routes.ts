import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma.client';
import { resolveCategoryFilter } from '../../utils/category-helper';
import logger from '../../utils/logger';

const router = Router();

// GET /api/admin/payments?category_id=...
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const cat = await resolveCategoryFilter(req);

    const paymentWhere: any = {};
    if (cat) {
      paymentWhere.booking = {
        service: {
          OR: [
            { categoryId: cat.id },
            { category: { contains: cat.name, mode: 'insensitive' } },
            { category: { contains: cat.slug, mode: 'insensitive' } },
          ],
        },
      };
    }

    const [payments, setting] = await Promise.all([
      prisma.payment.findMany({
        where: paymentWhere,
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            include: {
              customer: { select: { fullName: true, phone: true } },
              service: { select: { name: true, categoryId: true } },
              helper: {
                include: {
                  user: { select: { fullName: true, phone: true } },
                },
              },
            },
          },
        },
      }),
      prisma.platformSetting.findUnique({ where: { id: 1 } }).catch(() => null),
    ]);

    const commissionRate = setting?.commissionRate ?? 0.15;

    let totalRevenue = 0;
    let totalCommission = 0;

    const formattedPayments = payments.map((p: any) => {
      const amt = Number(p.amount) || 0;
      const comm = Math.round(amt * commissionRate);
      if (p.status === 'CAPTURED') {
        totalRevenue += amt;
        totalCommission += comm;
      }

      return {
        id: `PAY${String(p.id).padStart(4, '0')}`,
        orderId: `HB${String(p.bookingId).padStart(4, '0')}`,
        user: p.booking?.customer?.fullName || 'Customer',
        partner: p.booking?.helper?.user?.fullName || 'Partner',
        amount: `₹${amt}`,
        commission: `₹${comm}`,
        paymentStatus: p.status === 'CAPTURED' ? 'success' : p.status === 'FAILED' ? 'failed' : 'pending',
        payoutStatus: p.status === 'CAPTURED' ? 'processed' : 'pending',
        date: new Date(p.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      };
    });

    const payload = {
      success: true,
      categoryFilter: cat?.name || 'All Categories',
      payments: formattedPayments,
      data: formattedPayments,
      stats: {
        todayRevenue: `₹${totalRevenue.toLocaleString('en-IN')}`,
        todayCommission: `₹${totalCommission.toLocaleString('en-IN')}`,
        pendingPayouts: '₹12,340',
        processedPayouts: `₹${(totalRevenue - totalCommission).toLocaleString('en-IN')}`,
      },
    };

    return res.status(200).json(payload);
  } catch (error: any) {
    logger.error('Error fetching admin payments:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch payments' });
  }
});

export default router;
