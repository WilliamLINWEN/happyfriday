// Error handling utilities
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export function createValidationError(message: string): AppError {
  return new AppError(message, 400);
}

export function createNotFoundError(resource: string): AppError {
  return new AppError(`${resource} not found`, 404);
}

export function createInternalServerError(message: string = 'Internal server error'): AppError {
  return new AppError(message, 500);
}

export function createServiceUnavailableError(service: string): AppError {
  return new AppError(`${service} service is currently unavailable`, 503);
}

export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}
