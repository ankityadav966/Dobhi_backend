import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';
import { createGenericRazorpayOrder } from '../../services/razorpay.service';
import { findEligibleStoresWithEscalation, acceptStoreOrder, calculateDistanceKm } from '../../services/store-dispatch.service';
import { broadcastSellerEvent } from '../../socket/socket.service';

const router = Router();

// ============================================================================
// 1. PUBLIC SELLER ONBOARDING (/api/v1/seller/register)
// ============================================================================

router.post('/seller/register', async (req: Request, res: Response) => {
  try {
    const {
      businessName,
      ownerName,
      phone,
      email,
      address,
      city,
      pincode,
      businessType,
      description,
      gstin,
      pan,
      fssaiLicense,
      documentUrl,
      logo,
      banner,
      openingTime,
      closingTime,
      deliveryRadiusKm,
      minOrderValue,
    } = req.body;

    if (!businessName || !ownerName || !phone || !address) {
      return res.status(400).json({
        success: false,
        message: 'Business name, owner name, phone, and address are required.',
      });
    }

    // Clean phone
    const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);

    const existing = await prisma.seller.findFirst({
      where: {
        OR: [
          { phone: cleanPhone },
          ...(email ? [{ email }] : [])
        ]
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A seller application with this phone number or email already exists.',
        status: existing.status,
      });
    }

    const parsedLat = req.body.latitude ? parseFloat(String(req.body.latitude)) : (26.8530 + Math.random() * 0.04);
    const parsedLng = req.body.longitude ? parseFloat(String(req.body.longitude)) : (75.8050 + Math.random() * 0.04);
    const plan = req.body.subscriptionPlan ? String(req.body.subscriptionPlan).toUpperCase() : 'FREE';
    const isPro = plan === 'PRO' || Boolean(req.body.isPro);
    const dailyLimit = req.body.dailyOrderLimit ? parseInt(String(req.body.dailyOrderLimit), 10) : (isPro ? 9999 : 10);

    const seller = await prisma.seller.create({
      data: {
        businessName,
        ownerName,
        phone: cleanPhone,
        email: email || null,
        address,
        city: city || 'Jaipur',
        pincode: pincode || '302001',
        businessType: businessType || 'grocery',
        description: description || null,
        gstin: gstin || null,
        pan: pan || null,
        fssaiLicense: fssaiLicense || null,
        documentUrl: documentUrl || null,
        logo: logo || null,
        banner: banner || null,
        openingTime: openingTime || '07:00 AM',
        closingTime: closingTime || '10:00 PM',
        deliveryRadiusKm: deliveryRadiusKm ? parseFloat(deliveryRadiusKm) : 5.0,
        minOrderValue: minOrderValue ? parseFloat(minOrderValue) : 99.0,
        latitude: parsedLat,
        longitude: parsedLng,
        subscriptionPlan: plan,
        isPro: isPro,
        dailyOrderLimit: dailyLimit,
        ordersToday: 0,
        lastOrderDate: new Date(),
        status: 'PENDING',
        isVerified: false,
      }
    });

    logger.info(`New seller application submitted: ${seller.businessName} (ID: ${seller.id})`);

    return res.status(201).json({
      success: true,
      message: 'Seller application submitted successfully! Our team will review and approve your store soon.',
      data: {
        id: seller.id,
        businessName: seller.businessName,
        status: seller.status,
      }
    });
  } catch (error: any) {
    logger.error('Error submitting seller application:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit seller application',
    });
  }
});

// ============================================================================
// 2. PUBLIC STORES DIRECTORY (/api/v1/stores)
// Only APPROVED sellers appear on the public website!
// ============================================================================

router.get('/stores', async (req: Request, res: Response) => {
  try {
    const stores = await prisma.seller.findMany({
      where: {
        status: 'APPROVED',
        isActive: true,
      },
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { rating: 'desc' },
    });

    const mapped = stores.map(s => ({
      id: `store-${s.id}`,
      dbId: s.id,
      slug: s.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
      name: s.businessName,
      tagline: s.description || 'Verified Quality Store Partner',
      category: s.businessType.toUpperCase(),
      rating: s.rating,
      reviewsCount: s.totalRatings,
      deliveryTime: '15-25 mins',
      deliveryRadius: `${s.deliveryRadiusKm} km`,
      minOrder: s.minOrderValue,
      verified: s.isVerified,
      badge: s.isVerified ? 'Verified Seller' : 'Local Partner',
      logo: s.logo || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200',
      banner: s.banner || 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=1200',
      address: `${s.address}, ${s.city}`,
      openingHours: `${s.openingTime} - ${s.closingTime}`,
      ownerName: s.ownerName,
      productCount: s._count.products,
      isTopSeller: s.rating >= 4.9,
    }));

    return res.json({ success: true, data: mapped });
  } catch (error: any) {
    logger.error('Error fetching stores:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch stores' });
  }
});

router.get('/stores/:slugOrId', async (req: Request, res: Response) => {
  try {
    const { slugOrId } = req.params;
    const numericId = parseInt(slugOrId.replace(/^store-/, ''));

    let seller = null;
    if (!isNaN(numericId)) {
      seller = await prisma.seller.findUnique({
        where: { id: numericId },
        include: {
          products: {
            include: { category: true }
          }
        }
      });
    }

    if (!seller) {
      // Find by businessName matching slug
      const allSellers = await prisma.seller.findMany({
        where: { status: 'APPROVED' },
        include: {
          products: {
            include: { category: true }
          }
        }
      });
      seller = allSellers.find(s => 
        s.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') === slugOrId
      );
    }

    if (!seller || seller.status !== 'APPROVED') {
      return res.status(404).json({ success: false, message: 'Store not found or not yet approved' });
    }

    return res.json({ success: true, data: seller });
  } catch (error: any) {
    logger.error('Error fetching store detail:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch store' });
  }
});

// ============================================================================
// 3. GROCERY CATEGORIES & PRODUCTS (/api/v1/grocery/...)
// ============================================================================

router.get('/grocery/categories', async (_req: Request, res: Response) => {
  try {
    const categories = await prisma.kiranaCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { products: true }
        }
      }
    });

    const mapped = categories.map(c => ({
      _id: `cat-${c.id}`,
      id: c.id,
      name: c.name,
      slug: c.slug,
      tagline: c.tagline || '',
      icon: c.icon || 'Package',
      productCount: c._count.products,
      image: c.image || 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=600',
    }));

    return res.json({ success: true, data: mapped });
  } catch (error: any) {
    logger.error('Error fetching grocery categories:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch categories' });
  }
});

router.get('/grocery/products', async (req: Request, res: Response) => {
  try {
    const category = (req.query.category as string) || '';
    const query = ((req.query.query as string) || '').toLowerCase().trim();
    const brand = (req.query.brand as string) || '';
    const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined;
    const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined;
    const sortBy = (req.query.sortBy as string) || '';
    const isFeatured = req.query.isFeatured === 'true';
    const isBestseller = req.query.isBestseller === 'true';

    const where: any = {};

    if (category && category !== 'all') {
      where.OR = [
        { category: { slug: category } },
        { category: { name: { contains: category, mode: 'insensitive' } } }
      ];
    }

    if (query) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { brand: { contains: query, mode: 'insensitive' } },
            { category: { name: { contains: query, mode: 'insensitive' } } },
          ]
        }
      ];
    }

    if (brand) {
      where.brand = { equals: brand, mode: 'insensitive' };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.sellingPrice = {};
      if (minPrice !== undefined) where.sellingPrice.gte = minPrice;
      if (maxPrice !== undefined) where.sellingPrice.lte = maxPrice;
    }

    if (isFeatured) where.isFeatured = true;
    if (isBestseller) where.isBestseller = true;

    let orderBy: any = { createdAt: 'desc' };
    if (sortBy === 'price_asc') orderBy = { sellingPrice: 'asc' };
    else if (sortBy === 'price_desc') orderBy = { sellingPrice: 'desc' };
    else if (sortBy === 'rating') orderBy = { rating: 'desc' };
    else if (sortBy === 'discount') orderBy = { discountPercentage: 'desc' };

    const products = await prisma.kiranaProduct.findMany({
      where,
      orderBy,
      include: {
        category: true,
        seller: {
          select: { id: true, businessName: true, status: true, city: true }
        }
      }
    });

    const mapped = products.map(p => ({
      _id: `prod-${p.id}`,
      id: p.id,
      name: p.name,
      slug: p.slug,
      brand: p.brand || 'Pure Earth',
      categorySlug: p.category.slug,
      categoryName: p.category.name,
      weightQuantity: p.unit,
      mrp: p.originalPrice,
      sellingPrice: p.sellingPrice,
      price: p.sellingPrice,
      originalPrice: p.originalPrice,
      discountPercentage: p.discountPercentage,
      stock: p.stock,
      rating: p.rating,
      ratingCount: 85,
      deliveryEstimate: '15 mins',
      sellerId: p.seller ? `store-${p.seller.id}` : 'store-1',
      sellerName: p.seller?.businessName || 'GreenFarm Organics',
      image: p.image || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800',
      imageUrl: p.image || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800',
      isHeroFeatured: p.isFeatured,
      isBestseller: p.isBestseller,
      isTrending: true,
      isUnder99: p.sellingPrice <= 99,
      description: `${p.name} - Fresh, premium quality direct from verified farm/store partners.`,
    }));

    return res.json({ success: true, data: mapped });
  } catch (error: any) {
    logger.error('Error fetching grocery products:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch products' });
  }
});

router.get('/grocery/products/:idOrSlug', async (req: Request, res: Response) => {
  try {
    const { idOrSlug } = req.params;
    const numericId = parseInt(idOrSlug.replace(/^prod-/, ''));

    let product = null;
    if (!isNaN(numericId)) {
      product = await prisma.kiranaProduct.findUnique({
        where: { id: numericId },
        include: { category: true, seller: true }
      });
    }

    if (!product) {
      product = await prisma.kiranaProduct.findUnique({
        where: { slug: idOrSlug },
        include: { category: true, seller: true }
      });
    }

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const mapped = {
      _id: `prod-${product.id}`,
      id: product.id,
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      categorySlug: product.category.slug,
      categoryName: product.category.name,
      weightQuantity: product.unit,
      mrp: product.originalPrice,
      sellingPrice: product.sellingPrice,
      price: product.sellingPrice,
      originalPrice: product.originalPrice,
      discountPercentage: product.discountPercentage,
      stock: product.stock,
      rating: product.rating,
      image: product.image || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800',
      imageUrl: product.image || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800',
      isHeroFeatured: product.isFeatured,
      isBestseller: product.isBestseller,
      isTrending: true,
      isUnder99: product.sellingPrice <= 99,
      sellerName: product.seller?.businessName || 'Verified Store Partner',
      description: `${product.name} - Fresh and authentic sourced from verified suppliers.`,
    };

    return res.json({ success: true, data: mapped });
  } catch (error: any) {
    logger.error('Error fetching product detail:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch product' });
  }
});

// ============================================================================
// 4. LAUNDRY SERVICES & PRICING (/api/v1/laundry/...)
// ============================================================================

router.get('/laundry/services', async (_req: Request, res: Response) => {
  try {
    const services = await prisma.laundryCatalogService.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return res.json({ success: true, data: services });
  } catch (error: any) {
    logger.error('Error fetching laundry services:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch laundry services' });
  }
});

router.get('/laundry/items', async (_req: Request, res: Response) => {
  try {
    const items = await prisma.laundryCatalogItem.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    });

    return res.json({ success: true, data: items });
  } catch (error: any) {
    logger.error('Error fetching laundry items:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch laundry items' });
  }
});

router.get('/laundry/pricing', async (_req: Request, res: Response) => {
  try {
    const items = await prisma.laundryCatalogItem.findMany({
      where: { isActive: true },
    });

    const pricingTable: Record<string, Record<string, number>> = {
      'wash-fold': {},
      'wash-iron': {},
      'dry-clean': {},
      'steam-iron': {},
    };

    for (const item of items) {
      const p = item.pricing as Record<string, number>;
      const itemKey = `item-${item.id}`;
      if (p) {
        if (p['wash-fold']) pricingTable['wash-fold'][itemKey] = p['wash-fold'];
        if (p['wash-iron']) pricingTable['wash-iron'][itemKey] = p['wash-iron'];
        if (p['dry-clean']) pricingTable['dry-clean'][itemKey] = p['dry-clean'];
        if (p['steam-iron']) pricingTable['steam-iron'][itemKey] = p['steam-iron'];
      }
    }

    return res.json({ success: true, data: pricingTable });
  } catch (error: any) {
    logger.error('Error fetching laundry pricing:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch pricing' });
  }
});

// ============================================================================
// 5. PUBLIC & SELLER ORDER APIS (/api/v1/orders/...)
// ============================================================================

// 5.1 Place Grocery Order
router.post('/orders/grocery', async (req: Request, res: Response) => {
  try {
    const {
      sellerId,
      customerName,
      customerPhone,
      items,
      totalAmount,
      deliveryAddress,
      paymentMethod,
      orderId: clientOrderId,
    } = req.body;

    if (!customerPhone || !items || !items.length) {
      return res.status(400).json({
        success: false,
        message: 'Customer phone and items are required to place an order.',
      });
    }

    // Coordinates extraction (from payload or address or Jaipur center default)
    const custLat = parseFloat(String(req.body.customerLat || (typeof deliveryAddress === 'object' ? deliveryAddress.latitude : null) || 26.8530));
    const custLng = parseFloat(String(req.body.customerLng || (typeof deliveryAddress === 'object' ? deliveryAddress.longitude : null) || 75.8050));

    // Dynamic Radius Escalation Dispatch (3km -> 6km -> 9km -> 12km max -> Pro fallback)
    const dispatch = await findEligibleStoresWithEscalation(custLat, custLng, 'grocery');
    const assignedSeller = dispatch.selectedSeller;
    const finalSellerId = assignedSeller ? assignedSeller.id : (typeof sellerId === 'number' ? sellerId : 1);
    const storeLat = assignedSeller ? (assignedSeller.calculatedLat || assignedSeller.latitude || 26.8530) : 26.8530;
    const storeLng = assignedSeller ? (assignedSeller.calculatedLng || assignedSeller.longitude || 75.8050) : 75.8050;
    const dispatchRadiusKm = dispatch.radiusKm;

    const orderNumber = clientOrderId || `GL-GRC-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const addrStr = typeof deliveryAddress === 'object'
      ? `${deliveryAddress.houseFlat || ''} ${deliveryAddress.buildingStreet || deliveryAddress.street || ''} ${deliveryAddress.city || 'Jaipur'} ${deliveryAddress.pincode || ''}`.trim()
      : String(deliveryAddress || 'Jaipur');

    // Ensure Customer User exists in Database
    const cleanCustomerPhone = String(customerPhone).replace(/[^0-9]/g, '').slice(-10);
    if (cleanCustomerPhone.length === 10) {
      await prisma.user.upsert({
        where: { phone: cleanCustomerPhone },
        update: {
          fullName: customerName || undefined,
        },
        create: {
          phone: cleanCustomerPhone,
          fullName: customerName || 'Grocery Customer',
          role: 'CUSTOMER',
          isActive: true,
        },
      }).catch((err) => logger.warn('Auto user upsert on grocery order warning:', err?.message));
    }

    const createdOrder = await prisma.sellerOrder.create({
      data: {
        orderNumber,
        sellerId: finalSellerId,
        customerName: customerName || 'Valued Customer',
        customerPhone: String(customerPhone),
        items: items,
        totalAmount: parseFloat(String(totalAmount || 0)),
        status: 'Preparing',
        orderType: 'Grocery',
        deliveryAddress: addrStr,
        paymentMethod: paymentMethod || 'ONLINE',
        customerLat: custLat,
        customerLng: custLng,
        storeLat: storeLat,
        storeLng: storeLng,
        dispatchRadiusKm: dispatchRadiusKm,
      },
      include: {
        seller: {
          select: {
            id: true,
            businessName: true,
            phone: true,
            address: true,
            latitude: true,
            longitude: true,
            dailyOrderLimit: true,
            ordersToday: true,
            isPro: true,
          }
        }
      }
    });

    // Increment seller's ordersToday
    if (finalSellerId) {
      try {
        await acceptStoreOrder(orderNumber, finalSellerId);
      } catch (err) {
        logger.warn('Failed to update seller ordersToday counter:', err);
      }
    }

    // Stock decrement for KiranaProduct if IDs match
    for (const it of items) {
      const prodId = it.id ? parseInt(String(it.id).replace(/^prod-/, ''), 10) : null;
      if (prodId && !isNaN(prodId)) {
        try {
          await prisma.kiranaProduct.update({
            where: { id: prodId },
            data: {
              stock: { decrement: Math.max(1, it.qty || it.quantity || 1) }
            }
          });
        } catch {
          // ignore if product id is mock or not found
        }
      }
    }

    logger.info(`Grocery order placed: ${createdOrder.orderNumber} (Assigned Seller: ${finalSellerId}, Radius: ${dispatchRadiusKm}km, Dist: ${dispatch.distanceKm}km)`);

    return res.status(201).json({
      success: true,
      message: `Order assigned to ${assignedSeller?.businessName || 'nearby partner store'} within ${dispatchRadiusKm} km range!`,
      data: {
        ...createdOrder,
        dispatchRadiusKm,
        distanceKm: dispatch.distanceKm,
        isProEscalated: dispatch.isProEscalated,
        googleMapsUrl: `https://www.google.com/maps/dir/?api=1&origin=${storeLat},${storeLng}&destination=${custLat},${custLng}`,
      },
    });
  } catch (error: any) {
    logger.error('Error placing grocery order:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to place grocery order' });
  }
});

// 5.2 Place Laundry Order (Persists to both prisma.booking for Admin & prisma.sellerOrder for Laundry Seller)
router.post('/orders/laundry', async (req: Request, res: Response) => {
  try {
    const {
      customerName,
      customerPhone,
      serviceSlug,
      pickupDate,
      pickupSlot,
      pickupAddress,
      items,
      totalAmount,
      paymentMethod,
      specialInstructions,
      orderId: clientOrderId,
    } = req.body;

    const cleanPhone = String(customerPhone || '').replace(/[^0-9]/g, '').slice(-10);
    if (!cleanPhone) {
      return res.status(400).json({
        success: false,
        message: 'Valid customer phone number is required.',
      });
    }

    // 1. Ensure Customer User exists
    let customer = await prisma.user.findUnique({ where: { phone: cleanPhone } });
    if (!customer) {
      customer = await prisma.user.create({
        data: {
          phone: cleanPhone,
          fullName: customerName || 'Laundry Customer',
          role: 'CUSTOMER',
          isActive: true,
        },
      });
    }

    // 2. Find Laundry Service
    let service = await prisma.service.findFirst({
      where: { name: { contains: 'Laundry', mode: 'insensitive' } },
      include: { plans: true },
    });
    if (!service) {
      service = await prisma.service.findFirst({ include: { plans: true } });
    }

    const plan = service?.plans?.[0];
    const addrStr = typeof pickupAddress === 'object'
      ? `${pickupAddress.houseFlat || ''} ${pickupAddress.buildingStreet || pickupAddress.street || ''} ${pickupAddress.city || 'Jaipur'} ${pickupAddress.pincode || ''}`.trim()
      : String(pickupAddress || 'Jaipur');

    const amount = parseFloat(String(totalAmount || 0));

    // 3. Create Booking for Admin Order Management
    const booking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        serviceId: service?.id || 1,
        servicePlanId: plan?.id || 1,
        bookingDate: pickupDate ? new Date(pickupDate) : new Date(),
        duration: 60,
        totalAmount: amount,
        finalAmount: amount,
        location: typeof pickupAddress === 'object' ? (pickupAddress.city || 'Jaipur') : 'Jaipur',
        address: addrStr,
        city: 'Jaipur',
        notes: specialInstructions ? `${specialInstructions} (Slot: ${typeof pickupSlot === 'object' ? pickupSlot.timeWindow : pickupSlot})` : null,
        status: 'CONFIRMED',
      },
      include: {
        customer: true,
        service: true,
        servicePlan: true,
      },
    });

    // 4. Dynamic Radius Escalation Dispatch for Laundry
    const custLat = parseFloat(String(req.body.customerLat || (typeof pickupAddress === 'object' ? pickupAddress.latitude : null) || 26.8530));
    const custLng = parseFloat(String(req.body.customerLng || (typeof pickupAddress === 'object' ? pickupAddress.longitude : null) || 75.8050));

    const dispatch = await findEligibleStoresWithEscalation(custLat, custLng, 'laundry');
    const assignedSeller = dispatch.selectedSeller || await prisma.seller.findFirst({
      where: {
        OR: [
          { businessType: 'laundry' },
          { businessName: { contains: 'Laundry', mode: 'insensitive' } },
          { status: 'APPROVED' }
        ]
      }
    });

    const finalSellerId = assignedSeller?.id || 1;
    const storeLat = assignedSeller ? (assignedSeller.calculatedLat || assignedSeller.latitude || 26.8530) : 26.8530;
    const storeLng = assignedSeller ? (assignedSeller.calculatedLng || assignedSeller.longitude || 75.8050) : 75.8050;
    const dispatchRadiusKm = dispatch.radiusKm;

    const orderNumber = clientOrderId || `GL-LND-${booking.id}-${Math.floor(1000 + Math.random() * 9000)}`;

    let sellerOrder = null;
    if (assignedSeller) {
      sellerOrder = await prisma.sellerOrder.create({
        data: {
          orderNumber,
          sellerId: finalSellerId,
          customerName: customerName || customer.fullName,
          customerPhone: cleanPhone,
          items: items || [],
          totalAmount: amount,
          status: 'Awaiting Partner Acceptance',
          orderType: 'Laundry',
          deliveryAddress: addrStr,
          paymentMethod: paymentMethod || 'ONLINE',
          customerLat: custLat,
          customerLng: custLng,
          storeLat: storeLat,
          storeLng: storeLng,
          dispatchRadiusKm: dispatchRadiusKm,
        },
        include: {
          seller: true,
        }
      });

      // Broadcast real-time notification to all nearby laundry shops within 3km!
      broadcastSellerEvent('seller:new_booking_request', {
        orderNumber,
        orderId: sellerOrder.id,
        customerName: customerName || customer.fullName,
        customerPhone: cleanPhone,
        serviceSlug,
        pickupDate,
        pickupSlot,
        deliveryAddress: addrStr,
        items,
        totalAmount: amount,
        distanceKm: dispatch.distanceKm,
        dispatchRadiusKm,
        orderType: 'Laundry',
        createdAt: new Date().toISOString(),
      });
    }

    logger.info(`Laundry booking & broadcast created: Booking #${booking.id}, Order #${orderNumber} (Nearby Seller candidate: ${finalSellerId}, Radius: ${dispatchRadiusKm}km)`);

    return res.status(201).json({
      success: true,
      message: `Laundry pickup scheduled with ${assignedSeller?.businessName || 'nearby laundry hub'} within ${dispatchRadiusKm} km range!`,
      data: {
        bookingId: booking.id,
        orderNumber,
        booking,
        sellerOrder,
        dispatchRadiusKm,
        distanceKm: dispatch.distanceKm,
        googleMapsUrl: `https://www.google.com/maps/dir/?api=1&origin=${storeLat},${storeLng}&destination=${custLat},${custLng}`,
      },
    });
  } catch (error: any) {
    logger.error('Error placing laundry order:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to book laundry' });
  }
});

// 5.3 Live Order Tracking & Google Maps Routing
router.get('/orders/:orderId/track', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const numId = parseInt(orderId, 10);

    const order = await prisma.sellerOrder.findFirst({
      where: {
        OR: [
          { orderNumber: orderId },
          ...(!isNaN(numId) ? [{ id: numId }] : []),
        ],
      },
      include: {
        seller: {
          select: {
            id: true,
            businessName: true,
            ownerName: true,
            phone: true,
            address: true,
            rating: true,
            isPro: true,
            dailyOrderLimit: true,
            ordersToday: true,
            latitude: true,
            longitude: true,
          }
        },
      },
    });

    if (!order) {
      if (!isNaN(numId)) {
        const booking = await prisma.booking.findUnique({
          where: { id: numId },
          include: { customer: true, service: true },
        });
        if (booking) {
          const defaultSeller = await prisma.seller.findFirst({ where: { status: 'APPROVED' } });
          const cLat = 26.8530;
          const cLng = 75.8050;
          const sLat = defaultSeller?.latitude || 26.8620;
          const sLng = defaultSeller?.longitude || 75.8150;
          return res.json({
            success: true,
            data: {
              orderNumber: `BK-${booking.id}`,
              status: booking.status,
              orderType: booking.service?.name || 'Service',
              customerName: booking.customer?.fullName || 'Customer',
              customerPhone: booking.customer?.phone || '',
              deliveryAddress: booking.address,
              customerLat: cLat,
              customerLng: cLng,
              storeLat: sLat,
              storeLng: sLng,
              dispatchRadiusKm: 3.0,
              distanceKm: 2.1,
              isProEscalated: false,
              store: {
                id: defaultSeller?.id || 1,
                name: defaultSeller?.businessName || 'Dobhi Express Partner',
                phone: defaultSeller?.phone || '+91 98765 43210',
                address: defaultSeller?.address || 'Tonk Road, Jaipur',
                rating: defaultSeller?.rating || 4.8,
              },
              googleMapsUrl: `https://www.google.com/maps/dir/?api=1&origin=${sLat},${sLng}&destination=${cLat},${cLng}`,
            },
          });
        }
      }
      return res.status(404).json({ success: false, message: 'Order not found for tracking' });
    }

    const cLat = order.customerLat || 26.8530;
    const cLng = order.customerLng || 75.8050;
    const sLat = order.storeLat || order.seller?.latitude || 26.8620;
    const sLng = order.storeLng || order.seller?.longitude || 75.8150;
    const radius = order.dispatchRadiusKm || 3.0;

    // Haversine distance
    const dLat = (sLat - cLat) * (Math.PI / 180);
    const dLon = (sLng - cLng) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(cLat * (Math.PI / 180)) * Math.cos(sLat * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
    const dist = Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
    const etaMins = Math.max(12, Math.round(dist * 6 + 10));

    return res.json({
      success: true,
      data: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        orderType: order.orderType,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        deliveryAddress: order.deliveryAddress,
        totalAmount: order.totalAmount,
        items: order.items,
        customerLat: cLat,
        customerLng: cLng,
        storeLat: sLat,
        storeLng: sLng,
        dispatchRadiusKm: radius,
        distanceKm: dist,
        isProEscalated: radius > 12.0 || Boolean(order.seller?.isPro),
        etaMins,
        store: {
          id: order.seller?.id,
          name: order.seller?.businessName || 'Partner Hub',
          ownerName: order.seller?.ownerName,
          phone: order.seller?.phone,
          address: order.seller?.address,
          rating: order.seller?.rating || 4.8,
          isPro: Boolean(order.seller?.isPro),
          dailyOrderLimit: order.seller?.dailyOrderLimit,
          ordersToday: order.seller?.ordersToday,
        },
        googleMapsUrl: `https://www.google.com/maps/dir/?api=1&origin=${sLat},${sLng}&destination=${cLat},${cLng}`,
      },
    });
  } catch (error: any) {
    logger.error('Error in order tracking:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to track order' });
  }
});

// 5.4 Store Order Accept Endpoint
router.post('/orders/:orderId/accept', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const sellerId = parseInt(req.body.sellerId, 10);

    if (!sellerId || isNaN(sellerId)) {
      return res.status(400).json({ success: false, message: 'Valid sellerId is required' });
    }

    const result = await acceptStoreOrder(orderId, sellerId);
    return res.json({
      success: true,
      message: 'Store accepted the order successfully',
      data: result,
    });
  } catch (error: any) {
    logger.error('Error accepting store order:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to accept order' });
  }
});

// 5.5 Get Seller Profile & Status (Self Checking for Pending / Approved)
router.get('/seller/:sellerId/profile', async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    let sellerIdNum = parseInt(sellerId.replace(/^(store|seller)-/, ''), 10);

    let seller = null;
    if (!isNaN(sellerIdNum)) {
      seller = await prisma.seller.findUnique({
        where: { id: sellerIdNum },
        include: {
          products: { include: { category: true } },
          _count: { select: { orders: true, products: true } },
        }
      });
    }

    if (!seller) {
      seller = await prisma.seller.findFirst({
        where: {
          OR: [
            { phone: sellerId },
            { businessName: { contains: sellerId.replace(/-/g, ' '), mode: 'insensitive' } },
          ]
        },
        include: {
          products: { include: { category: true } },
          _count: { select: { orders: true, products: true } },
        }
      });
    }

    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller profile not found' });
    }

    return res.json({
      success: true,
      data: {
        id: `store-${seller.id}`,
        dbId: seller.id,
        businessName: seller.businessName,
        ownerName: seller.ownerName,
        phone: seller.phone,
        email: seller.email,
        address: seller.address,
        city: seller.city,
        pincode: seller.pincode,
        businessType: seller.businessType,
        status: seller.status, // 'PENDING' | 'APPROVED' | 'REJECTED'
        isVerified: seller.isVerified,
        subscriptionPlan: seller.subscriptionPlan || 'FREE',
        isPro: Boolean(seller.isPro || seller.subscriptionPlan === 'PRO'),
        dailyOrderLimit: seller.dailyOrderLimit ?? 10,
        ordersToday: seller.ordersToday ?? 0,
        deliveryRadiusKm: seller.deliveryRadiusKm || 5.0,
        rating: seller.rating || 4.8,
        createdAt: seller.createdAt,
        products: seller.products || [],
        totalOrdersCount: seller._count.orders,
      }
    });
  } catch (error: any) {
    logger.error('Error fetching seller profile:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch seller profile' });
  }
});

// 5.6 Create Product (Locked if Account is PENDING)
router.post('/seller/:sellerId/products', async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    let sellerIdNum = parseInt(sellerId.replace(/^(store|seller)-/, ''), 10);
    if (isNaN(sellerIdNum)) {
      const s = await prisma.seller.findFirst({ where: { businessName: { contains: sellerId, mode: 'insensitive' } } });
      if (s) sellerIdNum = s.id;
    }

    const seller = await prisma.seller.findUnique({ where: { id: sellerIdNum } });
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    if (seller.status !== 'APPROVED') {
      return res.status(403).json({
        success: false,
        message: 'Your seller account is pending Admin approval. You cannot add products until your account is approved.',
        status: seller.status,
      });
    }

    const { name, categoryId, price, originalPrice, stock, description, image, unit } = req.body;
    if (!name || !price) {
      return res.status(400).json({ success: false, message: 'Product name and price are required' });
    }

    const numPrice = parseFloat(price);
    const numOrig = originalPrice ? parseFloat(originalPrice) : numPrice;
    const discount = numOrig > numPrice ? Math.round(((numOrig - numPrice) / numOrig) * 100) : 0;

    let catId = categoryId ? parseInt(categoryId, 10) : 1;
    if (isNaN(catId)) catId = 1;

    const prod = await prisma.kiranaProduct.create({
      data: {
        name,
        slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
        sellingPrice: numPrice,
        originalPrice: numOrig,
        discountPercentage: discount,
        unit: unit || '1 pc',
        image: image || 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600',
        categoryId: catId,
        sellerId: seller.id,
        stock: stock ? parseInt(stock, 10) : 50,
        inStock: (stock ? parseInt(stock, 10) : 50) > 0,
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Product created successfully!',
      data: prod,
    });
  } catch (error: any) {
    logger.error('Error creating seller product:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create product' });
  }
});


// 5.3 Get Orders for Seller Dashboard
router.get('/seller/:sellerId/orders', async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    let sellerIdNum = parseInt(sellerId.replace(/^(store|seller)-/, ''), 10);

    if (isNaN(sellerIdNum)) {
      // Lookup seller by slug or businessName
      const seller = await prisma.seller.findFirst({
        where: {
          businessName: { contains: sellerId.replace(/-/g, ' '), mode: 'insensitive' }
        }
      });
      if (seller) sellerIdNum = seller.id;
    }

    const where: any = {};
    if (!isNaN(sellerIdNum)) {
      where.sellerId = sellerIdNum;
    }

    const orders = await prisma.sellerOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { seller: { select: { id: true, businessName: true } } },
    });

    return res.json({ success: true, data: orders });
  } catch (error: any) {
    logger.error('Error fetching seller orders:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch seller orders' });
  }
});

// 5.4 Update Seller Order Status
router.patch('/seller/orders/:orderId/status', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const numericId = parseInt(orderId, 10);
    let order = null;

    if (!isNaN(numericId)) {
      order = await prisma.sellerOrder.update({
        where: { id: numericId },
        data: { status },
      });
    } else {
      order = await prisma.sellerOrder.update({
        where: { orderNumber: orderId },
        data: { status },
      });
    }

    return res.json({ success: true, message: 'Order status updated successfully', data: order });
  } catch (error: any) {
    logger.error('Error updating order status:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to update order status' });
  }
});

// 5.5 Get Active Pending Incoming Booking Requests for Seller (within 3km range)
router.get('/seller/:sellerId/incoming-requests', async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    let sellerIdNum = parseInt(sellerId.replace(/^(store|seller)-/, ''), 10);
    if (isNaN(sellerIdNum)) {
      const s = await prisma.seller.findFirst({
        where: { businessName: { contains: sellerId.replace(/-/g, ' '), mode: 'insensitive' } }
      });
      if (s) sellerIdNum = s.id;
    }

    const seller = !isNaN(sellerIdNum) ? await prisma.seller.findUnique({ where: { id: sellerIdNum } }) : null;
    const sType = (seller?.businessType || 'laundry').toLowerCase();
    const sLat = seller?.latitude || 26.8630;
    const sLng = seller?.longitude || 75.8150;

    // Find all pending booking requests that are awaiting acceptance
    const pendingOrders = await prisma.sellerOrder.findMany({
      where: {
        status: {
          in: ['Awaiting Partner Acceptance', 'Broadcasting to Nearby Stores', 'PENDING_ACCEPTANCE', 'Pending Store Acceptance']
        },
        ...(sType === 'laundry' ? { orderType: { contains: 'laundry', mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const requests = pendingOrders.map((o) => {
      const cLat = o.customerLat || 26.8530;
      const cLng = o.customerLng || 75.8050;
      const dist = calculateDistanceKm(sLat, sLng, cLat, cLng);
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        orderType: o.orderType,
        items: o.items,
        totalAmount: o.totalAmount,
        deliveryAddress: o.deliveryAddress,
        distanceKm: dist,
        dispatchRadiusKm: o.dispatchRadiusKm || 3.0,
        status: o.status,
        createdAt: o.createdAt,
      };
    });

    return res.json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error: any) {
    logger.error('Error fetching seller incoming requests:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch incoming requests' });
  }
});

// 5.6 Accept Booking Request by Seller (Locks order, updates store coordinates, notifies customer)
router.post('/seller/orders/:orderId/accept', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { sellerId } = req.body;
    const numSellerId = parseInt(String(sellerId).replace(/^(store|seller)-/, ''), 10);

    const seller = await prisma.seller.findUnique({ where: { id: numSellerId } });
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    const numOrderId = parseInt(orderId, 10);
    const existingOrder = await prisma.sellerOrder.findFirst({
      where: {
        OR: [
          { orderNumber: orderId },
          ...(!isNaN(numOrderId) ? [{ id: numOrderId }] : []),
        ],
      },
    });

    if (!existingOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check if already claimed by another store
    if (
      existingOrder.status !== 'Awaiting Partner Acceptance' &&
      existingOrder.status !== 'Broadcasting to Nearby Stores' &&
      existingOrder.status !== 'Pending Store Acceptance' &&
      existingOrder.sellerId &&
      existingOrder.sellerId !== numSellerId
    ) {
      return res.status(409).json({
        success: false,
        message: 'This booking has already been claimed and accepted by another nearby partner.',
      });
    }

    const sLat = seller.latitude || 26.8630;
    const sLng = seller.longitude || 75.8150;
    const cLat = existingOrder.customerLat || 26.8530;
    const cLng = existingOrder.customerLng || 75.8050;

    // Increment seller's order count
    await acceptStoreOrder(existingOrder.orderNumber, numSellerId);

    // Update order status to Pickup Scheduled and link to this seller
    const updated = await prisma.sellerOrder.update({
      where: { id: existingOrder.id },
      data: {
        sellerId: numSellerId,
        status: 'Pickup Scheduled',
        storeLat: sLat,
        storeLng: sLng,
      },
      include: { seller: true },
    });

    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${sLat},${sLng}&destination=${cLat},${cLng}`;

    // Broadcast real-time order acceptance to customer and all panels
    broadcastSellerEvent('order:accepted', {
      orderNumber: existingOrder.orderNumber,
      sellerId: numSellerId,
      businessName: seller.businessName,
      ownerName: seller.ownerName,
      phone: seller.phone,
      address: seller.address,
      rating: seller.rating || 4.9,
      googleMapsUrl,
    });

    logger.info(`Booking #${existingOrder.orderNumber} successfully accepted by ${seller.businessName} (Owner: ${seller.ownerName}, Phone: ${seller.phone})`);

    return res.json({
      success: true,
      message: `Booking accepted! Customer has received your shop & contact details for pickup.`,
      data: {
        order: updated,
        seller: {
          id: seller.id,
          name: seller.businessName,
          ownerName: seller.ownerName,
          phone: seller.phone,
          address: seller.address,
          rating: seller.rating || 4.9,
          googleMapsUrl,
        },
      },
    });
  } catch (error: any) {
    logger.error('Error accepting seller order:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to accept order' });
  }
});

// 6. COUPON & OFFER VALIDATION (/api/v1/coupons/...)
router.get('/coupons/active', async (_req: Request, res: Response) => {
  try {
    const coupons: any[] = await prisma.$queryRawUnsafe(`
      SELECT id, code, title, description, "discountType", "discountValue",
             "minOrderValue", "maxDiscount", "usageLimit", "validUntil", "bgColor", "textColor"
      FROM "Coupon"
      WHERE "isActive" = true
        AND ("validUntil" IS NULL OR "validUntil" >= NOW())
      ORDER BY "createdAt" DESC;
    `);

    return res.json({ success: true, data: coupons, coupons });
  } catch (error: any) {
    logger.error('Error fetching active coupons:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch coupons' });
  }
});

router.post('/coupons/validate', async (req: Request, res: Response) => {
  try {
    const { code, subtotal = 0 } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, message: 'Coupon code is required' });
    }

    const cleanCode = code.trim().toUpperCase();
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM "Coupon" WHERE UPPER(code) = $1 LIMIT 1;`,
      cleanCode
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: `Invalid coupon code "${cleanCode}"` });
    }

    const coupon = rows[0];

    if (!coupon.isActive) {
      return res.status(400).json({ success: false, message: `Coupon "${cleanCode}" is currently inactive` });
    }

    if (coupon.validUntil && new Date(coupon.validUntil) < new Date()) {
      return res.status(400).json({ success: false, message: `Coupon "${cleanCode}" has expired` });
    }

    const orderSubtotal = Number(subtotal) || 0;
    const minOrder = Number(coupon.minOrderValue) || 0;
    if (orderSubtotal < minOrder) {
      return res.status(400).json({
        success: false,
        message: `Cart total must be at least ₹${minOrder} to apply this coupon`,
      });
    }

    let discount = 0;
    const val = Number(coupon.discountValue) || 0;
    const maxDisc = coupon.maxDiscount ? Number(coupon.maxDiscount) : Infinity;

    const discType = String(coupon.discountType || '').toUpperCase();
    if (discType === 'PERCENT' || discType === 'PERCENTAGE') {
      discount = Math.min(Math.round((orderSubtotal * val) / 100), maxDisc);
    } else {
      // FLAT
      discount = Math.min(val, orderSubtotal);
    }

    const isFreeDelivery = cleanCode === 'FREESHIP' || String(coupon.title || '').toLowerCase().includes('free delivery');

    return res.json({
      success: true,
      message: `Coupon ${cleanCode} applied successfully! You saved ₹${discount}`,
      data: {
        code: cleanCode,
        discount,
        desc: coupon.description || coupon.title || `Save ₹${discount}`,
        isFreeDelivery,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
      },
    });
  } catch (error: any) {
    logger.error('Error validating coupon:', error);
    return res.status(500).json({ success: false, message: 'Failed to validate coupon' });
  }
});

// ============================================================================
// 7. RAZORPAY PAYMENT GATEWAY FOR STORE CHECKOUT
// ============================================================================

router.post('/payments/razorpay/create-order', async (req: Request, res: Response) => {
  try {
    const { amount, receipt, notes } = req.body;
    const numAmount = parseFloat(String(amount || 0));

    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required' });
    }

    const orderData = await createGenericRazorpayOrder(
      numAmount,
      receipt || `RCPT-${Date.now()}`,
      notes || {}
    );

    return res.json({
      success: true,
      data: orderData,
      message: 'Razorpay order created successfully',
    });
  } catch (error: any) {
    logger.error('Error creating public razorpay order:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment order',
    });
  }
});

router.post('/payments/razorpay/verify', async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required Razorpay payment verification parameters',
      });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET || '';
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      logger.warn('Razorpay signature mismatch on checkout verification');
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed: invalid signature',
      });
    }

    // If orderId was provided, update the seller order status
    if (orderId) {
      try {
        await prisma.sellerOrder.updateMany({
          where: { orderNumber: String(orderId) },
          data: { paymentMethod: 'ONLINE' },
        });
      } catch (err) {
        logger.warn('Error updating seller order status after payment verification:', err);
      }
    }

    return res.json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        verified: true,
      },
    });
  } catch (error: any) {
    logger.error('Error verifying razorpay payment:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Payment verification failed',
    });
  }
});

// ============================================================================
// 8. OWNER WORKER MANAGEMENT & RESTRICTED WORKER PORTAL
// ============================================================================

// 8.1 Get workers for a seller
router.get('/seller/:sellerId/workers', async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    let sId = parseInt(String(sellerId).replace(/^(store|seller)-/, ''), 10);
    if (isNaN(sId)) {
      const s = await prisma.seller.findFirst({
        where: { businessName: { contains: sellerId.replace(/-/g, ' '), mode: 'insensitive' } }
      });
      if (s) sId = s.id;
    }

    const workers: any[] = await prisma.$queryRawUnsafe(`
      SELECT id, "workerId", "sellerId", name, phone, role, passcode, "isActive", "assignedOrdersCount", "createdAt"
      FROM "SellerWorker"
      WHERE "sellerId" = $1
      ORDER BY "createdAt" DESC;
    `, sId);

    return res.json({ success: true, data: workers });
  } catch (error: any) {
    logger.error('Error fetching seller workers:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch workers' });
  }
});

// 8.2 Add worker by owner with auto-generated Worker ID & passcode
router.post('/seller/:sellerId/workers', async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params;
    let sId = parseInt(String(sellerId).replace(/^(store|seller)-/, ''), 10);
    if (isNaN(sId)) {
      const s = await prisma.seller.findFirst({
        where: { businessName: { contains: sellerId.replace(/-/g, ' '), mode: 'insensitive' } }
      });
      if (s) sId = s.id;
    }

    const seller = await prisma.seller.findUnique({ where: { id: sId } });
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    const { name, phone, role } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Worker name and phone are required' });
    }

    // Auto-generate Unique Worker ID: WRK-<prefix>-<num>
    const prefix = (seller.businessType || 'ST').substring(0, 3).toUpperCase();
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const workerId = `WRK-${prefix}-${randomSuffix}`;
    // Auto-generate 4-digit passcode
    const passcode = String(Math.floor(1000 + Math.random() * 9000));

    const inserted: any[] = await prisma.$queryRawUnsafe(`
      INSERT INTO "SellerWorker" ("workerId", "sellerId", name, phone, role, passcode, "isActive", "assignedOrdersCount", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, true, 0, NOW(), NOW())
      RETURNING *;
    `, workerId, sId, name, String(phone), role || 'Delivery Partner', passcode);

    logger.info(`Owner #${sId} added new worker ${workerId} (${name})`);

    return res.status(201).json({
      success: true,
      message: `Worker ${name} added successfully! Worker ID: ${workerId}, Passcode: ${passcode}`,
      data: inserted[0],
    });
  } catch (error: any) {
    logger.error('Error adding seller worker:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to add worker' });
  }
});

// 8.3 Deactivate or Delete worker
router.delete('/seller/:sellerId/workers/:workerId', async (req: Request, res: Response) => {
  try {
    const { workerId } = req.params;
    await prisma.$queryRawUnsafe(`DELETE FROM "SellerWorker" WHERE "workerId" = $1;`, workerId);
    return res.json({ success: true, message: `Worker ${workerId} removed successfully.` });
  } catch (error: any) {
    logger.error('Error deleting worker:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to delete worker' });
  }
});

// 8.4 Assign order to worker
router.post('/seller/orders/:orderId/assign-worker', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { workerId } = req.body;

    if (!workerId) {
      return res.status(400).json({ success: false, message: 'workerId is required' });
    }

    const workerRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM "SellerWorker" WHERE "workerId" = $1 AND "isActive" = true LIMIT 1;`,
      workerId
    );

    if (!workerRows || workerRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Active worker not found with this ID' });
    }

    const worker = workerRows[0];
    const numOrderId = parseInt(orderId, 10);

    const order = await prisma.sellerOrder.findFirst({
      where: {
        OR: [
          { orderNumber: orderId },
          ...(!isNaN(numOrderId) ? [{ id: numOrderId }] : []),
        ]
      }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "SellerOrder" SET "assignedWorkerId" = $1, status = 'Out for Delivery' WHERE id = $2;`,
      workerId,
      order.id
    );

    await prisma.$executeRawUnsafe(
      `UPDATE "SellerWorker" SET "assignedOrdersCount" = "assignedOrdersCount" + 1 WHERE "workerId" = $1;`,
      workerId
    );

    logger.info(`Order #${order.orderNumber} assigned to worker ${worker.name} (${workerId})`);

    return res.json({
      success: true,
      message: `Order #${order.orderNumber} successfully assigned to ${worker.name} (${workerId})!`,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        assignedWorkerId: workerId,
        workerName: worker.name,
        workerPhone: worker.phone,
      }
    });
  } catch (error: any) {
    logger.error('Error assigning worker to order:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to assign worker' });
  }
});

// 8.5 Worker Login
router.post('/worker/login', async (req: Request, res: Response) => {
  try {
    const { workerId, passcode } = req.body;

    if (!workerId || !passcode) {
      return res.status(400).json({ success: false, message: 'Worker ID and passcode are required.' });
    }

    const cleanId = String(workerId).trim().toUpperCase();
    const cleanPass = String(passcode).trim();

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM "SellerWorker" WHERE UPPER("workerId") = $1 AND passcode = $2 LIMIT 1;`,
      cleanId,
      cleanPass
    );

    if (!rows || rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid Worker ID or Passcode.' });
    }

    const worker = rows[0];
    if (!worker.isActive) {
      return res.status(403).json({ success: false, message: 'Your worker account is inactive. Please contact store owner.' });
    }

    const seller = await prisma.seller.findUnique({
      where: { id: worker.sellerId },
      select: { id: true, businessName: true, phone: true, address: true, businessType: true }
    });

    return res.json({
      success: true,
      message: `Welcome back, ${worker.name}!`,
      data: {
        workerId: worker.workerId,
        name: worker.name,
        phone: worker.phone,
        role: worker.role,
        sellerId: worker.sellerId,
        store: seller,
      }
    });
  } catch (error: any) {
    logger.error('Error in worker login:', error);
    return res.status(500).json({ success: false, message: error.message || 'Worker login failed' });
  }
});

// 8.6 Restricted Worker Dashboard (Only assigned orders, locations, product price details; NO financials)
router.get('/worker/:workerId/dashboard', async (req: Request, res: Response) => {
  try {
    const { workerId } = req.params;
    const cleanId = String(workerId).trim().toUpperCase();

    const workerRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM "SellerWorker" WHERE UPPER("workerId") = $1 LIMIT 1;`,
      cleanId
    );

    if (!workerRows || workerRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Worker profile not found.' });
    }

    const worker = workerRows[0];

    const seller = await prisma.seller.findUnique({
      where: { id: worker.sellerId },
      select: {
        id: true,
        businessName: true,
        phone: true,
        address: true,
        latitude: true,
        longitude: true,
        businessType: true,
      }
    });

    // Fetch assigned orders with customer location & products
    const assignedOrders: any[] = await prisma.$queryRawUnsafe(`
      SELECT id, "orderNumber", "customerName", "customerPhone", "orderType", items, "totalAmount",
             "deliveryAddress", "customerLat", "customerLng", "storeLat", "storeLng", status, "createdAt"
      FROM "SellerOrder"
      WHERE "assignedWorkerId" = $1
      ORDER BY "createdAt" DESC;
    `, worker.workerId);

    // Format orders with direct Google Maps navigation links
    const formattedOrders = assignedOrders.map((o) => {
      const sLat = o.storeLat || seller?.latitude || 26.8620;
      const sLng = o.storeLng || seller?.longitude || 75.8150;
      const cLat = o.customerLat || 26.8530;
      const cLng = o.customerLng || 75.8050;
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        orderType: o.orderType,
        items: o.items,
        totalAmount: o.totalAmount, // Bill price to collect from customer if COD
        deliveryAddress: o.deliveryAddress,
        status: o.status,
        createdAt: o.createdAt,
        googleMapsUrl: `https://www.google.com/maps/dir/?api=1&origin=${sLat},${sLng}&destination=${cLat},${cLng}`,
      };
    });

    // Fetch product catalog with prices so worker can verify pricing & packaging
    let catalogItems: any[] = [];
    if (seller?.businessType === 'laundry') {
      const items = await prisma.laundryCatalogItem.findMany({
        where: { isActive: true },
        select: { id: true, name: true, category: true, pricing: true, icon: true },
        take: 30,
      });
      catalogItems = items.map((it) => ({
        id: it.id,
        name: it.name,
        category: it.category,
        pricing: it.pricing,
      }));
    } else {
      const products = await prisma.kiranaProduct.findMany({
        where: { sellerId: worker.sellerId },
        select: { id: true, name: true, unit: true, sellingPrice: true, image: true, stock: true },
        take: 30,
      });
      catalogItems = products;
    }

    return res.json({
      success: true,
      data: {
        worker: {
          workerId: worker.workerId,
          name: worker.name,
          phone: worker.phone,
          role: worker.role,
        },
        store: seller,
        assignedOrders: formattedOrders,
        catalogItems,
      }
    });
  } catch (error: any) {
    logger.error('Error fetching worker dashboard:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to load worker dashboard' });
  }
});

// 8.7 Worker Updates Order Delivery Status
router.patch('/worker/orders/:orderId/status', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { status, workerId } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const allowedStatuses = ['Picked up', 'In Transit', 'Out for Delivery', 'Delivered', 'Completed'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` });
    }

    const numOrderId = parseInt(orderId, 10);
    const order = await prisma.sellerOrder.findFirst({
      where: {
        OR: [
          { orderNumber: orderId },
          ...(!isNaN(numOrderId) ? [{ id: numOrderId }] : []),
        ]
      }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const updated = await prisma.sellerOrder.update({
      where: { id: order.id },
      data: { status },
    });

    logger.info(`Worker ${workerId || 'assigned'} updated order #${order.orderNumber} status to: ${status}`);

    return res.json({
      success: true,
      message: `Delivery status updated to "${status}"`,
      data: updated,
    });
  } catch (error: any) {
    logger.error('Error updating delivery status by worker:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to update delivery status' });
  }
});

// ============================================================================
// 9. SELLER GMAIL OTP AUTHENTICATION
// ============================================================================

interface SellerOtpRecord {
  otp: string;
  expiresAt: number;
  email: string;
}

const sellerEmailOtpStore = new Map<string, SellerOtpRecord>();

// 9.1 Send OTP to Seller Gmail
router.post('/seller/auth/send-otp', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Please provide a valid Gmail / Email address.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const otp = String(Math.floor(1000 + Math.random() * 9000));
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    sellerEmailOtpStore.set(cleanEmail, { otp, expiresAt, email: cleanEmail });

    // Check if seller already exists with this email
    let seller = await prisma.seller.findFirst({
      where: {
        OR: [
          { email: cleanEmail },
          { email: { contains: cleanEmail, mode: 'insensitive' } }
        ]
      }
    });

    // If not found, link with first approved or pending seller or allow self-registration
    if (!seller) {
      seller = await prisma.seller.findFirst({
        orderBy: { id: 'desc' }
      });
    }

    logger.info(`[Seller Auth] OTP generated for ${cleanEmail}: ${otp} (Store: ${seller?.businessName || 'New Store'})`);

    return res.json({
      success: true,
      message: `OTP sent successfully to ${cleanEmail}. Please enter the 4-digit code to continue.`,
      email: cleanEmail,
      otp, // provided for seamless developer/testing and SMS/Gmail service
      expiresIn: 600,
      storeName: seller?.businessName || 'Partner Store',
    });
  } catch (error: any) {
    logger.error('Error in seller send-otp:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to send OTP' });
  }
});

// 9.2 Verify OTP and Login Seller
router.post('/seller/auth/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    const record = sellerEmailOtpStore.get(cleanEmail);

    // Verify OTP (allow test OTP '1234' or exact generated OTP)
    const isMasterOtp = cleanOtp === '1234';
    const isValidOtp = record && record.otp === cleanOtp && record.expiresAt > Date.now();

    if (!isMasterOtp && !isValidOtp) {
      return res.status(401).json({ success: false, message: 'Invalid or expired OTP. Please request a new code.' });
    }

    // Remove consumed OTP
    sellerEmailOtpStore.delete(cleanEmail);

    // Fetch Seller Record
    let seller: any = await prisma.seller.findFirst({
      where: {
        OR: [
          { email: cleanEmail },
          { email: { contains: cleanEmail, mode: 'insensitive' } }
        ]
      },
      include: {
        products: true,
        _count: { select: { orders: true } }
      }
    });

    // If seller email wasn't recorded before, associate with default store or create
    if (!seller) {
      seller = await prisma.seller.findFirst({
        where: { status: 'APPROVED' },
        include: { products: true, _count: { select: { orders: true } } }
      });

      if (seller) {
        // Update seller with this email
        await prisma.seller.update({
          where: { id: seller.id },
          data: { email: cleanEmail }
        });
      }
    }

    if (!seller) {
      // Create fresh seller profile for this email
      seller = await prisma.seller.create({
        data: {
          businessName: `${cleanEmail.split('@')[0].toUpperCase()} Store`,
          ownerName: cleanEmail.split('@')[0],
          phone: '9829033333',
          email: cleanEmail,
          address: 'Tonk Road, Jaipur, Rajasthan',
          city: 'Jaipur',
          pincode: '302001',
          businessType: 'laundry',
          status: 'APPROVED',
          isVerified: true,
          dailyOrderLimit: 10,
          deliveryRadiusKm: 5.0,
        },
        include: { products: true, _count: { select: { orders: true } } }
      });
    }

    logger.info(`[Seller Auth] Seller successfully logged in: ${seller.businessName} (${cleanEmail})`);

    return res.json({
      success: true,
      message: `Welcome back, ${seller.ownerName || seller.businessName}!`,
      token: `seller-jwt-${Date.now()}-${seller.id}`,
      seller: {
        id: `store-${seller.id}`,
        dbId: seller.id,
        businessName: seller.businessName,
        name: seller.businessName,
        ownerName: seller.ownerName,
        email: cleanEmail,
        phone: seller.phone,
        address: seller.address,
        businessType: seller.businessType,
        category: (seller.businessType || 'laundry').toUpperCase(),
        status: seller.status,
        isVerified: seller.isVerified,
        dailyOrderLimit: seller.dailyOrderLimit || 10,
        ordersToday: seller.ordersToday || 0,
        deliveryRadiusKm: seller.deliveryRadiusKm || 5.0,
        rating: seller.rating || 4.9,
      }
    });
  } catch (error: any) {
    logger.error('Error in seller verify-otp:', error);
    return res.status(500).json({ success: false, message: error.message || 'OTP verification failed' });
  }
});

// ============================================================================
// 10. PUBLIC CUSTOMER AUTHENTICATION (/api/v1/customer/...)
// Saves and verifies real customers directly against PostgreSQL User table
// ============================================================================

router.post('/customer/register', async (req: Request, res: Response) => {
  try {
    const name = req.body.name || req.body.fullName;
    const { email, phone, password } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Full name and phone number are required.',
      });
    }

    const cleanPhone = String(phone).replace(/[^0-9]/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 10-digit Indian phone number.',
      });
    }

    const cleanEmail = email ? String(email).trim().toLowerCase() : null;

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: cleanPhone },
          ...(cleanEmail ? [{ email: cleanEmail }] : []),
        ],
      },
    });

    if (user) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          fullName: name,
          ...(cleanEmail && !user.email ? { email: cleanEmail } : {}),
          isActive: true,
        },
      });
    } else {
      user = await prisma.user.create({
        data: {
          fullName: name,
          phone: cleanPhone,
          email: cleanEmail,
          password: password ? String(password) : undefined,
          role: 'CUSTOMER',
          isActive: true,
        },
      });
    }

    const token = `customer-jwt-${Date.now()}-${user.id}`;
    logger.info(`[Customer Registered] User created/updated in PostgreSQL: ${user.fullName} (${user.phone}) ID: ${user.id}`);

    return res.status(201).json({
      success: true,
      message: 'Customer registered successfully!',
      token,
      user: {
        id: user.id,
        name: user.fullName,
        email: user.email || `${cleanPhone}@customer.dobhi.com`,
        phone: user.phone,
        role: 'customer',
      },
    });
  } catch (error: any) {
    logger.error('Error registering customer:', error);
    return res.status(500).json({ success: false, message: error.message || 'Registration failed' });
  }
});

router.post('/customer/login', async (req: Request, res: Response) => {
  try {
    const { email, phone, password } = req.body;

    let user: any = null;

    if (phone) {
      const cleanPhone = String(phone).replace(/[^0-9]/g, '').slice(-10);
      user = await prisma.user.findUnique({ where: { phone: cleanPhone } });
    }

    if (!user && email) {
      const cleanEmail = String(email).trim().toLowerCase();
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: cleanEmail },
            { email: { equals: cleanEmail, mode: 'insensitive' } },
          ],
        },
      });
    }

    if (!user) {
      const cleanP = String(phone || '98290' + Math.floor(10000 + Math.random() * 90000)).replace(/[^0-9]/g, '').slice(-10);
      const cleanE = email ? String(email).trim().toLowerCase() : `${cleanP}@customer.dobhi.com`;
      const name = cleanE.split('@')[0].toUpperCase();

      user = await prisma.user.create({
        data: {
          fullName: name,
          phone: cleanP,
          email: cleanE,
          password: password ? String(password) : undefined,
          role: 'CUSTOMER',
          isActive: true,
        },
      });
      logger.info(`[Customer Login] Created new customer record on login: ${user.fullName} (${user.phone})`);
    }

    const token = `customer-jwt-${Date.now()}-${user.id}`;

    return res.json({
      success: true,
      message: `Welcome back, ${user.fullName}!`,
      token,
      user: {
        id: user.id,
        name: user.fullName,
        email: user.email || `${user.phone}@customer.dobhi.com`,
        phone: user.phone,
        role: 'customer',
      },
    });
  } catch (error: any) {
    logger.error('Error in customer login:', error);
    return res.status(500).json({ success: false, message: error.message || 'Login failed' });
  }
});

router.get('/customer/me', async (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization;
    if (!auth) {
      return res.status(401).json({ success: false, message: 'Authentication token required.' });
    }
    const token = auth.replace('Bearer ', '');
    const parts = token.split('-');
    const userId = parts[parts.length - 1];
    const numId = parseInt(userId, 10);

    const user = !isNaN(numId) ? await prisma.user.findUnique({ where: { id: numId } }) : null;

    if (!user) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    return res.json({
      success: true,
      data: {
        id: user.id,
        name: user.fullName,
        email: user.email,
        phone: user.phone,
        role: 'customer',
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/coupons/active
router.get('/coupons/active', async (_req: Request, res: Response): Promise<any> => {
  try {
    const coupons = await prisma.coupon.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    const mapped = coupons.map(c => {
      const isLaundry = c.categoryId === 1;
      return {
        id: `coupon-${c.id}`,
        dbId: c.id,
        code: c.code,
        headline: c.title,
        subtext: c.description,
        badge: c.isFirstUserOnly ? 'New Member Benefit' : (c.discountType === 'PERCENT' ? `${c.discountValue}% Off` : `₹${c.discountValue} Off`),
        minOrder: c.minOrderValue,
        discountValue: c.discountType === 'PERCENT' ? `${c.discountValue}% Off` : `₹${c.discountValue} Flat Discount`,
        ctaText: isLaundry ? 'Schedule Laundry' : 'Start Shopping',
        ctaLink: isLaundry ? '/laundry' : '/grocery',
        theme: isLaundry ? 'laundry' : 'grocery',
        bgColor: c.bgColor,
        textColor: c.textColor,
        validUntil: c.validUntil,
      };
    });

    return res.json({ success: true, data: mapped });
  } catch (error: any) {
    logger.error('Error fetching active coupons:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch coupons' });
  }
});

// GET /api/v1/faqs?category=laundry
router.get('/faqs', async (req: Request, res: Response): Promise<any> => {
  try {
    const { category, categoryId } = req.query;
    const where: any = {};

    if (categoryId) {
      const parsed = parseInt(String(categoryId), 10);
      if (!isNaN(parsed)) {
        where.categoryId = parsed;
      }
    } else if (category) {
      where.OR = [
        { category: { contains: String(category), mode: 'insensitive' } },
        { category: 'general' }
      ];
    }

    const faqs = await prisma.fAQ.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const mapped = faqs.map(f => ({
      id: f.id,
      q: f.question,
      a: f.answer,
      category: f.category,
      categoryId: f.categoryId,
    }));

    return res.json({ success: true, data: mapped });
  } catch (error: any) {
    logger.error('Error fetching public FAQs:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to fetch FAQs' });
  }
});

export default router;
