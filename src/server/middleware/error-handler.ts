// Global error handling middleware
import { Request, Response, NextFunction } from 'express';
import { AppError, isOperationalError, logAppError, errorTracker, ErrorCategory } from '../utils/error-handler';
import { formatErrorResponse } from '../utils/response-formatter';
import { logError, logWarn } from '../utils/logger';

export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    category?: ErrorCategory;
    timestamp: string;
    requestId?: string;
    retryable?: boolean;
    retryAfter?: number;
  };
  details?: Record<string, any>;
}

export function globalErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Generate request ID if not exists
  const requestId = (req as any).requestId || generateRequestId();

  let appError: AppError;

  // Convert unknown errors to AppError
  if (error instanceof AppError) {
    appError = error;
    appError.metadata.requestId = requestId;
  } else {
    // Handle common Node.js errors
    appError = convertToAppError(error, requestId);
  }

  // Track error metrics
  errorTracker.track(appError);

  // Log the error with context
  logAppError(appError, `Request: ${req.method} ${req.url}`);

  // Don't expose sensitive error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  const shouldExposeDetails = isDevelopment || appError.statusCode < 500;

  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      message: shouldExposeDetails ? appError.message : getGenericErrorMessage(appError.statusCode),
      category: appError.category,
      timestamp: appError.timestamp.toISOString(),
      requestId: appError.metadata.requestId,
      retryable: appError.retryable
    }
  };

  // Add retry-after header for rate limiting
  if (appError.category === ErrorCategory.RATE_LIMIT && appError.metadata.details?.retryAfter) {
    res.set('Retry-After', appError.metadata.details.retryAfter.toString());
    errorResponse.error.retryAfter = appError.metadata.details.retryAfter;
  }

  // Add debug details in development
  if (isDevelopment && appError.metadata.details) {
    errorResponse.details = appError.metadata.details;
  }

  // Set security headers for error responses
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  });

  res.status(appError.statusCode).json(errorResponse);
}

export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req as any).requestId || generateRequestId();
  
  const error = new AppError(
    `Route not found: ${req.method} ${req.url}`,
    404,
    ErrorCategory.SYSTEM,
    true,
    { requestId, action: 'route_not_found' }
  );

  next(error);
}

export function asyncErrorHandler<T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<void>
) {
  return (req: T, res: U, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function convertToAppError(error: Error, requestId: string): AppError {
  // Handle specific Node.js errors
  if (error.name === 'ValidationError') {
    return new AppError(
      error.message,
      400,
      ErrorCategory.VALIDATION,
      true,
      { requestId, retryable: false }
    );
  }

  if (error.name === 'CastError') {
    return new AppError(
      'Invalid data format',
      400,
      ErrorCategory.VALIDATION,
      true,
      { requestId, retryable: false }
    );
  }

  if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    return new AppError(
      'Database operation failed',
      500,
      ErrorCategory.DATABASE,
      true,
      { requestId, retryable: true }
    );
  }

  if (error.name === 'TimeoutError') {
    return new AppError(
      'Request timeout',
      408,
      ErrorCategory.EXTERNAL_API,
      true,
      { requestId, retryable: true }
    );
  }

  if (error.name === 'SyntaxError') {
    return new AppError(
      'Invalid JSON in request body',
      400,
      ErrorCategory.VALIDATION,
      true,
      { requestId, retryable: false }
    );
  }

  // Default: treat as internal server error
  return new AppError(
    'An unexpected error occurred',
    500,
    ErrorCategory.SYSTEM,
    true,
    { 
      requestId, 
      retryable: true,
      details: { originalError: error.message, stack: error.stack }
    }
  );
}

function getGenericErrorMessage(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'Bad request';
    case 401:
      return 'Unauthorized';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not found';
    case 429:
      return 'Too many requests';
    case 500:
      return 'Internal server error';
    case 502:
      return 'Bad gateway';
    case 503:
      return 'Service unavailable';
    default:
      return 'An error occurred';
  }
}

function generateRequestId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Middleware to add request ID to all requests
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  (req as any).requestId = generateRequestId();
  res.set('X-Request-ID', (req as any).requestId);
  next();
}

// Graceful shutdown handler
export function handleUncaughtErrors(): void {
  process.on('uncaughtException', (error: Error) => {
    logError('Uncaught Exception', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Give time for cleanup then exit
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logError('Unhandled Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      timestamp: new Date().toISOString()
    });
  });

  // Graceful shutdown on SIGTERM
  process.on('SIGTERM', () => {
    logWarn('SIGTERM received', { timestamp: new Date().toISOString() });
    process.exit(0);
  });

  // Graceful shutdown on SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    logWarn('SIGINT received', { timestamp: new Date().toISOString() });
    process.exit(0);
  });
}
