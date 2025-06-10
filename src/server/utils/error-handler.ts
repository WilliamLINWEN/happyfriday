// Error handling utilities
import { logError, logWarn, logInfo } from './logger';

export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  EXTERNAL_API = 'external_api',
  DATABASE = 'database',
  RATE_LIMIT = 'rate_limit',
  SECURITY = 'security',
  SYSTEM = 'system',
  UNKNOWN = 'unknown'
}

export interface ErrorMetadata {
  requestId?: string;
  userId?: string;
  action?: string;
  details?: Record<string, any>;
  category?: ErrorCategory;
  retryable?: boolean;
}

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public category: ErrorCategory;
  public metadata: ErrorMetadata;
  public timestamp: Date;
  public retryable: boolean;

  constructor(
    message: string, 
    statusCode: number = 500, 
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    isOperational: boolean = true,
    metadata: ErrorMetadata = {}
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.category = category;
    this.metadata = metadata;
    this.timestamp = new Date();
    this.retryable = metadata.retryable ?? false;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      message: this.message,
      statusCode: this.statusCode,
      category: this.category,
      timestamp: this.timestamp.toISOString(),
      retryable: this.retryable,
      metadata: this.metadata
    };
  }
}

export function createValidationError(message: string, details?: Record<string, any>): AppError {
  return new AppError(
    message, 
    400, 
    ErrorCategory.VALIDATION, 
    true, 
    { details, retryable: false }
  );
}

export function createNotFoundError(resource: string, requestId?: string): AppError {
  return new AppError(
    `${resource} not found`, 
    404, 
    ErrorCategory.SYSTEM, 
    true, 
    { requestId, retryable: false }
  );
}

export function createInternalServerError(message: string = 'Internal server error', metadata?: ErrorMetadata): AppError {
  return new AppError(
    message, 
    500, 
    ErrorCategory.SYSTEM, 
    true, 
    { ...metadata, retryable: true }
  );
}

export function createServiceUnavailableError(service: string, retryable: boolean = true): AppError {
  return new AppError(
    `${service} service is currently unavailable`, 
    503, 
    ErrorCategory.EXTERNAL_API, 
    true, 
    { retryable, details: { service } }
  );
}

export function createRateLimitError(retryAfter?: number): AppError {
  return new AppError(
    'Rate limit exceeded', 
    429, 
    ErrorCategory.RATE_LIMIT, 
    true, 
    { retryable: true, details: { retryAfter } }
  );
}

export function createSecurityError(message: string, details?: Record<string, any>): AppError {
  return new AppError(
    message, 
    403, 
    ErrorCategory.SECURITY, 
    true, 
    { details, retryable: false }
  );
}

export function createExternalApiError(service: string, originalError?: Error, retryable: boolean = true): AppError {
  return new AppError(
    `External API error from ${service}`, 
    502, 
    ErrorCategory.EXTERNAL_API, 
    true, 
    { 
      retryable, 
      details: { 
        service, 
        originalError: originalError?.message 
      } 
    }
  );
}

export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

export function logAppError(error: AppError, context?: string): void {
  const errorInfo = {
    message: error.message,
    statusCode: error.statusCode,
    category: error.category,
    timestamp: error.timestamp.toISOString(),
    stack: error.stack,
    metadata: error.metadata,
    context
  };

  if (error.statusCode >= 500) {
    logError('Application Error', errorInfo);
  } else if (error.statusCode >= 400) {
    logWarn('Client Error', errorInfo);
  } else {
    logInfo('Application Event', errorInfo);
  }
}

export interface ErrorMetrics {
  category: ErrorCategory;
  count: number;
  lastOccurred: Date;
  statusCode: number;
}

class ErrorTracker {
  private errors: Map<string, ErrorMetrics> = new Map();

  track(error: AppError): void {
    const key = `${error.category}_${error.statusCode}`;
    const existing = this.errors.get(key);

    if (existing) {
      existing.count++;
      existing.lastOccurred = new Date();
    } else {
      this.errors.set(key, {
        category: error.category,
        count: 1,
        lastOccurred: new Date(),
        statusCode: error.statusCode
      });
    }
  }

  getMetrics(): ErrorMetrics[] {
    return Array.from(this.errors.values());
  }

  getMetricsByCategory(category: ErrorCategory): ErrorMetrics[] {
    return this.getMetrics().filter(metric => metric.category === category);
  }

  reset(): void {
    this.errors.clear();
  }
}

export const errorTracker = new ErrorTracker();
