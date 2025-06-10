"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Main Express server file
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const generate_description_1 = require("./api/generate-description");
const health_1 = require("./api/health");
const rate_limiter_1 = require("./middleware/rate-limiter");
const error_handler_1 = require("./middleware/error-handler");
const security_1 = require("./middleware/security");
const logger_1 = require("./utils/logger");
dotenv_1.default.config();
// Initialize uncaught error handlers
(0, error_handler_1.handleUncaughtErrors)();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Security and request middleware (order matters!)
app.use(error_handler_1.requestIdMiddleware);
app.use((0, security_1.securityHeadersMiddleware)());
app.use((0, security_1.corsSecurityMiddleware)(process.env.ALLOWED_ORIGINS?.split(',') || ['*']));
app.use((0, security_1.userAgentValidationMiddleware)());
app.use((0, security_1.requestSizeMiddleware)(parseInt(process.env.MAX_REQUEST_SIZE || '1048576'))); // 1MB default
// Apply general rate limiting to all requests
app.use((0, rate_limiter_1.createGeneralRateLimit)());
// Body parsing middleware
app.use(express_1.default.json({ limit: '1mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '1mb' }));
// Additional security middleware
app.use((0, security_1.suspiciousPatternMiddleware)());
// Request logging middleware
app.use((req, res, next) => {
    const requestId = req.requestId;
    (0, logger_1.logInfo)('Incoming request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId
    });
    next();
});
// Serve static files from client directory
app.use(express_1.default.static('src/client'));
// API Routes
app.get('/health', (0, error_handler_1.asyncErrorHandler)(health_1.healthCheck));
app.get('/api/providers', (0, error_handler_1.asyncErrorHandler)(health_1.getAvailableProviders));
// Apply stricter rate limiting to the main API endpoint
app.post('/api/generate-description', (0, rate_limiter_1.createAPIRateLimit)(), (0, error_handler_1.asyncErrorHandler)(generate_description_1.generateDescription));
// API info endpoint (moved from root to avoid conflict with static files)
app.get('/api', (req, res) => {
    res.json({
        name: 'Bitbucket PR Description Generator API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: '/health',
            providers: '/api/providers',
            generateDescription: 'POST /api/generate-description'
        }
    });
});
// Error handling middleware (must be last)
app.use(error_handler_1.notFoundHandler);
app.use(error_handler_1.globalErrorHandler);
// Start server
app.listen(PORT, () => {
    (0, logger_1.logInfo)('Server started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
    });
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Web interface available at http://localhost:${PORT}/`);
    console.log(`📖 API documentation available at http://localhost:${PORT}/api`);
    console.log(`🔒 Security middleware enabled`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
