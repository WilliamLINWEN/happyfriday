# Security Implementation Documentation

## Overview

This document outlines the comprehensive security and error handling measures implemented in the Bitbucket PR Description Generator application. The implementation follows security best practices and provides robust protection against common web vulnerabilities.

## Security Features Implemented

### 1. Rate Limiting

**Location**: `src/server/middleware/rate-limiter.ts`

- **Per-IP rate limiting** with configurable limits
- **Different rate limits** for general requests vs API endpoints
- **Configurable via environment variables**:
  - `RATE_LIMIT_WINDOW_MS`: Time window for rate limiting (default: 15 minutes)
  - `RATE_LIMIT_MAX_REQUESTS`: Max requests per window (default: 100)
  - `API_RATE_LIMIT_WINDOW_MS`: Time window for API endpoints (default: 5 minutes)  
  - `API_RATE_LIMIT_MAX_REQUESTS`: Max API requests per window (default: 20)
- **Development bypass** option via `SKIP_RATE_LIMIT` environment variable
- **Automatic cleanup** of expired rate limit entries
- **Proper HTTP headers** including rate limit information

### 2. Input Validation and Sanitization

**Location**: `src/server/utils/input-validator.ts`

- **XSS prevention** through HTML encoding
- **Repository format validation** with security pattern detection
- **PR number range validation** (1-999999)
- **Provider whitelist validation**
- **Request size validation** to prevent memory attacks
- **Suspicious pattern detection** for common injection attacks:
  - SQL injection patterns
  - XSS patterns
  - Path traversal patterns
  - Command injection patterns

### 3. Security Headers and Middleware

**Location**: `src/server/middleware/security.ts`

#### Security Headers
- **Content Security Policy (CSP)** to prevent XSS attacks
- **X-Frame-Options: DENY** to prevent clickjacking
- **X-Content-Type-Options: nosniff** to prevent MIME type sniffing
- **X-XSS-Protection: 1; mode=block** (legacy but still useful)
- **Strict-Transport-Security** for HTTPS connections
- **Referrer-Policy: strict-origin-when-cross-origin**
- **Permissions-Policy** to restrict browser features

#### Request Validation
- **Request size limits** (configurable via `MAX_REQUEST_SIZE`)
- **User agent validation** with bot/crawler blocking
- **IP whitelist capability** for production environments
- **Suspicious pattern detection** in request data

### 4. Enhanced Error Handling

**Location**: `src/server/middleware/error-handler.ts` and `src/server/utils/error-handler.ts`

#### Error Categorization
- **Validation errors** (400)
- **Authentication errors** (401)
- **Authorization errors** (403)
- **External API errors** (502)
- **Rate limit errors** (429)
- **Security errors** (403)
- **System errors** (500)

#### Error Features
- **Unique request IDs** for tracking
- **Error metadata** with context information
- **Error metrics tracking** for monitoring
- **Proper error sanitization** to prevent information leakage
- **Development vs production** error detail levels
- **Graceful handling** of uncaught exceptions
- **Structured logging** with security events

### 5. Client-Side Security

**Location**: `src/client/js/formHandler.js`

- **Enhanced input validation** matching backend patterns
- **Input sanitization** to prevent XSS
- **Proper error message display** with sanitization
- **Enhanced error handling** with retry logic for transient failures
- **Request timeout handling**

## Configuration

### Environment Variables

```bash
# Security Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
MAX_REQUEST_SIZE=1048576         # 1MB
ALLOW_BOTS=false                # Block bot user agents

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000      # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100      # Max requests per window
API_RATE_LIMIT_WINDOW_MS=300000  # 5 minutes for API endpoints
API_RATE_LIMIT_MAX_REQUESTS=20   # Max API requests per window
SKIP_RATE_LIMIT=false           # Development bypass

# CORS
FRONTEND_URL=http://localhost:3000
```

## Security Headers Example

The application automatically sets the following security headers on all responses:

```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.bitbucket.org https://api.openai.com https://api.anthropic.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), screen-wake-lock=()
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Request-ID: [unique-id]
```

## Error Response Format

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "message": "User-friendly error message",
    "category": "validation|authentication|security|system|etc",
    "timestamp": "2025-06-10T15:30:00.000Z",
    "requestId": "abc123def456",
    "retryable": true|false,
    "retryAfter": 60
  },
  "details": {
    "Only included in development environment"
  }
}
```

## Security Monitoring

The application logs the following security events:

- **Rate limit violations** with IP and user agent
- **Suspicious request patterns** with request details
- **Input validation failures** with sanitized context
- **Authentication failures** with attempt details
- **Blocked user agents/IPs** with reasoning
- **Error occurrences** with categorization and tracking

## Vulnerability Protection

This implementation provides protection against:

- **Cross-Site Scripting (XSS)** - via CSP, input sanitization, and output encoding
- **SQL Injection** - via input validation and pattern detection
- **Command Injection** - via suspicious pattern detection
- **Clickjacking** - via X-Frame-Options header
- **MIME Type Confusion** - via X-Content-Type-Options header
- **CSRF** - via SameSite cookies and CORS configuration
- **DoS/DDoS** - via rate limiting and request size limits
- **Information Disclosure** - via error sanitization and proper logging
- **Malicious Bots** - via user agent validation
- **Path Traversal** - via input validation patterns

## Production Considerations

1. **HTTPS Only**: Ensure HTTPS is enabled in production for HSTS to be effective
2. **Rate Limiting Storage**: Consider Redis for distributed rate limiting in production
3. **Error Monitoring**: Integrate with monitoring services for error tracking
4. **Security Headers**: Validate CSP policies don't break functionality
5. **Log Management**: Ensure security logs are properly collected and monitored
6. **Regular Updates**: Keep dependencies updated for security patches

## Testing

Security measures can be tested using:

1. **Rate limiting**: Send multiple rapid requests to verify blocking
2. **Input validation**: Try malicious payloads to verify sanitization
3. **Error handling**: Trigger various error conditions to verify proper responses
4. **Security headers**: Use tools like securityheaders.com to verify headers
5. **XSS protection**: Test with XSS payloads to verify blocking

## Compliance

This implementation helps with compliance for:

- **OWASP Top 10** security risks
- **GDPR** data protection (via proper error handling)
- **SOC 2** security controls
- **Common security frameworks** and best practices
