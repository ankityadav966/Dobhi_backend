import logger from '../utils/logger';

interface BlacklistedToken {
  token: string;
  expiresAt: number;
  revokedAt: number;
}

// In-memory store (use Redis in production)
const tokenBlacklist = new Map<string, BlacklistedToken>();

// Cleanup old tokens (run periodically)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [token, data] of tokenBlacklist.entries()) {
    if (data.expiresAt < now) {
      tokenBlacklist.delete(token);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    logger.info(`Token blacklist cleanup: removed ${cleanedCount} expired tokens`);
  }
}, 60 * 60 * 1000); // Run every hour

/**
 * Add token to blacklist
 */
export const blacklistToken = (token: string, expiresAt: number): void => {
  try {
    tokenBlacklist.set(token, {
      token,
      expiresAt,
      revokedAt: Date.now(),
    });
    
    logger.info(`Token blacklisted`, {
      expiresIn: Math.ceil((expiresAt - Date.now()) / 1000),
    });
  } catch (error) {
    logger.error('Error blacklisting token:', error);
  }
};

/**
 * Check if token is blacklisted
 */
export const isTokenBlacklisted = (token: string): boolean => {
  if (!tokenBlacklist.has(token)) {
    return false;
  }

  const blacklistedData = tokenBlacklist.get(token);
  if (!blacklistedData) {
    return false;
  }

  // Check if token has expired
  if (blacklistedData.expiresAt < Date.now()) {
    tokenBlacklist.delete(token);
    return false;
  }

  return true;
};

/**
 * Remove token from blacklist (if manually reverted)
 */
export const removeFromBlacklist = (token: string): boolean => {
  return tokenBlacklist.delete(token);
};

/**
 * Get blacklist size
 */
export const getBlacklistSize = (): number => {
  return tokenBlacklist.size;
};

/**
 * Clear entire blacklist (use with caution in production)
 */
export const clearBlacklist = (): void => {
  tokenBlacklist.clear();
  logger.warn('Token blacklist cleared');
};

/**
 * Cleanup function to clear old tokens
 */
export const cleanupBlacklistedTokens = (): void => {
  const now = Date.now();
  let removedCount = 0;

  for (const [token, data] of tokenBlacklist.entries()) {
    if (data.expiresAt < now) {
      tokenBlacklist.delete(token);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    logger.debug(`Cleaned up ${removedCount} expired tokens from blacklist`);
  }
};

// Cleanup old tokens every hour
setInterval(cleanupBlacklistedTokens, 60 * 60 * 1000);

// Graceful shutdown
process.on('exit', () => {
  clearInterval(cleanupInterval);
});
