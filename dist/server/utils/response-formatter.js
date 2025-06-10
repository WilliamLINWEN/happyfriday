"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatSuccessResponse = formatSuccessResponse;
exports.formatErrorResponse = formatErrorResponse;
exports.formatValidationErrorResponse = formatValidationErrorResponse;
function formatSuccessResponse(data, message) {
    return {
        success: true,
        data,
        message,
        timestamp: new Date().toISOString()
    };
}
function formatErrorResponse(error, statusCode) {
    return {
        success: false,
        error,
        timestamp: new Date().toISOString()
    };
}
function formatValidationErrorResponse(errors) {
    return {
        success: false,
        error: 'Validation failed',
        data: { validationErrors: errors },
        timestamp: new Date().toISOString()
    };
}
