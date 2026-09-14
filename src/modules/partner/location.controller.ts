import { Response } from 'express';
import { prisma } from '../../prisma.client';
import logger from '../../utils/logger';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import * as locationService from '../../services/location.service';

export const updateUserLocation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { latitude, longitude, accuracy } = req.body;

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
    }

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({ success: false, message: 'Latitude and longitude must be numbers' });
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates range' });
    }

    const locationUpdated = await locationService.updateLocation(req.user.userId, {
      userId: req.user.userId,
      latitude,
      longitude,
      accuracy,
      timestamp: new Date(),
    });

    if (!locationUpdated) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Location updated successfully',
      data: { latitude, longitude, accuracy, timestamp: new Date() },
    });
  } catch (error) {
    logger.error(`Error updating location: ${error}`);
    return res.status(500).json({ success: false, message: 'Error updating location', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getRealTimeRoute = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { bookingId } = req.params;
    const bookingIdNum = parseInt(bookingId, 10);
    const currentUserId = parseInt(req.user.userId, 10);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingIdNum },
      include: { customer: true, helper: true },
    });

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const isCustomer = booking.customerId === currentUserId;
    const isHelper = booking.helperId === currentUserId;

    if (!isCustomer && !isHelper) {
      return res.status(403).json({ success: false, message: 'You do not have access to this booking' });
    }

    const route = await locationService.getRealTimeRoute(req.user.userId, bookingId);

    if (!route) {
      return res.status(404).json({ success: false, message: 'Location data not available. Please ensure both parties have shared their location.' });
    }

    const googleMapsFormat = locationService.formatForGoogleMaps(route);
    const userHistory = await locationService.getLocationHistory(req.user.userId, 1);
    const helperHistory = booking.helperId ? await locationService.getLocationHistory(String(booking.helperId), 1) : [];

    const combinedHistory = [...userHistory, ...helperHistory].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return res.status(200).json({
      success: true,
      data: {
        route,
        googleMapsFormat,
        waypoints: combinedHistory,
        bookingStatus: booking.status,
        distance: locationService.calculateDistance(
          route.userLocation.lat,
          route.userLocation.lng,
          route.partnerLocation.lat,
          route.partnerLocation.lng
        ),
      },
    });
  } catch (error) {
    logger.error(`Error getting real-time route: ${error}`);
    return res.status(500).json({ success: false, message: 'Error fetching route', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getCurrentLocations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { bookingId } = req.params;
    const bookingIdNum = parseInt(bookingId, 10);
    const currentUserId = parseInt(req.user.userId, 10);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingIdNum },
      select: { customerId: true, helperId: true },
    });

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const isCustomer = booking.customerId === currentUserId;
    const isHelper   = booking.helperId   === currentUserId;

    if (!isCustomer && !isHelper) {
      return res.status(403).json({ success: false, message: 'You do not have access to this booking' });
    }

    const helperLoc = await locationService.getHelperLiveLocation(bookingIdNum);

    if (!helperLoc) {
      return res.status(404).json({ success: false, message: 'Helper location not available yet' });
    }

    return res.status(200).json({
      success: true,
      data: {
        helperId:  helperLoc.helperId,
        latitude:  helperLoc.latitude,
        longitude: helperLoc.longitude,
        updatedAt: helperLoc.updatedAt,
      },
    });
  } catch (error) {
    logger.error(`Error getting current locations: ${error}`);
    return res.status(500).json({ success: false, message: 'Error fetching locations', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const getLocationHistory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { userId } = req.params;
    const hours = parseInt(req.query.hours as string) || 1;

    if (userId !== req.user.userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'You can only view your own location history' });
    }

    const history = await locationService.getLocationHistory(userId, hours);

    return res.status(200).json({ success: true, data: history, hours, count: history.length });
  } catch (error) {
    logger.error(`Error getting location history: ${error}`);
    return res.status(500).json({ success: false, message: 'Error fetching location history', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const checkPartnerInRange = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { bookingId } = req.params;
    const bookingIdNum = parseInt(bookingId, 10);
    const currentUserId = parseInt(req.user.userId, 10);
    const maxDistance = parseInt(req.query.maxDistance as string) || 10;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingIdNum },
      include: {
        helper: { include: { profile: true } },
      },
    });

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const isHelper = booking.helperId === currentUserId;

    if (!isHelper) {
      return res.status(403).json({ success: false, message: 'You do not have access to this booking' });
    }

    const helper = booking.helper;
    const helperLat = helper?.profile?.latitude;
    const helperLng = helper?.profile?.longitude;

    if (!booking.latitude || !booking.longitude || !helper || !helperLat || !helperLng) {
      return res.status(400).json({ success: false, message: 'Location data not available' });
    }

    const distance = locationService.calculateDistance(booking.latitude, booking.longitude, helperLat, helperLng);
    const isInRange = locationService.isPartnerInRange(booking.latitude, booking.longitude, helperLat, helperLng, maxDistance);

    return res.status(200).json({
      success: true,
      data: { isInRange, distance: parseFloat(distance.toFixed(2)), maxDistance, unit: 'km' },
    });
  } catch (error) {
    logger.error(`Error checking partner range: ${error}`);
    return res.status(500).json({ success: false, message: 'Error checking partner range', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};

export const streamLocationUpdates = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { bookingId } = req.params;
    const bookingIdNum = parseInt(bookingId, 10);
    const currentUserId = parseInt(req.user.userId, 10);

    const booking = await prisma.booking.findUnique({
      where: { id: bookingIdNum },
      select: { customerId: true, helperId: true },
    });

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const isCustomer = booking.customerId === currentUserId;
    const isHelper = booking.helperId === currentUserId;

    if (!isCustomer && !isHelper) {
      return res.status(403).json({ success: false, message: 'You do not have access to this booking' });
    }

    const locations = await locationService.getCurrentLocationsPair(bookingId);

    if (!locations) return res.status(404).json({ success: false, message: 'Booking not found' });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');

    return res.status(200).json({ success: true, timestamp: new Date(), data: locations });
  } catch (error) {
    logger.error(`Error streaming location: ${error}`);
    return res.status(500).json({ success: false, message: 'Error streaming location data', error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
