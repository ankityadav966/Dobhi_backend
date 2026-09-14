import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';

const router = Router();

/**
 * GET /api/admin/dashboard
 * Full platform dashboard statistics with Global Category Filter support
 * Supports query params:
 *   ?category_id=123 OR ?category=grocery OR ?category_id=all
 */
router.get('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const rawCategory = String(req.query.category_id || req.query.category || req.query.categoryId || 'all').trim();
    const isFiltered = rawCategory !== 'all' && rawCategory !== '' && rawCategory !== 'null' && rawCategory !== 'undefined';

    let selectedCat: any = null;
    let categoryCondition: any = {};
    let sellerCategoryCondition: any = {};
    let orderCategoryCondition: any = {};

    if (isFiltered) {
      const numId = parseInt(rawCategory, 10);
      selectedCat = await prisma.platformCategory.findFirst({
        where: {
          OR: [
            ...(!isNaN(numId) ? [{ id: numId }] : []),
            { slug: rawCategory.toLowerCase() },
            { name: { equals: rawCategory, mode: 'insensitive' } },
          ]
        }
      });

      if (selectedCat) {
        sellerCategoryCondition = {
          OR: [
            { categoryId: selectedCat.id },
            { businessType: { contains: selectedCat.slug, mode: 'insensitive' } },
            { businessType: { contains: selectedCat.name, mode: 'insensitive' } },
          ]
        };

        orderCategoryCondition = {
          OR: [
            { categoryId: selectedCat.id },
            { seller: sellerCategoryCondition },
            { orderType: { contains: selectedCat.name, mode: 'insensitive' } },
            { orderType: { contains: selectedCat.slug, mode: 'insensitive' } },
          ]
        };
      }
    }

    // ── Helper functions for real aggregations ───────────────────────────────
    async function calculateRealTimeStats(orderWhere: any) {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [todayOrders, weekOrders, monthOrders] = await Promise.all([
        prisma.sellerOrder.aggregate({
          where: { ...orderWhere, createdAt: { gte: startOfDay } },
          _count: { id: true },
          _sum: { totalAmount: true },
        }),
        prisma.sellerOrder.aggregate({
          where: { ...orderWhere, createdAt: { gte: startOfWeek } },
          _count: { id: true },
          _sum: { totalAmount: true },
        }),
        prisma.sellerOrder.aggregate({
          where: { ...orderWhere, createdAt: { gte: startOfMonth } },
          _count: { id: true },
          _sum: { totalAmount: true },
        }),
      ]);

      const todayRev = todayOrders._sum.totalAmount || 0;
      const weekRev = weekOrders._sum.totalAmount || 0;
      const monthRev = monthOrders._sum.totalAmount || 0;

      return [
        {
          period: "Today",
          orders: todayOrders._count.id || 0,
          revenue: `₹${Number(todayRev).toLocaleString()}`,
          commission: `₹${Math.round(todayRev * 0.15).toLocaleString()}`,
        },
        {
          period: "This Week",
          orders: weekOrders._count.id || 0,
          revenue: `₹${Number(weekRev).toLocaleString()}`,
          commission: `₹${Math.round(weekRev * 0.15).toLocaleString()}`,
        },
        {
          period: "This Month",
          orders: monthOrders._count.id || 0,
          revenue: `₹${Number(monthRev).toLocaleString()}`,
          commission: `₹${Math.round(monthRev * 0.15).toLocaleString()}`,
        },
      ];
    }

    async function calculateRealCityActivity(orderWhere: any) {
      const orders = await prisma.sellerOrder.findMany({
        where: orderWhere,
        select: {
          deliveryAddress: true,
          totalAmount: true,
          status: true,
          seller: { select: { city: true } },
        },
      });

      const cityMap = new Map<string, { orders: number; active: number; revenue: number }>();

      for (const o of orders) {
        let city = 'Jaipur';
        if (o.seller?.city) {
          city = o.seller.city;
        } else if (typeof o.deliveryAddress === 'string') {
          const match = o.deliveryAddress.match(/(Jaipur|Delhi|Noida|Gurgaon|Faridabad|Mumbai|Pune|Bangalore)/i);
          if (match) city = match[1];
        }
        const c = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
        const curr = cityMap.get(c) || { orders: 0, active: 0, revenue: 0 };
        curr.orders += 1;
        if (['Preparing', 'Assigned', 'Out for Delivery', 'Arrived', 'In Transit'].includes(o.status)) {
          curr.active += 1;
        }
        curr.revenue += o.totalAmount || 0;
        cityMap.set(c, curr);
      }

      if (cityMap.size === 0) {
        return [
          { city: "Jaipur", orders: 0, active: 0, revenue: "₹0" }
        ];
      }

      return Array.from(cityMap.entries()).map(([city, data]) => ({
        city,
        orders: data.orders,
        active: data.active,
        revenue: `₹${Number(data.revenue).toLocaleString()}`,
      }));
    }

    // ── 1. Calculate Stats (Filtered Category) ────────────────────────────────
    if (isFiltered && selectedCat) {
      const [
        totalSellers,
        activeSellers,
        totalOrders,
        pendingOrders,
        confirmedOrders,
        inProgressOrders,
        completedOrders,
        cancelledOrders,
        revenueSum,
        workersCount,
        recentOrders,
        distinctCustomers,
        timeStats,
        cityActivity,
      ] = await Promise.all([
        prisma.seller.count({ where: sellerCategoryCondition }),
        prisma.seller.count({ where: { ...sellerCategoryCondition, status: 'APPROVED' } }),
        prisma.sellerOrder.count({ where: orderCategoryCondition }),
        prisma.sellerOrder.count({ where: { ...orderCategoryCondition, status: { in: ['Preparing', 'Pending', 'Payment Pending'] } } }),
        prisma.sellerOrder.count({ where: { ...orderCategoryCondition, status: 'Assigned' } }),
        prisma.sellerOrder.count({ where: { ...orderCategoryCondition, status: { in: ['Out for Delivery', 'Arrived', 'In Transit'] } } }),
        prisma.sellerOrder.count({ where: { ...orderCategoryCondition, status: 'Completed' } }),
        prisma.sellerOrder.count({ where: { ...orderCategoryCondition, status: 'Cancelled' } }),
        prisma.sellerOrder.aggregate({
          where: { ...orderCategoryCondition, status: { in: ['Completed', 'Delivered'] } },
          _sum: { totalAmount: true },
        }),
        prisma.$queryRawUnsafe<any[]>(`
          SELECT COUNT(*)::int as count 
          FROM "SellerWorker" sw
          JOIN "Seller" s ON sw."sellerId" = s.id
          WHERE s."categoryId" = $1 OR LOWER(s."businessType") = $2;
        `, selectedCat.id, selectedCat.slug).then(r => r[0]?.count || 0).catch(() => 0),
        prisma.sellerOrder.findMany({
          where: orderCategoryCondition,
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            seller: { select: { id: true, businessName: true } }
          }
        }),
        prisma.sellerOrder.findMany({
          where: orderCategoryCondition,
          select: { customerPhone: true },
          distinct: ['customerPhone'],
        }),
        calculateRealTimeStats(orderCategoryCondition),
        calculateRealCityActivity(orderCategoryCondition),
      ]);

      const totalRevenue = revenueSum._sum.totalAmount || 0;
      const activeOrders = confirmedOrders + inProgressOrders;
      const totalUsers = distinctCustomers.length;

      const formattedRecentOrders = recentOrders.map((o) => ({
        id: o.id,
        displayId: o.orderNumber,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        serviceName: selectedCat.name,
        planName: o.orderType || selectedCat.name,
        partnerName: o.seller?.businessName || 'Store',
        amount: o.totalAmount,
        status: o.status,
        city: 'Jaipur',
        bookingDate: o.createdAt,
        createdAt: o.createdAt,
      }));

      return res.json({
        success: true,
        categoryFiltered: true,
        selectedCategory: {
          id: selectedCat.id,
          name: selectedCat.name,
          slug: selectedCat.slug,
        },
        stats: {
          totalUsers,
          totalBookings: totalOrders,
          totalSellers,
          activeSellers,
          totalWorkers: workersCount,
          pendingOrders,
          activeOrders,
          completedOrders,
          cancelledOrders,
          totalRevenue,
          availableHelpers: workersCount,
          totalHelpers: workersCount,
        },
        orderStatusBreakdown: {
          pending: pendingOrders,
          confirmed: confirmedOrders,
          inProgress: inProgressOrders,
          completed: completedOrders,
          cancelled: cancelledOrders,
        },
        timeStats,
        cityActivity,
        recentOrders: formattedRecentOrders,
        alerts: [
          {
            id: 'cat_filter',
            type: 'info',
            message: `Currently viewing filtered data for ${selectedCat.name}.`,
          }
        ],
        timestamp: new Date().toISOString(),
      });
    }

    // ── 2. All Categories (Complete Platform View) ───────────────────────────
    const [
      totalUsers,
      totalBookings,
      totalSellers,
      totalWorkers,
      pendingCount,
      confirmedCount,
      inProgressCount,
      completedCount,
      cancelledCount,
      totalRevenueAggregate,
      recentOrders,
      pendingDisputes,
      timeStats,
      cityActivity,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.sellerOrder.count(),
      prisma.seller.count(),
      prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int as count FROM "SellerWorker"`).then(r => r[0]?.count || 0).catch(() => 0),
      prisma.sellerOrder.count({ where: { status: { in: ['Preparing', 'Pending', 'Payment Pending'] } } }),
      prisma.sellerOrder.count({ where: { status: 'Assigned' } }),
      prisma.sellerOrder.count({ where: { status: { in: ['Out for Delivery', 'Arrived', 'In Transit'] } } }),
      prisma.sellerOrder.count({ where: { status: 'Completed' } }),
      prisma.sellerOrder.count({ where: { status: 'Cancelled' } }),
      prisma.sellerOrder.aggregate({
        where: { status: { in: ['Completed', 'Delivered'] } },
        _sum: { totalAmount: true }
      }),
      prisma.sellerOrder.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          seller: { select: { id: true, businessName: true } }
        }
      }),
      prisma.dispute.findMany({
        where: { status: 'open' },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }).catch(() => []),
      calculateRealTimeStats({}),
      calculateRealCityActivity({}),
    ]);

    const activeOrders = confirmedCount + inProgressCount;
    const totalRevenue = totalRevenueAggregate._sum.totalAmount || 0;

    const formattedRecentOrders = recentOrders.map((b: any) => ({
      id: b.id,
      displayId: b.orderNumber || `ORD-${String(b.id).padStart(4, '0')}`,
      customerName: b.customerName || 'Customer',
      customerPhone: b.customerPhone || '',
      serviceName: b.orderType || 'Marketplace Order',
      planName: b.orderType || 'Standard',
      partnerName: b.seller?.businessName || 'Store Partner',
      amount: b.totalAmount || 0,
      status: b.status,
      city: 'Jaipur',
      bookingDate: b.createdAt,
      createdAt: b.createdAt,
    }));

    const alerts: any[] = [];
    if (pendingDisputes && pendingDisputes.length > 0) {
      alerts.push({
        id: 'disputes',
        type: 'warning',
        message: `${pendingDisputes.length} open customer dispute(s) require review`,
      });
    }
    if (pendingCount > 0) {
      alerts.push({
        id: 'pending_orders',
        type: 'info',
        message: `${pendingCount} order(s) currently being processed across all categories`,
      });
    }

    return res.json({
      success: true,
      categoryFiltered: false,
      selectedCategory: 'all',
      stats: {
        totalUsers,
        totalBookings,
        totalSellers,
        totalWorkers,
        pendingOrders: pendingCount,
        activeOrders,
        completedOrders: completedCount,
        totalRevenue,
        totalHelpers: totalWorkers,
        availableHelpers: Math.max(1, totalWorkers),
      },
      orderStatusBreakdown: {
        pending: pendingCount,
        confirmed: confirmedCount,
        inProgress: inProgressCount,
        completed: completedCount,
        cancelled: cancelledCount,
      },
      timeStats,
      cityActivity,
      alerts,
      recentOrders: formattedRecentOrders,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Error fetching admin dashboard:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch dashboard' });
  }
});

export default router;
