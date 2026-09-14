import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

interface ApiError {
  statusCode?: number;
  code?: string;
  message: string;
  name?: string;
  stack?: string;
}

export const errorHandler = (err: ApiError, req: any, res: Response, _next: NextFunction): void => {
  const requestId = req.id || 'unknown';
  const statusCode = err.statusCode || 500;

  const logContext = {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    error: err.message,
    code: err.code,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  };

  if (statusCode >= 500) {
    logger.error('Server error', logContext);
  } else if (statusCode >= 400) {
    logger.warn('Client error', logContext);
  }

  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  const errorMessage = process.env.NODE_ENV === 'production' && statusCode >= 500
    ? 'An error occurred processing your request'
    : err.message;

  // Standardized error response format
  const response = {
    success: false,
    code: errorCode,
    message: errorMessage,
    requestId,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  };

  // Handle specific error types
  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      errors: (err as any).errors,
      requestId,
    });
    return;
  }

  if (err.name === 'UnauthorizedError') {
    res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
      requestId,
    });
    return;
  }

  if (err.name === 'ForbiddenError') {
    res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      message: 'Access denied',
      requestId,
    });
    return;
  }

  if (err.name === 'NotFoundError') {
    res.status(404).json({
      success: false,
      code: 'NOT_FOUND',
      message: 'Resource not found',
      requestId,
    });
    return;
  }

  res.status(statusCode).json(response);
};

export const requestLogger = (_req: Request, _res: Response, next: NextFunction): void => {
  next();
};
