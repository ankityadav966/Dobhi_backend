import { prisma } from '../prisma.client';
import logger from '../utils/logger';

const EARTH_RADIUS_KM = 6371;

/**
 * Calculate distance between two coordinates in kilometers using Haversine formula
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((EARTH_RADIUS_KM * c) * 100) / 100; // round to 2 decimals
}

/**
 * Reset seller's daily order count if today is a new calendar day
 */
export function isNewDay(lastDate: Date | null): boolean {
  if (!lastDate) return true;
  const last = new Date(lastDate);
  const now = new Date();
  return (
    last.getFullYear() !== now.getFullYear() ||
    last.getMonth() !== now.getMonth() ||
    last.getDate() !== now.getDate()
  );
}

/**
 * Radius Escalation Engine:
 * Phase 1: 3 km
 * Phase 2: 6 km
 * Phase 3: 9 km
 * Phase 4: 12 km (Maximum standard radius)
 * Phase 5: Pro / Priority Partner Stores
 */
export async function findEligibleStoresWithEscalation(
  customerLat: number,
  customerLng: number,
  businessType: string = 'grocery'
): Promise<{
  selectedSeller: any | null;
  radiusKm: number;
  isProEscalated: boolean;
  distanceKm: number;
  candidateSellers: any[];
}> {
  // Fetch all approved and active sellers of matching business type (or all if general)
  const sellers = await prisma.seller.findMany({
    where: {
      status: 'APPROVED',
      isActive: true,
      ...(businessType && businessType !== 'all'
        ? { businessType: { contains: businessType.toLowerCase(), mode: 'insensitive' } }
        : {}),
    },
  });

  const now = new Date();

  // Filter sellers whose daily quota hasn't been exhausted (default: 10 orders/day on Free tier)
  const availableSellers = [];
  for (const s of sellers) {
    let ordersToday = s.ordersToday || 0;
    if (isNewDay(s.lastOrderDate)) {
      ordersToday = 0;
      // update db asynchronously
      prisma.seller.update({
        where: { id: s.id },
        data: { ordersToday: 0, lastOrderDate: now },
      }).catch(err => logger.warn(`Error resetting seller ${s.id} daily orders:`, err));
    }

    const limit = s.dailyOrderLimit ?? 10;
    const isPro = Boolean(s.isPro || (s.subscriptionPlan && s.subscriptionPlan !== 'FREE'));

    // If on Free plan, cannot exceed dailyOrderLimit (10 orders)
    if (!isPro && limit > 0 && ordersToday >= limit) {
      logger.info(`Seller ${s.id} (${s.businessName}) reached daily order limit (${ordersToday}/${limit})`);
      continue;
    }

    // Default fallback coordinates around Jaipur center if not yet pinned on map
    const sLat = s.latitude || 26.8530 + ((s.id % 5) * 0.015);
    const sLng = s.longitude || 75.8050 + ((s.id % 5) * 0.015);
    const dist = calculateDistanceKm(customerLat, customerLng, sLat, sLng);

    availableSellers.push({
      ...s,
      calculatedLat: sLat,
      calculatedLng: sLng,
      distanceKm: dist,
      ordersToday,
      isPro,
    });
  }

  // Sort available sellers by distance
  availableSellers.sort((a, b) => a.distanceKm - b.distanceKm);

  // ─── TIER 1: 3 km Range ───────────────────────────────────────────
  const tier3km = availableSellers.filter(s => s.distanceKm <= 3.0);
  if (tier3km.length > 0) {
    return {
      selectedSeller: tier3km[0],
      radiusKm: 3.0,
      isProEscalated: false,
      distanceKm: tier3km[0].distanceKm,
      candidateSellers: tier3km,
    };
  }

  // ─── TIER 2: 6 km Range ───────────────────────────────────────────
  const tier6km = availableSellers.filter(s => s.distanceKm <= 6.0);
  if (tier6km.length > 0) {
    return {
      selectedSeller: tier6km[0],
      radiusKm: 6.0,
      isProEscalated: false,
      distanceKm: tier6km[0].distanceKm,
      candidateSellers: tier6km,
    };
  }

  // ─── TIER 3: 9 km Range ───────────────────────────────────────────
  const tier9km = availableSellers.filter(s => s.distanceKm <= 9.0);
  if (tier9km.length > 0) {
    return {
      selectedSeller: tier9km[0],
      radiusKm: 9.0,
      isProEscalated: false,
      distanceKm: tier9km[0].distanceKm,
      candidateSellers: tier9km,
    };
  }

  // ─── TIER 4: 12 km Maximum Range ──────────────────────────────────
  const tier12km = availableSellers.filter(s => s.distanceKm <= 12.0);
  if (tier12km.length > 0) {
    return {
      selectedSeller: tier12km[0],
      radiusKm: 12.0,
      isProEscalated: false,
      distanceKm: tier12km[0].distanceKm,
      candidateSellers: tier12km,
    };
  }

  // ─── TIER 5: Fallback to Pro / Priority Partner Stores (beyond 12km) ─
  const proSellers = availableSellers.filter(s => s.isPro);
  if (proSellers.length > 0) {
    return {
      selectedSeller: proSellers[0],
      radiusKm: 12.0,
      isProEscalated: true,
      distanceKm: proSellers[0].distanceKm,
      candidateSellers: proSellers,
    };
  }

  // Fallback to nearest available store
  const nearest = availableSellers[0] || null;
  return {
    selectedSeller: nearest,
    radiusKm: 12.0,
    isProEscalated: true,
    distanceKm: nearest?.distanceKm || 2.5,
    candidateSellers: availableSellers,
  };
}

/**
 * Handle store order acceptance
 */
export async function acceptStoreOrder(orderNumber: string, sellerId: number) {
  const seller = await prisma.seller.findUnique({ where: { id: sellerId } });
  if (!seller) throw new Error('Seller not found');

  const now = new Date();
  const resetOrders = isNewDay(seller.lastOrderDate);

  // Update seller orders count
  await prisma.seller.update({
    where: { id: sellerId },
    data: {
      ordersToday: resetOrders ? 1 : { increment: 1 },
      lastOrderDate: now,
    },
  });

  const sLat = seller.latitude || 26.8530;
  const sLng = seller.longitude || 75.8050;

  // Update order with locked coordinates
  const updatedOrder = await prisma.sellerOrder.updateMany({
    where: { orderNumber },
    data: {
      sellerId,
      status: 'Preparing',
      storeLat: sLat,
      storeLng: sLng,
    },
  });

  return { success: true, seller, updatedOrder };
}
