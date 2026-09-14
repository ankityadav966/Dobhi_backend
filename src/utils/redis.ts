import logger from "./logger";

const memoryStore = new Map<string, string>();

export const setRedisKey = async (
  key: string,
  value: string,
  ttl?: number
): Promise<void> => {
  memoryStore.set(key, value);
  logger.info(`[DEV CACHE] Set ${key} = ${value}`);

  if (ttl) {
    setTimeout(() => {
      memoryStore.delete(key);
      logger.info(`[DEV CACHE] Expired ${key}`);
    }, ttl * 1000);
  }
};

export const getRedisKey = async (key: string): Promise<string | null> => {
  const value = memoryStore.get(key) || null;
  logger.info(`[DEV CACHE] Get ${key} -> ${value}`);
  return value;
};

export const deleteRedisKey = async (key: string): Promise<void> => {
  memoryStore.delete(key);
  logger.info(`[DEV CACHE] Delete ${key}`);
};