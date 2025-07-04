// Rate limiting middleware to prevent API abuse and DOS attacks
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/error-handler';
import { formatErrorResponse } from '../utils/response-formatter';
import { logWarn, logError } from '../utils/logger';

interface TRateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

interface TRateLimitOptions {
  windowMs: number;        // Time window in milliseconds
  max: number;            // Maximum number of requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
}

class RateLimiter {
  private store: TRateLimitStore = {};
  private options: Required<TRateLimitOptions>;

  constructor(options: TRateLimitOptions) {
    this.options = {
      windowMs: options.windowMs,
      max: options.max,
      skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
      skipFailedRequests: options.skipFailedRequests ?? false,
      keyGenerator: options.keyGenerator ?? ((req: Request) => req.ip || 'unknown'),
      message: options.message ?? 'Too many requests, please try again later.',
      standardHeaders: options.standardHeaders ?? true,
      legacyHeaders: options.legacyHeaders ?? false
    };

    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  private cleanup(): void {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      if (this.store[key].resetTime <= now) {
        delete this.store[key];
      }
    });
  }

  private getKey(req: Request): string {
    return this.options.keyGenerator(req);
  }

  private incrementCounter(key: string): { count: number; resetTime: number; isFirstHit: boolean } {
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

  public middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
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
        logWarn('Rate limit exceeded', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          url: req.originalUrl,
          method: req.method,
          count,
          limit: this.options.max
        });

        const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
        res.set('Retry-After', retryAfter.toString());

        const response = formatErrorResponse(this.options.message);
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

// Factory functions for different rate limit configurations
export function createGeneralRateLimit(): (req: Request, res: Response, next: NextFunction) => void {
  const limiter = new RateLimiter({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),      // 100 requests per window
    message: 'Too many requests from this IP, please try again later.'
  });
  return limiter.middleware();
}

export function createAPIRateLimit(): (req: Request, res: Response, next: NextFunction) => void {
  const limiter = new RateLimiter({
    windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || '300000'), // 5 minutes
    max: parseInt(process.env.API_RATE_LIMIT_MAX_REQUESTS || '20'),       // 20 API calls per window
    message: 'Too many API requests, please try again later. API usage is limited to prevent abuse.'
  });
  return limiter.middleware();
}

export function createStrictRateLimit(): (req: Request, res: Response, next: NextFunction) => void {
  const limiter = new RateLimiter({
    windowMs: parseInt(process.env.STRICT_RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
    max: parseInt(process.env.STRICT_RATE_LIMIT_MAX_REQUESTS || '5'),       // 5 requests per minute
    message: 'Rate limit exceeded. This endpoint has strict limits to prevent abuse.'
  });
  return limiter.middleware();
}

export { RateLimiter };
