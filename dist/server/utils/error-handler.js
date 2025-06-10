"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorTracker = exports.AppError = exports.ErrorCategory = void 0;
exports.createValidationError = createValidationError;
exports.createNotFoundError = createNotFoundError;
exports.createInternalServerError = createInternalServerError;
exports.createServiceUnavailableError = createServiceUnavailableError;
exports.createRateLimitError = createRateLimitError;
exports.createSecurityError = createSecurityError;
exports.createExternalApiError = createExternalApiError;
exports.isOperationalError = isOperationalError;
exports.logAppError = logAppError;
// Error handling utilities
const logger_1 = require("./logger");
var ErrorCategory;
(function (ErrorCategory) {
    ErrorCategory["VALIDATION"] = "validation";
    ErrorCategory["AUTHENTICATION"] = "authentication";
    ErrorCategory["AUTHORIZATION"] = "authorization";
    ErrorCategory["EXTERNAL_API"] = "external_api";
    ErrorCategory["DATABASE"] = "database";
    ErrorCategory["RATE_LIMIT"] = "rate_limit";
    ErrorCategory["SECURITY"] = "security";
    ErrorCategory["SYSTEM"] = "system";
    ErrorCategory["UNKNOWN"] = "unknown";
})(ErrorCategory || (exports.ErrorCategory = ErrorCategory = {}));
class AppError extends Error {
    constructor(message, statusCode = 500, category = ErrorCategory.UNKNOWN, isOperational = true, metadata = {}) {
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
exports.AppError = AppError;
function createValidationError(message, details) {
    return new AppError(message, 400, ErrorCategory.VALIDATION, true, { details, retryable: false });
}
function createNotFoundError(resource, requestId) {
    return new AppError(`${resource} not found`, 404, ErrorCategory.SYSTEM, true, { requestId, retryable: false });
}
function createInternalServerError(message = 'Internal server error', metadata) {
    return new AppError(message, 500, ErrorCategory.SYSTEM, true, { ...metadata, retryable: true });
}
function createServiceUnavailableError(service, retryable = true) {
    return new AppError(`${service} service is currently unavailable`, 503, ErrorCategory.EXTERNAL_API, true, { retryable, details: { service } });
}
function createRateLimitError(retryAfter) {
    return new AppError('Rate limit exceeded', 429, ErrorCategory.RATE_LIMIT, true, { retryable: true, details: { retryAfter } });
}
function createSecurityError(message, details) {
    return new AppError(message, 403, ErrorCategory.SECURITY, true, { details, retryable: false });
}
function createExternalApiError(service, originalError, retryable = true) {
    return new AppError(`External API error from ${service}`, 502, ErrorCategory.EXTERNAL_API, true, {
        retryable,
        details: {
            service,
            originalError: originalError?.message
        }
    });
}
function isOperationalError(error) {
    if (error instanceof AppError) {
        return error.isOperational;
    }
    return false;
}
function logAppError(error, context) {
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
        (0, logger_1.logError)('Application Error', errorInfo);
    }
    else if (error.statusCode >= 400) {
        (0, logger_1.logWarn)('Client Error', errorInfo);
    }
    else {
        (0, logger_1.logInfo)('Application Event', errorInfo);
    }
}
class ErrorTracker {
    constructor() {
        this.errors = new Map();
    }
    track(error) {
        const key = `${error.category}_${error.statusCode}`;
        const existing = this.errors.get(key);
        if (existing) {
            existing.count++;
            existing.lastOccurred = new Date();
        }
        else {
            this.errors.set(key, {
                category: error.category,
                count: 1,
                lastOccurred: new Date(),
                statusCode: error.statusCode
            });
        }
    }
    getMetrics() {
        return Array.from(this.errors.values());
    }
    getMetricsByCategory(category) {
        return this.getMetrics().filter(metric => metric.category === category);
    }
    reset() {
        this.errors.clear();
    }
}
exports.errorTracker = new ErrorTracker();
