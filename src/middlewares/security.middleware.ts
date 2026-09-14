import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  req.id = req.headers['x-request-id'] as string || uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
};

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
    },
  },
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

export const trustProxyMiddleware = (_req: Request, _res: Response, next: NextFunction): void => {
  next();
};

export const requestSizeLimiter = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const maxSize = 10 * 1024 * 1024;
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);

  if (contentLength > maxSize) {
    logger.warn('Request size exceeded', { 
      requestId: req.id,
      path: req.path,
      size: contentLength,
    });
    res.status(413).json({
      success: false,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request payload exceeds maximum size limit',
      requestId: req.id,
    });
    return;
  }

  next();
};

const DEV_ORIGINS: readonly string[] = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
];

/**
 * Lazily resolved, cached list of allowed CORS origins.
 * null = not yet resolved. Populated on the first CORS request.
 * Using a cache avoids repeated env reads on every request while
 * still deferring resolution until after process.env is fully loaded.
 */
let _allowedOriginsCache: string[] | null = null;

/**
 * Returns the allowed origin list for the current environment.
 * Always called at request time — never at module load time.
 *
 * Production: reads ALLOWED_ORIGINS (comma-separated). If missing,
 *   logs a clear error and falls back to [] (blocks all cross-origin
 *   requests) instead of crashing the server.
 * Development: returns the hard-coded local origins.
 */
function getAllowedOrigins(): string[] {
  if (_allowedOriginsCache !== null) {
    return _allowedOriginsCache;
  }

  if (process.env.NODE_ENV === 'production') {
    const raw = process.env.ALLOWED_ORIGINS;
    if (!raw || !raw.trim()) {
      logger.error(
        'CORS misconfiguration: ALLOWED_ORIGINS is not set in production. ' +
        'All cross-origin requests will be blocked until this is resolved. ' +
        'Set a comma-separated list of allowed origins, e.g. ' +
        '"https://app.example.com,https://admin.example.com".'
      );
      _allowedOriginsCache = [];
    } else {
      _allowedOriginsCache = raw.split(',').map(o => o.trim()).filter(Boolean);
      logger.info('CORS allowed origins loaded', { origins: _allowedOriginsCache });
    }
  } else {
    _allowedOriginsCache = [...DEV_ORIGINS];
  }

  return _allowedOriginsCache;
}

export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = getAllowedOrigins();
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS origin rejected', {
        origin,
        allowed: allowedOrigins,
      });
      return callback(null, false);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Razorpay-Signature'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After'],
  maxAge: 3600,
};

export const preventMimeSniffing = (_req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
};

export const xssProtection = (_req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
};

export const secureRequestLogger = (req: Request, res: Response, next: NextFunction): void => {
  if (req.path === '/health') {
    return next();
  }

  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const authHeader = req.headers.authorization ? '***MASKED***' : undefined;
    
    const logData = {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 100),
      timestamp: new Date().toISOString(),
      ...(authHeader && { authHeader }),
    };

    if (res.statusCode >= 400) {
      logger.warn('Request completed with error', logData);
    } else if (res.statusCode >= 200 && res.statusCode < 300) {
      logger.debug('Request completed successfully', logData);
    }
  });

  next();
};
