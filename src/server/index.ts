// Main Express server file
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { generateDescription } from './api/generate-description';
import { healthCheck, getAvailableProviders } from './api/health';
import { errorHandler, notFoundHandler } from './middleware/error-middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Serve static files from client directory
app.use(express.static('src/client'));

// API Routes
app.get('/health', healthCheck);
app.get('/api/providers', getAvailableProviders);
app.post('/api/generate-description', generateDescription);

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
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📖 API documentation available at http://localhost:${PORT}/`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
