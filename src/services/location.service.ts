import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

export interface LocationData {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: Date;
}

export interface GoogleMapsRoute {
  origin: {
    lat: number;
    lng: number;
    name?: string;
  };
  destination: {
    lat: number;
    lng: number;
    name?: string;
  };
  userLocation: {
    lat: number;
    lng: number;
    name: string;
    address?: string;
    timestamp: Date;
  };
  partnerLocation: {
    lat: number;
    lng: number;
    name: string;
    address?: string;
    timestamp: Date;
  };
  distance?: string;
  duration?: string;
}

export interface LocationResponse {
  success: boolean;
  data?: {
    route: GoogleMapsRoute;
    waypoints?: Array<{
      lat: number;
      lng: number;
      timestamp: Date;
    }>;
    polylinePoints?: string;
  };
  message?: string;
}

/**
 * Update user/partner real-time location
 */
export const updateLocation = async (userId: string, location: LocationData): Promise<boolean> => {
  try {
    const userIdNum = parseInt(userId, 10);
    const helper = await prisma.helper.findUnique({
      where: { userId: userIdNum },
    });

    if (!helper) {
      logger.warn(`Helper not found for userId: ${userId}`);
      return false;
    }

    // Update helper profile location
    await prisma.helperProfile.upsert({
      where: { helperId: helper.id },
      update: {
        latitude: location.latitude,
        longitude: location.longitude,
      },
      create: {
        helperId: helper.id,
        latitude: location.latitude,
        longitude: location.longitude,
      },
    });

    // Upsert dedicated live location row
    await updateHelperLocation(helper.id, location.latitude, location.longitude, {
      accuracy: location.accuracy,
    });

    await prisma.helper.update({
      where: { id: helper.id },
      data: { lastActiveAt: new Date() },
    });

    logger.info(`Location updated for userId ${userId}: ${location.latitude}, ${location.longitude}`);
    return true;
  } catch (error) {
    logger.error(`Error updating location: ${error}`);
    throw error;
  }
};

/**
 * Get real-time route data between user and partner for Google Maps
 */
export const getRealTimeRoute = async (
  _customerId: string,
  bookingId: string
): Promise<GoogleMapsRoute | null> => {
  try {
    // Get booking details
    const bookingIdNum = parseInt(bookingId, 10);
    const booking = await prisma.booking.findUnique({
      where: { id: bookingIdNum },
      include: {
        customer: true,
        service: true,
      },
    });

    if (!booking) {
      logger.warn(`Booking not found: ${bookingId}`);
      return null;
    }

    // Fetch helper with profile if assigned
    const helper = booking.helperId ? await prisma.helper.findUnique({
      where: { id: booking.helperId },
      include: { profile: true, user: { select: { fullName: true } } },
    }) : null;

    const customer = booking.customer;

    // Check if both have valid locations
    if (!booking.latitude || !booking.longitude || !helper || !helper.profile?.latitude || !helper.profile?.longitude) {
      logger.warn(`Missing location data for booking ${bookingId}`);
      return null;
    }

    const route: GoogleMapsRoute = {
      origin: {
        lat: booking.latitude,
        lng: booking.longitude,
        name: 'Booking Location',
      },
      destination: {
        lat: helper.profile.latitude,
        lng: helper.profile.longitude,
        name: helper.user?.fullName || 'Helper/Partner',
      },
      userLocation: {
        lat: booking.latitude,
        lng: booking.longitude,
        name: customer.fullName || 'Customer Location',
        address: booking.address || undefined,
        timestamp: new Date(),
      },
      partnerLocation: {
        lat: helper.profile.latitude,
        lng: helper.profile.longitude,
        name: helper.user?.fullName || 'Partner Location',
        address: booking.address || undefined,
        timestamp: new Date(),
      },
    };

    return route;
  } catch (error) {
    logger.error(`Error getting real-time route: ${error}`);
    throw error;
  }
};

/**
 * Get location history for a booking (for tracking path)
 * NOTE: LocationHistory table not in current schema - returns empty array
 */
export const getLocationHistory = async (
  userId: string,
  hours: number = 1
): Promise<
  Array<{
    lat: number;
    lng: number;
    timestamp: Date;
  }>
> => {
  try {
    // LocationHistory model not available in current schema
    // Returns empty array - can be implemented with separate table in future
    return [];
  } catch (error) {
    logger.error(`Error getting location history: ${error}`);
    throw error;
  }
};

/**
 * Get current locations of both user and partner
 */
export const getCurrentLocationsPair = async (
  bookingId: string
): Promise<{
  userLocation: { lat: number; lng: number; name: string } | null;
  partnerLocation: { lat: number; lng: number; name: string } | null;
} | null> => {
  try {
    const bookingIdNum = parseInt(bookingId, 10);
    const booking = await prisma.booking.findUnique({
      where: { id: bookingIdNum },
      include: {
        customer: true,
      },
    });

    if (!booking) {
      return null;
    }

    // Fetch helper with profile if assigned
    const helper = booking.helperId ? await prisma.helper.findUnique({
      where: { id: booking.helperId },
      include: { profile: true, user: { select: { fullName: true } } },
    }) : null;

    return {
      userLocation: booking.latitude && booking.longitude
        ? {
            lat: booking.latitude,
            lng: booking.longitude,
            name: booking.customer?.fullName || 'Booking Location',
          }
        : null,
      partnerLocation: helper?.profile?.latitude && helper.profile.longitude
        ? {
            lat: helper.profile.latitude,
            lng: helper.profile.longitude,
            name: helper.user?.fullName || 'Helper',
          }
        : null,
    };
  } catch (error) {
    logger.error(`Error getting current locations: ${error}`);
    throw error;
  }
};

/**
 * Format location data for Google Maps API consumption
 */
export const formatForGoogleMaps = (route: GoogleMapsRoute): object => {
  return {
    origin: {
      lat: route.origin.lat,
      lng: route.origin.lng,
    },
    destination: {
      lat: route.destination.lat,
      lng: route.destination.lng,
    },
    waypoints: [
      {
        location: {
          lat: route.userLocation.lat,
          lng: route.userLocation.lng,
        },
        stopover: true,
      },
      {
        location: {
          lat: route.partnerLocation.lat,
          lng: route.partnerLocation.lng,
        },
        stopover: true,
      },
    ],
    travelMode: 'DRIVING', // Can be DRIVING, WALKING, BICYCLING, TRANSIT
  };
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Check if partner is within acceptable distance range
 */
export const isPartnerInRange = (
  customerLat: number,
  customerLng: number,
  partnerLat: number,
  partnerLng: number,
  maxDistanceKm: number = 10
): boolean => {
  const distance = calculateDistance(customerLat, customerLng, partnerLat, partnerLng);
  return distance <= maxDistanceKm;
};

/**
 * Upsert the dedicated HelperLocation row with the latest known position.
 * Called automatically by updateLocation; can also be called directly for
 * higher-frequency updates (e.g. from socket events).
 */
export const updateHelperLocation = async (
  helperId: number,
  latitude: number,
  longitude: number,
  opts?: { heading?: number; accuracy?: number; speed?: number }
): Promise<void> => {
  await prisma.helperLocation.upsert({
    where:  { helperId },
    update: { latitude, longitude, ...opts },
    create: { helperId, latitude, longitude, ...opts },
  });
  logger.info('updateHelperLocation: upserted', { helperId, latitude, longitude });
};

/**
 * Fetch the latest HelperLocation row for the helper assigned to a booking.
 * Returns null when no helper is assigned or no location row exists yet.
 */
export const getHelperLiveLocation = async (
  bookingId: number
): Promise<{ helperId: number; latitude: number; longitude: number; updatedAt: Date } | null> => {
  const booking = await prisma.booking.findUnique({
    where:  { id: bookingId },
    select: { helperId: true },
  });

  if (!booking?.helperId) return null;

  const loc = await prisma.helperLocation.findUnique({
    where:  { helperId: booking.helperId },
    select: { helperId: true, latitude: true, longitude: true, updatedAt: true },
  });

  return loc;
};
