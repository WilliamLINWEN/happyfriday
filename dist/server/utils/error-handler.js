"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.createValidationError = createValidationError;
exports.createNotFoundError = createNotFoundError;
exports.createInternalServerError = createInternalServerError;
exports.createServiceUnavailableError = createServiceUnavailableError;
exports.isOperationalError = isOperationalError;
// Error handling utilities
class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
function createValidationError(message) {
    return new AppError(message, 400);
}
function createNotFoundError(resource) {
    return new AppError(`${resource} not found`, 404);
}
function createInternalServerError(message = 'Internal server error') {
    return new AppError(message, 500);
}
function createServiceUnavailableError(service) {
    return new AppError(`${service} service is currently unavailable`, 503);
}
function isOperationalError(error) {
    if (error instanceof AppError) {
        return error.isOperational;
    }
    return false;
}
