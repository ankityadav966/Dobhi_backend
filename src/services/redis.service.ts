/**
 * Shared Redis client singleton.
 *
 * Usage:
 *   import { getRedis } from './redis.service';
 *   const redis = await getRedis();
 *   if (redis) { ... } // always guard — Redis may be unavailable
 *
 * Design notes:
 * - Password is read from REDIS_PASSWORD or parsed from REDIS_URL.
 * - A single connection is shared across all services (rate limiter, OTP, etc).
 * - The server never crashes if Redis is down — all callers receive null.
 * - Reconnection is attempted automatically by the redis client.
 */

import { createClient } from 'redis';
import logger from '../utils/logger';

type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;
let connecting = false;
let connectPromise: Promise<RedisClient | null> | null = null;

function buildRedisConfig(): Parameters<typeof createClient>[0] {
  const url = process.env.REDIS_URL || `redis://localhost:6379`;
  const password = process.env.REDIS_PASSWORD;

  const cfg: Parameters<typeof createClient>[0] = { url };

  if (password) {
    cfg.password = password;
  }

  return cfg;
}

async function connect(): Promise<RedisClient | null> {
  if (connecting) return connectPromise;

  connecting = true;
  connectPromise = (async () => {
    try {
      const cfg = buildRedisConfig();
      const c = createClient(cfg);

      c.on('error', (err) => {
        logger.error('Redis client error', { error: err.message });
        // Do NOT assign null here — redis client manages reconnection internally.
      });

      c.on('reconnecting', () => {
        logger.info('Redis reconnecting...');
      });

      c.on('ready', () => {
        logger.info('Redis connection ready');
      });

      await c.connect();
      logger.info('Redis connected');
      client = c;
      return c;
    } catch (err: any) {
      logger.warn('Redis unavailable — continuing without Redis', { error: err.message });
      client = null;
      connecting = false;
      connectPromise = null;
      return null;
    }
  })();

  return connectPromise;
}

/**
 * Returns the shared Redis client, or null if Redis is not available.
 * Never throws. Always guard the return value before use.
 */
export async function getRedis(): Promise<RedisClient | null> {
  if (client?.isReady) return client;
  return connect();
}

/**
 * Gracefully disconnect on process exit.
 */
process.on('exit', () => {
  if (client) {
    client.quit().catch(() => {});
  }
});
