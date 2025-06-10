// Express error handling middleware
import { Request, Response, NextFunction } from 'express';
import { AppError, isOperationalError } from '../utils/error-handler';
import { formatErrorResponse } from '../utils/response-formatter';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  let statusCode = 500;
  let message = 'Internal server error';

  // Log the error for debugging
  console.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
  } else if (!isOperationalError(error)) {
    // Don't expose internal error details to client
    message = 'Something went wrong. Please try again later.';
  }

  const response = formatErrorResponse(message);
  res.status(statusCode).json(response);
}

export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404);
  next(error);
}
