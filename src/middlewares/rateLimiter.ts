import { Request, Response, NextFunction } from 'express';
import { getRedis } from '../services/redis.service';
import logger from '../utils/logger';

const memoryStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  message: string;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

export const createRateLimiter = (options: RateLimiterOptions) => {
  const { windowMs, maxRequests, message, keyGenerator } = options;

  const middleware: any = async (req: Request, res: Response, next: NextFunction) => {
    const id = keyGenerator ? keyGenerator(req) : getClientId(req);
    const key = `rate-limit:${id}`;

    try {
      const redis = await getRedis();

      if (redis) {
        const current = await redis.incr(key);
        
        if (current === 1) {
          await redis.expire(key, Math.ceil(windowMs / 1000));
        }

        if (current > maxRequests) {
          const ttl = await redis.ttl(key);
          res.setHeader('Retry-After', Math.max(ttl, 1));
          res.setHeader('X-RateLimit-Limit', maxRequests.toString());
          res.setHeader('X-RateLimit-Remaining', '0');

          logger.warn('Rate limit exceeded', {
            requestId: req.id,
            path: req.path,
            client: id,
            limit: maxRequests,
            windowMs,
          });

          return res.status(429).json({
            success: false,
            code: 'RATE_LIMIT_EXCEEDED',
            message,
            retryAfter: Math.max(ttl, 1),
            requestId: req.id,
          });
        }

        res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', (maxRequests - current).toString());
      } else {
        const now = Date.now();
        let record = memoryStore.get(id);
        let currentCount = 1;

        if (!record || now > record.resetTime) {
          memoryStore.set(id, { count: 1, resetTime: now + windowMs });
          currentCount = 1;
        } else {
          record.count++;
          currentCount = record.count;
          if (currentCount > maxRequests) {
            logger.warn('Rate limit exceeded (fallback)', {
              requestId: req.id,
              path: req.path,
              client: id,
            });

            return res.status(429).json({
              success: false,
              code: 'RATE_LIMIT_EXCEEDED',
              message,
              retryAfter: Math.ceil((record.resetTime - now) / 1000),
              requestId: req.id,
            });
          }
        }

        res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', (maxRequests - currentCount).toString());
      }

      return next();
    } catch (error) {
      logger.error('Rate limiter error:', error);
      return next();
    }
  };

  return middleware;
};

const getClientId = (req: Request): string => {
  const user = (req as any).user;
  if (user?.userId) {
    return `user:${user.userId}`;
  }

  return (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
         req.ip ||
         req.socket.remoteAddress ||
         'unknown';
};

export const generalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
  message: 'Too many requests from this client, please try again later.',
});

export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  message: 'Too many authentication attempts, please try again later.',
});

export const otpLimiter = createRateLimiter({
  windowMs: 30 * 60 * 1000,
  maxRequests: 3,
  message: 'Too many OTP requests, please try again later.',
});

const isDev = process.env.NODE_ENV === 'development';
console.log('Login rate limiter active:', isDev ? 'DEV (unlimited)' : 'PROD (restricted)');

export const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: isDev ? 100000 : 5,
  message: 'Too many login attempts, please try again later.',
  keyGenerator: (req) => req.body?.phone || req.ip || 'unknown',
});

export const passwordResetLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 3,
  message: 'Too many password reset attempts, please try again later.',
});

export const refreshTokenLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 10,
  message: 'Too many token refresh attempts.',
});

export const signupLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000,
  maxRequests: 5,
  message: 'Too many signup attempts from this IP, please try again later.',
});

export const panVerificationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 5,
  message: 'Too many PAN verification attempts, please try again later.',
});

export const bookingLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 20,
  message: 'Too many booking requests, please try again later.',
});

/**
 * Per-phone OTP limiter — keyed on req.body.phone.
 * Blocks a specific phone number from requesting too many OTPs.
 * Complement to the IP-based otpLimiter.
 */
export const otpPhoneLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5,
  message: 'Too many OTP requests for this number, please try again later.',
  keyGenerator: (req: Request) => `phone:${(req.body?.phone ?? 'unknown').replace(/[^0-9]/g, '')}`,
});

/**
 * Combined IP + phone limiter for OTP/login endpoints.
 * Requires both vectors to be within limits.
 */
export const otpCombinedLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: 'Too many OTP requests, please try again later.',
  keyGenerator: (req: Request) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ?? req.ip ?? 'unknown';
    const phone = (req.body?.phone ?? '').replace(/[^0-9]/g, '') || 'unknown';
    return `ip-phone:${ip}:${phone}`;
  },
});

export const rateLimiter = generalLimiter;
