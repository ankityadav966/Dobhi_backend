import { Request } from 'express';

/**
 * Extend Express Request type to include custom properties
 */
declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export {};
