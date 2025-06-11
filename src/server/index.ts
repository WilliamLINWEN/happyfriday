// Main Express server file
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { generateDescription, generateDescriptionStream } from './api/generate-description';
import { healthCheck, getAvailableProviders } from './api/health';
import { testStream } from './api/test-stream';
import { errorHandler, notFoundHandler } from './middleware/error-middleware';
import { createGeneralRateLimit, createAPIRateLimit } from './middleware/rate-limiter';
import { 
  globalErrorHandler, 
  notFoundHandler as newNotFoundHandler, 
  requestIdMiddleware, 
  handleUncaughtErrors,
  asyncErrorHandler 
} from './middleware/error-handler';
import { 
  securityHeadersMiddleware, 
  corsSecurityMiddleware, 
  requestSizeMiddleware,
  suspiciousPatternMiddleware,
  userAgentValidationMiddleware 
} from './middleware/security';
import { logInfo } from './utils/logger';

dotenv.config();

// Initialize uncaught error handlers
handleUncaughtErrors();

const app = express();
const PORT = process.env.PORT || 3000;

// Security and request middleware (order matters!)
app.use(requestIdMiddleware);
app.use(securityHeadersMiddleware());
app.use(corsSecurityMiddleware(process.env.ALLOWED_ORIGINS?.split(',') || ['*']));
app.use(userAgentValidationMiddleware());
app.use(requestSizeMiddleware(parseInt(process.env.MAX_REQUEST_SIZE || '1048576'))); // 1MB default

// Apply general rate limiting to all requests
app.use(createGeneralRateLimit());

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Additional security middleware
app.use(suspiciousPatternMiddleware());

// Request logging middleware
app.use((req, res, next) => {
  const requestId = (req as any).requestId;
  logInfo('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId
  });
  next();
});

// Serve static files from client directory
app.use(express.static('src/client'));

// API Routes
app.get('/health', asyncErrorHandler(healthCheck));
app.get('/api/providers', asyncErrorHandler(getAvailableProviders));

// Test streaming endpoint
app.get('/api/test-stream', asyncErrorHandler(testStream));

// Apply stricter rate limiting to the main API endpoint
app.post('/api/generate-description', createAPIRateLimit(), asyncErrorHandler(generateDescription));

// Streaming endpoint for real-time description generation
app.post('/api/generate-description/stream', createAPIRateLimit(), asyncErrorHandler(generateDescriptionStream));

// API info endpoint (moved from root to avoid conflict with static files)
app.get('/api', (req, res) => {
  res.json({
    name: 'Bitbucket PR Description Generator API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      providers: '/api/providers',
      generateDescription: 'POST /api/generate-description',
      generateDescriptionStream: 'POST /api/generate-description/stream'
    }
  });
});

// Error handling middleware (must be last)
app.use(newNotFoundHandler);
app.use(globalErrorHandler);

// Start server only if this file is run directly (not imported for testing)
if (require.main === module) {
  app.listen(PORT, () => {
    logInfo('Server started', {
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
}

// Export app for testing
export default app;
