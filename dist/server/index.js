"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Main Express server file
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const generate_description_1 = require("./api/generate-description");
const health_1 = require("./api/health");
const error_middleware_1 = require("./middleware/error-middleware");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Middleware
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});
// Serve static files from client directory
app.use(express_1.default.static('src/client'));
// API Routes
app.get('/health', health_1.healthCheck);
app.get('/api/providers', health_1.getAvailableProviders);
app.post('/api/generate-description', generate_description_1.generateDescription);
// Root endpoint
app.get('/', (req, res) => {
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
app.use(error_middleware_1.notFoundHandler);
app.use(error_middleware_1.errorHandler);
// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📖 API documentation available at http://localhost:${PORT}/`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
