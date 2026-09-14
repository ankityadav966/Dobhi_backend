/**
 * Simple encryption utility for sensitive data (bank account numbers, etc.)
 * For MVP: Uses Base64 encoding with optional prefix
 * TODO: Replace with proper encryption (AES-256) before production
 */

const ENCRYPTION_KEY_PREFIX = 'enc_';

/**
 * Encrypt sensitive data (placeholder for MVP)
 * In production, use proper encryption like crypto.createCipheriv with AES-256
 */
export const encryptSensitiveData = (data: string): string => {
  try {
    // MVP: Simple Base64 encoding with prefix
    // Production: Use AES-256-GCM with environment variable key
    const encoded = Buffer.from(data).toString('base64');
    return `${ENCRYPTION_KEY_PREFIX}${encoded}`;
  } catch (error) {
    throw new Error('Encryption failed');
  }
};

/**
 * Decrypt sensitive data (placeholder for MVP)
 * In production, use proper decryption with matching key
 */
export const decryptSensitiveData = (encryptedData: string): string => {
  try {
    if (!encryptedData.startsWith(ENCRYPTION_KEY_PREFIX)) {
      throw new Error('Invalid encrypted data format');
    }
    // MVP: Simple Base64 decoding
    const encoded = encryptedData.slice(ENCRYPTION_KEY_PREFIX.length);
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    return decoded;
  } catch (error) {
    throw new Error('Decryption failed');
  }
};

/**
 * Mask sensitive account number for display
 * Shows only last 4 digits: ****1234
 */
export const maskAccountNumber = (accountNumber: string): string => {
  if (!accountNumber || accountNumber.length < 4) {
    return '****';
  }
  const lastFour = accountNumber.slice(-4);
  return `****${lastFour}`;
};
