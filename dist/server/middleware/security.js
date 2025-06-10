"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityHeadersMiddleware = securityHeadersMiddleware;
exports.corsSecurityMiddleware = corsSecurityMiddleware;
exports.requestSizeMiddleware = requestSizeMiddleware;
exports.suspiciousPatternMiddleware = suspiciousPatternMiddleware;
exports.ipWhitelistMiddleware = ipWhitelistMiddleware;
exports.userAgentValidationMiddleware = userAgentValidationMiddleware;
const error_handler_1 = require("../utils/error-handler");
const logger_1 = require("../utils/logger");
const defaultSecurityConfig = {
    enableCSP: true,
    enableHSTS: true,
    enableXFrameOptions: true,
    enableXContentTypeOptions: true,
    enableReferrerPolicy: true,
    enablePermissionsPolicy: true,
    allowedOrigins: ['self'],
    maxAge: 31536000 // 1 year in seconds
};
function securityHeadersMiddleware(config = {}) {
    const securityConfig = { ...defaultSecurityConfig, ...config };
    return (req, res, next) => {
        // Content Security Policy
        if (securityConfig.enableCSP) {
            const cspDirectives = [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Allow inline scripts for development
                "style-src 'self' 'unsafe-inline'", // Allow inline styles
                "img-src 'self' data: https:",
                "font-src 'self' data:",
                "connect-src 'self' https://api.bitbucket.org https://api.openai.com https://api.anthropic.com",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self'",
                "object-src 'none'"
            ];
            // Allow localhost in development
            if (process.env.NODE_ENV === 'development') {
                cspDirectives.push("connect-src 'self' https://api.bitbucket.org https://api.openai.com https://api.anthropic.com http://localhost:* ws://localhost:*");
            }
            res.set('Content-Security-Policy', cspDirectives.join('; '));
        }
        // HTTP Strict Transport Security
        if (securityConfig.enableHSTS && req.secure) {
            res.set('Strict-Transport-Security', `max-age=${securityConfig.maxAge}; includeSubDomains; preload`);
        }
        // X-Frame-Options
        if (securityConfig.enableXFrameOptions) {
            res.set('X-Frame-Options', 'DENY');
        }
        // X-Content-Type-Options
        if (securityConfig.enableXContentTypeOptions) {
            res.set('X-Content-Type-Options', 'nosniff');
        }
        // X-XSS-Protection (legacy but still useful)
        res.set('X-XSS-Protection', '1; mode=block');
        // Referrer Policy
        if (securityConfig.enableReferrerPolicy) {
            res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
        }
        // Permissions Policy (formerly Feature Policy)
        if (securityConfig.enablePermissionsPolicy) {
            const permissions = [
                'camera=()',
                'microphone=()',
                'geolocation=()',
                'payment=()',
                'usb=()',
                'screen-wake-lock=()'
            ];
            res.set('Permissions-Policy', permissions.join(', '));
        }
        // Remove powered-by header
        res.removeHeader('X-Powered-By');
        // Custom security header for API identification
        res.set('X-API-Version', '1.0.0');
        next();
    };
}
function corsSecurityMiddleware(allowedOrigins = ['self']) {
    return (req, res, next) => {
        const origin = req.get('Origin');
        // Handle CORS for allowed origins
        if (origin && allowedOrigins.includes('*')) {
            res.set('Access-Control-Allow-Origin', '*');
        }
        else if (origin && (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development')) {
            res.set('Access-Control-Allow-Origin', origin);
            res.set('Vary', 'Origin');
        }
        res.set({
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400' // 24 hours
        });
        // Handle preflight requests
        if (req.method === 'OPTIONS') {
            res.status(204).send();
            return;
        }
        next();
    };
}
function requestSizeMiddleware(maxSizeBytes = 1024 * 1024) {
    return (req, res, next) => {
        const contentLength = parseInt(req.get('content-length') || '0');
        if (contentLength > maxSizeBytes) {
            const error = (0, error_handler_1.createSecurityError)('Request entity too large', {
                requestSize: contentLength,
                maxSize: maxSizeBytes,
                requestId: req.requestId
            });
            (0, logger_1.logWarn)('Large request blocked', {
                size: contentLength,
                maxAllowed: maxSizeBytes,
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });
            next(error);
            return;
        }
        next();
    };
}
function suspiciousPatternMiddleware() {
    const suspiciousPatterns = [
        // SQL injection patterns
        /(\bunion\s+select\b)|(\bselect\s+.*\bfrom\b)|(\binsert\s+into\b)|(\bdelete\s+from\b)|(\bdrop\s+table\b)/i,
        // XSS patterns
        /<script[^>]*>.*?<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        // Path traversal patterns
        /\.\.[\/\\]/g
    ];
    // Command injection patterns - only check specific fields, not headers
    const commandInjectionPatterns = [
        /[;&|`$]/g, // Simplified pattern, removed parentheses and brackets which are common in headers
        /\$\{.*\}/g, // Template injection
        /\|\s*[a-zA-Z]/g // Pipe with commands
    ];
    return (req, res, next) => {
        // Only check user-controllable data, not headers which may contain legitimate special characters
        const userControllableData = {
            url: req.url,
            query: req.query,
            body: req.body
        };
        const requestDataString = JSON.stringify(userControllableData);
        // Check general suspicious patterns against all user data
        for (const pattern of suspiciousPatterns) {
            if (pattern.test(requestDataString)) {
                const error = (0, error_handler_1.createSecurityError)('Suspicious request pattern detected', {
                    pattern: pattern.toString(),
                    requestId: req.requestId
                });
                (0, logger_1.logWarn)('Suspicious request blocked', {
                    pattern: pattern.toString(),
                    url: req.url,
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    requestData: process.env.NODE_ENV === 'development' ? requestDataString : '[redacted]'
                });
                next(error);
                return;
            }
        }
        // Check command injection patterns only against URL and query parameters (not body)
        const urlAndQuery = `${req.url} ${JSON.stringify(req.query)}`;
        for (const pattern of commandInjectionPatterns) {
            if (pattern.test(urlAndQuery)) {
                const error = (0, error_handler_1.createSecurityError)('Suspicious command injection pattern detected', {
                    pattern: pattern.toString(),
                    requestId: req.requestId
                });
                (0, logger_1.logWarn)('Suspicious request blocked', {
                    pattern: pattern.toString(),
                    url: req.url,
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    requestData: process.env.NODE_ENV === 'development' ? urlAndQuery : '[redacted]'
                });
                next(error);
                return;
            }
        }
        next();
    };
}
function ipWhitelistMiddleware(allowedIPs = []) {
    return (req, res, next) => {
        // Skip IP whitelist in development
        if (process.env.NODE_ENV === 'development' || allowedIPs.length === 0) {
            next();
            return;
        }
        const clientIP = req.ip || req.socket.remoteAddress || '';
        if (!allowedIPs.includes(clientIP) && !allowedIPs.includes('0.0.0.0')) {
            const error = (0, error_handler_1.createSecurityError)('IP address not allowed', {
                clientIP,
                requestId: req.requestId
            });
            (0, logger_1.logWarn)('IP address blocked', {
                clientIP,
                allowedIPs,
                url: req.url,
                userAgent: req.get('User-Agent')
            });
            next(error);
            return;
        }
        next();
    };
}
function userAgentValidationMiddleware() {
    const blockedUserAgents = [
        /bot/i,
        /crawler/i,
        /spider/i,
        /scraper/i
    ];
    const suspiciousUserAgents = [
        '', // Empty user agent
        'curl',
        'wget',
        'python-requests'
    ];
    return (req, res, next) => {
        const userAgent = req.get('User-Agent') || '';
        // Block known bots/crawlers (unless explicitly allowed)
        if (process.env.ALLOW_BOTS !== 'true') {
            for (const pattern of blockedUserAgents) {
                if (pattern.test(userAgent)) {
                    const error = (0, error_handler_1.createSecurityError)('User agent not allowed', {
                        userAgent,
                        requestId: req.requestId
                    });
                    (0, logger_1.logWarn)('User agent blocked', {
                        userAgent,
                        ip: req.ip,
                        url: req.url
                    });
                    next(error);
                    return;
                }
            }
        }
        // Log suspicious user agents
        if (suspiciousUserAgents.includes(userAgent.toLowerCase())) {
            (0, logger_1.logWarn)('Suspicious user agent detected', {
                userAgent,
                ip: req.ip,
                url: req.url
            });
        }
        next();
    };
}
