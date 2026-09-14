import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';

const router = Router();

// ============================================================================
// 1. KIRANA PARTNER / SELLER MANAGEMENT
// ============================================================================

// GET /api/admin/kirana (List sellers with pagination, search, status filter)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { resolveCategoryFilter } = await import('../../utils/category-helper');
    const cat = await resolveCategoryFilter(req);

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 20);
    const search = ((req.query.search as string) || '').trim();
    const status = ((req.query.status as string) || '').toUpperCase();
    const verification = ((req.query.verification as string) || '').toLowerCase();

    const where: any = {};

    if (cat) {
      where.OR = [
        { categoryId: cat.id },
        { businessType: { contains: cat.slug, mode: 'insensitive' } },
        { businessType: { contains: cat.name, mode: 'insensitive' } },
      ];
    }
    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { ownerName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status && status !== 'ALL') {
      if (status === 'ACTIVE') {
        where.status = 'APPROVED';
      } else if (status === 'INACTIVE') {
        where.status = { in: ['REJECTED', 'SUSPENDED'] };
      } else if (status === 'PENDING') {
        where.status = 'PENDING';
      } else {
        where.status = status;
      }
    }
    if (verification === 'verified' || verification === 'approved') {
      where.isVerified = true;
    } else if (verification === 'unverified' || verification === 'pending') {
      where.isVerified = false;
    }

    const [total, activeStores, pendingVerification, sellers] = await Promise.all([
      prisma.seller.count({ where }),
      prisma.seller.count({ where: { status: 'APPROVED' } }),
      prisma.seller.count({ where: { isVerified: false } }),
      prisma.seller.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { products: true }
          }
        }
      })
    ]);

    const formattedSellers = sellers.map((seller: any, index) => ({
      id: seller.id,
      partnerId: `KP${String(seller.id).padStart(3, '0')}`,
      serialNo: (page - 1) * limit + index + 1,
      name: seller.ownerName || seller.businessName,
      ownerName: seller.ownerName || seller.businessName,
      storeName: seller.businessName,
      businessName: seller.businessName,
      category: seller.businessType || 'Grocery',
      phone: seller.phone,
      email: seller.email,
      address: seller.address,
      city: seller.city,
      rating: seller.rating || 4.8,
      orders: seller.totalRatings || 0,
      earnings: (seller.totalRatings || 0) * 180,
      dailyOrderLimit: seller.dailyOrderLimit ?? 10,
      ordersToday: seller.ordersToday ?? 0,
      subscriptionPlan: seller.subscriptionPlan || 'FREE',
      isPro: Boolean(seller.isPro || seller.subscriptionPlan === 'PRO'),
      deliveryRadiusKm: seller.deliveryRadiusKm || 5.0,
      latitude: seller.latitude,
      longitude: seller.longitude,
      status: seller.status === 'APPROVED' ? 'active' : seller.status === 'PENDING' ? 'pending' : 'inactive',
      currentStatus: seller.status === 'APPROVED' ? 'active' : seller.status === 'PENDING' ? 'pending' : 'inactive',
      rawStatus: seller.status,
      verified: seller.isVerified,
      verificationStatus: seller.isVerified ? 'approved' : 'pending',
      createdAt: seller.createdAt,
      joinDate: seller.createdAt,
      documents: {
        overallStatus: seller.isVerified ? 'approved' : 'pending',
        panCard: {
          status: seller.isVerified ? 'approved' : 'pending',
          documentUrl: seller.pan || seller.documentUrl || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80'
        },
        selfiePhoto: {
          status: seller.isVerified ? 'approved' : 'pending',
          documentUrl: seller.logo || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80'
        },
        businessLicense: {
          status: seller.isVerified ? 'approved' : 'pending',
          documentUrl: seller.fssaiLicense || seller.documentUrl || 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600&auto=format&fit=crop&q=80'
        }
      }
    }));

    return res.json({
      success: true,
      data: formattedSellers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
      stats: {
        totalStores: total,
        activeStores,
        inactiveStores: Math.max(0, total - activeStores),
        pendingVerification,
      }
    });
  } catch (error: any) {
    logger.error('Error fetching kirana sellers:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch sellers' });
  }
});

// GET /api/admin/kirana/:id (Seller detail)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const seller = await prisma.seller.findUnique({
      where: { id },
      include: {
        products: {
          include: { category: true }
        }
      }
    });

    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    return res.json({ success: true, data: seller });
  } catch (error: any) {
    logger.error('Error fetching seller detail:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch seller' });
  }
});

// PATCH /api/admin/kirana/:id/status (Approve / Reject / Suspend)
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const act = String(req.body.action || req.body.status || '').toLowerCase();
    const reason = req.body.reason;
    let newStatus: 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'PENDING' = 'PENDING';
    if (act.includes('approv') || act.includes('activ')) newStatus = 'APPROVED';
    else if (act.includes('reject')) newStatus = 'REJECTED';
    else if (act.includes('suspend')) newStatus = 'SUSPENDED';

    const updated = await prisma.seller.update({
      where: { id },
      data: {
        status: newStatus,
        isVerified: newStatus === 'APPROVED',
        rejectionReason: newStatus === 'REJECTED' ? reason || 'Application rejected by admin' : null,
      }
    });

    logger.info(`Seller ${id} status updated to ${newStatus}`);
    return res.json({ success: true, message: `Seller status updated to ${newStatus}`, data: updated });
  } catch (error: any) {
    logger.error('Error updating seller status:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to update seller status' });
  }
});

// PATCH /api/admin/kirana/:id/verification (Verify documents)
router.patch('/:id/verification', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { action, reason } = req.body;

    const isVerified = action === 'approve';
    const updated = await prisma.seller.update({
      where: { id },
      data: {
        isVerified,
        status: isVerified ? 'APPROVED' : (action === 'reject' ? 'REJECTED' : 'PENDING'),
        verificationNotes: reason || (isVerified ? 'Documents verified & Approved by Admin' : 'Documents rejected by Admin'),
      }
    });

    return res.json({ success: true, message: `Seller verification updated to ${isVerified}`, data: updated });
  } catch (error: any) {
    logger.error('Error updating seller verification:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to update verification' });
  }
});

// PATCH /api/admin/kirana/:id/document (Approve / Reject seller document)
router.patch('/:id/document', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { documentType, action, reason } = req.body;
    const isApproved = action === 'approve';

    const updated = await prisma.seller.update({
      where: { id },
      data: {
        verificationNotes: reason || `Document ${documentType || ''} ${isApproved ? 'approved' : 'rejected'}`
      }
    });

    return res.json({
      success: true,
      message: `Document ${documentType} ${isApproved ? 'approved' : 'rejected'} successfully`,
      data: updated
    });
  } catch (error: any) {
    logger.error('Error updating seller document:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to update document' });
  }
});

// PATCH /api/admin/kirana/:id/plan (Update daily order limit, subscription tier, and delivery radius)
router.patch('/:id/plan', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { dailyOrderLimit, subscriptionPlan, isPro, deliveryRadiusKm } = req.body;

    const data: any = {};
    if (dailyOrderLimit !== undefined) {
      data.dailyOrderLimit = parseInt(String(dailyOrderLimit));
    }
    if (subscriptionPlan !== undefined) {
      data.subscriptionPlan = String(subscriptionPlan).toUpperCase();
      data.isPro = data.subscriptionPlan === 'PRO';
    }
    if (isPro !== undefined) {
      data.isPro = Boolean(isPro);
    }
    if (deliveryRadiusKm !== undefined) {
      data.deliveryRadiusKm = parseFloat(String(deliveryRadiusKm));
    }

    const updated = await prisma.seller.update({
      where: { id },
      data,
    });

    logger.info(`Seller ${id} plan updated: limit=${updated.dailyOrderLimit}, plan=${updated.subscriptionPlan}, isPro=${updated.isPro}`);
    return res.json({
      success: true,
      message: 'Seller plan and limits updated successfully',
      data: updated,
    });
  } catch (error: any) {
    logger.error('Error updating seller plan:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to update seller plan' });
  }
});

export default router;

