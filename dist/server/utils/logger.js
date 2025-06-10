"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = void 0;
exports.logError = logError;
exports.logWarn = logWarn;
exports.logInfo = logInfo;
exports.logDebug = logDebug;
exports.logRequest = logRequest;
// Logging utility
var LogLevel;
(function (LogLevel) {
    LogLevel["ERROR"] = "error";
    LogLevel["WARN"] = "warn";
    LogLevel["INFO"] = "info";
    LogLevel["DEBUG"] = "debug";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
function formatLogEntry(level, message, metadata) {
    return {
        level,
        message,
        timestamp: new Date().toISOString(),
        metadata
    };
}
function logError(message, error) {
    const entry = formatLogEntry(LogLevel.ERROR, message, {
        error: error?.message,
        stack: error?.stack
    });
    console.error(JSON.stringify(entry));
}
function logWarn(message, metadata) {
    const entry = formatLogEntry(LogLevel.WARN, message, metadata);
    console.warn(JSON.stringify(entry));
}
function logInfo(message, metadata) {
    const entry = formatLogEntry(LogLevel.INFO, message, metadata);
    console.log(JSON.stringify(entry));
}
function logDebug(message, metadata) {
    if (process.env.NODE_ENV === 'development') {
        const entry = formatLogEntry(LogLevel.DEBUG, message, metadata);
        console.debug(JSON.stringify(entry));
    }
}
function logRequest(req) {
    logInfo('Request received', {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip
    });
}
