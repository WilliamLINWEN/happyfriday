"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
exports.notFoundHandler = notFoundHandler;
const error_handler_1 = require("../utils/error-handler");
const response_formatter_1 = require("../utils/response-formatter");
function errorHandler(error, req, res, next) {
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
    if (error instanceof error_handler_1.AppError) {
        statusCode = error.statusCode;
        message = error.message;
    }
    else if (error.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation failed';
    }
    else if (error.name === 'UnauthorizedError') {
        statusCode = 401;
        message = 'Unauthorized';
    }
    else if (!(0, error_handler_1.isOperationalError)(error)) {
        // Don't expose internal error details to client
        message = 'Something went wrong. Please try again later.';
    }
    const response = (0, response_formatter_1.formatErrorResponse)(message);
    res.status(statusCode).json(response);
}
function notFoundHandler(req, res, next) {
    const error = new error_handler_1.AppError(`Route ${req.originalUrl} not found`, 404);
    next(error);
}
