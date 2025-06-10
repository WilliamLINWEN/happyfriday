"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
exports.createGeneralRateLimit = createGeneralRateLimit;
exports.createAPIRateLimit = createAPIRateLimit;
exports.createStrictRateLimit = createStrictRateLimit;
const response_formatter_1 = require("../utils/response-formatter");
const logger_1 = require("../utils/logger");
class RateLimiter {
    constructor(options) {
        this.store = {};
        this.options = {
            windowMs: options.windowMs,
            max: options.max,
            skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
            skipFailedRequests: options.skipFailedRequests ?? false,
            keyGenerator: options.keyGenerator ?? ((req) => req.ip || 'unknown'),
            message: options.message ?? 'Too many requests, please try again later.',
            standardHeaders: options.standardHeaders ?? true,
            legacyHeaders: options.legacyHeaders ?? false
        };
        // Clean up expired entries every minute
        setInterval(() => this.cleanup(), 60000);
    }
    cleanup() {
        const now = Date.now();
        Object.keys(this.store).forEach(key => {
            if (this.store[key].resetTime <= now) {
                delete this.store[key];
            }
        });
    }
    getKey(req) {
        return this.options.keyGenerator(req);
    }
    incrementCounter(key) {
        const now = Date.now();
        const windowStart = now - this.options.windowMs;
        if (!this.store[key] || this.store[key].resetTime <= now) {
            // First request in window or window expired
            this.store[key] = {
                count: 1,
                resetTime: now + this.options.windowMs
            };
            return { count: 1, resetTime: this.store[key].resetTime, isFirstHit: true };
        }
        // Increment existing counter
        this.store[key].count++;
        return { count: this.store[key].count, resetTime: this.store[key].resetTime, isFirstHit: false };
    }
    middleware() {
        return (req, res, next) => {
            // Skip rate limiting in development if configured
            if (process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true') {
                return next();
            }
            const key = this.getKey(req);
            const { count, resetTime } = this.incrementCounter(key);
            // Set rate limit headers
            if (this.options.standardHeaders) {
                res.set({
                    'RateLimit-Limit': this.options.max.toString(),
                    'RateLimit-Remaining': Math.max(0, this.options.max - count).toString(),
                    'RateLimit-Reset': new Date(resetTime).toISOString()
                });
            }
            if (this.options.legacyHeaders) {
                res.set({
                    'X-RateLimit-Limit': this.options.max.toString(),
                    'X-RateLimit-Remaining': Math.max(0, this.options.max - count).toString(),
                    'X-RateLimit-Reset': Math.floor(resetTime / 1000).toString()
                });
            }
            // Check if rate limit exceeded
            if (count > this.options.max) {
                (0, logger_1.logWarn)('Rate limit exceeded', {
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    url: req.originalUrl,
                    method: req.method,
                    count,
                    limit: this.options.max
                });
                const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
                res.set('Retry-After', retryAfter.toString());
                const response = (0, response_formatter_1.formatErrorResponse)(this.options.message);
                // Add rate limit metadata to the response
                const rateLimitResponse = {
                    ...response,
                    data: {
                        retryAfter,
                        limit: this.options.max,
                        windowMs: this.options.windowMs
                    }
                };
                res.status(429).json(rateLimitResponse);
                return;
            }
            next();
        };
    }
}
exports.RateLimiter = RateLimiter;
// Factory functions for different rate limit configurations
function createGeneralRateLimit() {
    const limiter = new RateLimiter({
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // 100 requests per window
        message: 'Too many requests from this IP, please try again later.'
    });
    return limiter.middleware();
}
function createAPIRateLimit() {
    const limiter = new RateLimiter({
        windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || '300000'), // 5 minutes
        max: parseInt(process.env.API_RATE_LIMIT_MAX_REQUESTS || '20'), // 20 API calls per window
        message: 'Too many API requests, please try again later. API usage is limited to prevent abuse.'
    });
    return limiter.middleware();
}
function createStrictRateLimit() {
    const limiter = new RateLimiter({
        windowMs: parseInt(process.env.STRICT_RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
        max: parseInt(process.env.STRICT_RATE_LIMIT_MAX_REQUESTS || '5'), // 5 requests per minute
        message: 'Rate limit exceeded. This endpoint has strict limits to prevent abuse.'
    });
    return limiter.middleware();
}
