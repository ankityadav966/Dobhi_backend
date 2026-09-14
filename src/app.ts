import express, { Express } from 'express';
import cors from 'cors';
// NOTE: compression and hpp should be installed with: npm install compression hpp
// import compression from 'compression';
// import hpp from 'hpp';
import { 
  securityHeaders, 
  requestIdMiddleware, 
  corsOptions,
  requestSizeLimiter,
  preventMimeSniffing,
  xssProtection,
  secureRequestLogger,
} from './middlewares/security.middleware';
import { generalLimiter } from './middlewares/rateLimiter';
import { errorHandler } from './middlewares/error.middleware';
import logger from './utils/logger';

// Routes - Modules
import userModule from './modules/user';
import partnerModule from './modules/partner';
import helperModule from './modules/helper';
import adminModule from './modules/admin';
import notificationRoutes from './modules/notifications/notification.routes';

// Firebase (push notifications)
import { initializeFirebase } from './services/firebase.service';
initializeFirebase();

// Routes - Auth
import authRoutes from './auth/auth.routes';

// Routes - Support
import supportRoutes from './modules/support/support.routes';

// Routes - Core (shared across roles)
// Note: booking routes now live in role modules:
//   /api/user/bookings    → modules/user/user-booking.routes.ts
//   /api/partner/bookings → modules/partner/partner-booking.routes.ts
import bookingRequestRoutes from './core/booking-request.routes';
import paymentRoutes from './core/payment.routes';
import ratingRoutes from './core/rating.routes';
import serviceRoutes from './core/service.routes';
import razorpayRoutes from './core/razorpay.routes';
import razorpayxRoutes from './webhooks/razorpayx.routes';
import debugS3Routes from './routes/debug-s3.routes'; // dev-only, guarded below
import kiranaAdminRoutes from './modules/kirana/kirana.admin.routes';
import { categoryRouter as kiranaCategoryRoutes, inventoryRouter as kiranaInventoryRoutes } from './modules/kirana/kirana.catalog.admin.routes';
import publicStoreRoutes from './modules/public-store/public-store.routes';
import uploadRoutes from './routes/upload.routes';
import sellerAuthRoutes from './modules/seller/seller-auth.routes';
import sellerWorkerRoutes from './modules/seller/seller-worker.routes';
import workerAuthRoutes from './modules/worker/worker-auth.routes';
import workerDeliveryRoutes from './modules/worker/worker-delivery.routes';
import adminCategoryRoutes from './modules/admin/admin-category.routes';

export const createApp = (): Express => {
  const app = express();

  // ============ SECURITY & TRUST SETUP ============

  app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : 0);
  
  // ============ EARLY MIDDLEWARE (before body parsers) ============

  // Request ID tracking
  app.use(requestIdMiddleware);

  // Security headers with Helmet
  app.use(securityHeaders);

  // Compression for response bodies (requires: npm install compression)
  // app.use(compression({ level: process.env.NODE_ENV === 'production' ? 6 : 3 }));

  // CORS security
  app.use(cors(corsOptions));

  // Request size limiting
  app.use(requestSizeLimiter);

  // Raw body middleware ONLY for webhook route (must be before JSON parser)
  app.use('/webhook/razorpay', express.raw({ type: 'application/json', limit: '10mb' }), (req, _res, next) => {
    (req as any).rawBody = req.body;
    next();
  });

  // Raw body middleware for RazorpayX payout webhook (must be before JSON parser)
  app.use('/webhook/razorpayx', express.raw({ type: 'application/json', limit: '1mb' }));

  // ============ BODY PARSERS ============

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ============ SECURITY & VALIDATION MIDDLEWARE ============

  // Additional security headers
  app.use(preventMimeSniffing);
  app.use(xssProtection);

  // HTTP Parameter Pollution prevention (requires: npm install hpp)
  // app.use(hpp({
  //   whitelist: [
  //     'sort',
  //     'filter',
  //     'page',
  //     'limit',
  //     'search',
  //     'latitude',
  //     'longitude',
  //   ],
  // }));

  // XSS sanitization for NoSQL injection
  // Note: Input validation is handled per-route with express-validator

  // ============ LOGGING & RATE LIMITING ============

  // Request logging (skips health checks)
  app.use(secureRequestLogger);

  // Rate limiting for general endpoints
  //app.use(generalLimiter);

  // ============ HEALTH CHECK & ROOT ============

  app.get('/', (_req, res) => {
    res.json({ 
      success: true, 
      message: 'Dobhi Partner Backend API is running',
      version: '1.0.0',
      adminFrontend: 'http://localhost:3000',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health', (_req, res) => {
    res.json({ 
      success: true, 
      message: 'Server is running',
      timestamp: new Date().toISOString(),
    });
  });

  // ============ API ROUTES ============

  // Webhook routes - raw body middleware applied above
  app.use('/webhook', razorpayRoutes);
  app.use('/webhook/razorpayx', razorpayxRoutes);

  // API routes with authentication and rate limiting
  app.use('/api/auth', authRoutes);

  // ── Modular feature routes ────────────────────────────────────────────────
  app.use('/api/user', userModule);        // Customer features
  app.use('/api/partner', partnerModule);  // Partner features
  app.use('/api/helper', helperModule);    // Helper earnings & bank details
  app.use('/api/admin', adminModule);      // Admin features
  app.use('/api/support', supportRoutes);  // Support tickets
  app.use('/api/notifications', notificationRoutes); // Push notification device registration

  // ── Shared / cross-role routes ────────────────────────────────────────────
  // Booking routes are served via role modules:
  //   GET/POST /api/user/bookings/*    → userModule → user-booking.routes.ts
  //   GET      /api/partner/bookings/* → partnerModule → partner-booking.routes.ts
  app.use('/api/booking-requests', bookingRequestRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/ratings', ratingRoutes);
  app.use('/api/services', serviceRoutes);

  // ── Kirana & Marketplace Admin ─────────────────────────────────────────────
  app.use('/api/admin/kirana', kiranaAdminRoutes);
  app.use('/api/admin/kirana-category', kiranaCategoryRoutes);
  app.use('/api/admin/kirana-inventory', kiranaInventoryRoutes);

  // ── File & Image Upload Routes (AWS S3) ───────────────────────────────────
  app.use('/api/upload', uploadRoutes);
  app.use('/api/admin/upload', uploadRoutes);

  // ── Seller Portal Routes ──────────────────────────────────────────────────
  app.use('/api/seller/auth', sellerAuthRoutes);
  app.use('/api/v1/seller/auth', sellerAuthRoutes);
  app.use('/api/seller/workers', sellerWorkerRoutes);
  app.use('/api/v1/seller/workers', sellerWorkerRoutes);

  // ── Worker Portal Routes ──────────────────────────────────────────────────
  app.use('/api/worker/auth', workerAuthRoutes);
  app.use('/api/v1/worker/auth', workerAuthRoutes);
  app.use('/api/worker', workerDeliveryRoutes);
  app.use('/api/v1/worker', workerDeliveryRoutes);

  // ── Dynamic Platform Categories (Public Access) ───────────────────────────
  app.use('/api/categories', adminCategoryRoutes);
  app.use('/api/v1/categories', adminCategoryRoutes);

  // ── Public Marketplace & Client Store APIs (for GROCERYLAUNDRY website) ─────
  app.use('/api/v1', publicStoreRoutes);
  app.use('/api', publicStoreRoutes);

  // ── Development diagnostics (never active in production) ──────────────────
  if (process.env.NODE_ENV !== 'production') {
    app.use('/debug-s3', debugS3Routes);
    logger.info('DEV: /debug-s3 route enabled');
  }

  // ============ 404 HANDLER ============

  app.use((req, res) => {
    logger.warn('Route not found', {
      requestId: req.id,
      method: req.method,
      path: req.path,
    });
    
    res.status(404).json({
      success: false,
      code: 'NOT_FOUND',
      message: 'Route not found',
      path: req.path,
      requestId: req.id,
    });
  });

  // ============ ERROR HANDLER (MUST BE LAST) ============

  app.use(errorHandler);

  return app;
};
