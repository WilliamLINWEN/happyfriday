// Health check and status endpoints
import { Request, Response, NextFunction } from 'express';
import { getLLMService } from '../services/llm-service-registry';
import { formatSuccessResponse } from '../utils/response-formatter';

export async function healthCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const llmService = getLLMService();
    const availableProviders = await llmService.getAvailableProviders();

    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        llmProviders: availableProviders,
        totalProviders: availableProviders.length
      }
    };

    res.status(200).json(formatSuccessResponse(healthStatus, 'System is healthy'));
  } catch (error) {
    console.error('Health check failed:', error);
    next(error);
  }
}

export async function getAvailableProviders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const llmService = getLLMService();
    const availableProviders = await llmService.getAvailableProviders();

    res.status(200).json(formatSuccessResponse({
      providers: availableProviders,
      total: availableProviders.length
    }, 'Available LLM providers retrieved successfully'));
  } catch (error) {
    console.error('Error getting available providers:', error);
    next(error);
  }
}
