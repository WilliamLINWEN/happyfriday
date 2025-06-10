"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalErrorHandler = globalErrorHandler;
exports.notFoundHandler = notFoundHandler;
exports.asyncErrorHandler = asyncErrorHandler;
exports.requestIdMiddleware = requestIdMiddleware;
exports.handleUncaughtErrors = handleUncaughtErrors;
const error_handler_1 = require("../utils/error-handler");
const logger_1 = require("../utils/logger");
function globalErrorHandler(error, req, res, next) {
    // Generate request ID if not exists
    const requestId = req.requestId || generateRequestId();
    let appError;
    // Convert unknown errors to AppError
    if (error instanceof error_handler_1.AppError) {
        appError = error;
        appError.metadata.requestId = requestId;
    }
    else {
        // Handle common Node.js errors
        appError = convertToAppError(error, requestId);
    }
    // Track error metrics
    error_handler_1.errorTracker.track(appError);
    // Log the error with context
    (0, error_handler_1.logAppError)(appError, `Request: ${req.method} ${req.url}`);
    // Don't expose sensitive error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    const shouldExposeDetails = isDevelopment || appError.statusCode < 500;
    const errorResponse = {
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
    if (appError.category === error_handler_1.ErrorCategory.RATE_LIMIT && appError.metadata.details?.retryAfter) {
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
function notFoundHandler(req, res, next) {
    const requestId = req.requestId || generateRequestId();
    const error = new error_handler_1.AppError(`Route not found: ${req.method} ${req.url}`, 404, error_handler_1.ErrorCategory.SYSTEM, true, { requestId, action: 'route_not_found' });
    next(error);
}
function asyncErrorHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
function convertToAppError(error, requestId) {
    // Handle specific Node.js errors
    if (error.name === 'ValidationError') {
        return new error_handler_1.AppError(error.message, 400, error_handler_1.ErrorCategory.VALIDATION, true, { requestId, retryable: false });
    }
    if (error.name === 'CastError') {
        return new error_handler_1.AppError('Invalid data format', 400, error_handler_1.ErrorCategory.VALIDATION, true, { requestId, retryable: false });
    }
    if (error.name === 'MongoError' || error.name === 'MongoServerError') {
        return new error_handler_1.AppError('Database operation failed', 500, error_handler_1.ErrorCategory.DATABASE, true, { requestId, retryable: true });
    }
    if (error.name === 'TimeoutError') {
        return new error_handler_1.AppError('Request timeout', 408, error_handler_1.ErrorCategory.EXTERNAL_API, true, { requestId, retryable: true });
    }
    if (error.name === 'SyntaxError') {
        return new error_handler_1.AppError('Invalid JSON in request body', 400, error_handler_1.ErrorCategory.VALIDATION, true, { requestId, retryable: false });
    }
    // Default: treat as internal server error
    return new error_handler_1.AppError('An unexpected error occurred', 500, error_handler_1.ErrorCategory.SYSTEM, true, {
        requestId,
        retryable: true,
        details: { originalError: error.message, stack: error.stack }
    });
}
function getGenericErrorMessage(statusCode) {
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
function generateRequestId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
// Middleware to add request ID to all requests
function requestIdMiddleware(req, res, next) {
    req.requestId = generateRequestId();
    res.set('X-Request-ID', req.requestId);
    next();
}
// Graceful shutdown handler
function handleUncaughtErrors() {
    process.on('uncaughtException', (error) => {
        (0, logger_1.logError)('Uncaught Exception', {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
        // Give time for cleanup then exit
        setTimeout(() => {
            process.exit(1);
        }, 1000);
    });
    process.on('unhandledRejection', (reason, promise) => {
        (0, logger_1.logError)('Unhandled Rejection', {
            reason: reason?.message || reason,
            stack: reason?.stack,
            timestamp: new Date().toISOString()
        });
    });
    // Graceful shutdown on SIGTERM
    process.on('SIGTERM', () => {
        (0, logger_1.logWarn)('SIGTERM received', { timestamp: new Date().toISOString() });
        process.exit(0);
    });
    // Graceful shutdown on SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
        (0, logger_1.logWarn)('SIGINT received', { timestamp: new Date().toISOString() });
        process.exit(0);
    });
}
