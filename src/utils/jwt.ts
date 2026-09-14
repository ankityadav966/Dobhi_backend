import { sign, verify, decode, SignOptions } from 'jsonwebtoken';
import { config } from '../config/index';

export interface TokenPayload {
  userId: string;
  phone: string;
  /**
   * Must match a UserRole enum value (CUSTOMER | HELPER | ADMIN).
   * Always derived from User.role in the DB — never computed at runtime.
   * Typed as string for JWT serialisation compatibility.
   */
  role: string;
  /**
   * Present for HELPER tokens. Used in partner APIs.
   */
  helperId?: number;
  sellerId?: number;
  workerId?: string;
  email?: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: config.jwt.expire as any,
  };
  return sign(payload, config.jwt.secret as string, options);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  const options: SignOptions = {
    expiresIn: config.jwt.refreshExpire as any,
  };
  return sign(payload, config.jwt.refreshSecret as string, options);
};

export const verifyAccessToken = (token: string): TokenPayload | null => {
  try {
    return verify(token, config.jwt.secret) as TokenPayload;
  } catch (error) {
    return null;
  }
};

export const verifyRefreshToken = (token: string): TokenPayload | null => {
  try {
    return verify(token, config.jwt.refreshSecret) as TokenPayload;
  } catch (error) {
    return null;
  }
};

export const decodeToken = (token: string): any => {
  return decode(token);
};
