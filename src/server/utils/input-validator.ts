// Input validation and sanitization utilities
import { TLLMProvider } from '../../types/llm-types';
import { logWarn } from './logger';

export interface TValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized?: string;
}

export interface TValidationRules {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  whitelist?: string[];
  allowedChars?: RegExp;
  trim?: boolean;
  sanitize?: boolean;
}

export class InputValidator {
  // HTML encoding to prevent XSS attacks
  static escapeHtml(input: string): string {
    const entityMap: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;'
    };

    return String(input).replace(/[&<>"'`=\/]/g, (s) => entityMap[s]);
  }

  // Remove potentially dangerous characters and scripts
  static sanitizeString(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    let sanitized = input;

    // Remove script tags and their content
    sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
    
    // Remove potentially dangerous HTML tags
    const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'button', 'link', 'meta'];
    const tagPattern = new RegExp(`<\\/?(?:${dangerousTags.join('|')})[^>]*>`, 'gi');
    sanitized = sanitized.replace(tagPattern, '');

    // Remove javascript: and data: protocols
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/data:/gi, '');

    // Remove event handlers
    sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');

    // Limit control characters
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized.trim();
  }

  // Validate repository format (workspace/repo_slug)
  static validateRepository(repo: string): TValidationResult {
    const result: TValidationResult = { isValid: true, errors: [] };

    if (!repo) {
      result.isValid = false;
      result.errors.push('Repository is required');
      return result;
    }

    const sanitized = this.sanitizeString(repo);
    result.sanitized = sanitized;

    // Check length limits
    if (sanitized.length < 3) {
      result.isValid = false;
      result.errors.push('Repository name must be at least 3 characters long');
    }

    if (sanitized.length > 200) {
      result.isValid = false;
      result.errors.push('Repository name must be less than 200 characters');
    }

    // Check format: workspace/repo_slug
    const repoPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
    if (!repoPattern.test(sanitized)) {
      result.isValid = false;
      result.errors.push('Repository must be in format "workspace/repo_slug" with valid characters (alphanumeric, dots, hyphens, underscores)');
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\.\./, // Directory traversal
      /[<>]/, // HTML tags
      /['"`;]/, // Quote injection
      /\$\{/, // Template injection
      /%[0-9a-fA-F]{2}/, // URL encoding (suspicious in repo names)
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(sanitized)) {
        result.isValid = false;
        result.errors.push('Repository name contains invalid or potentially malicious characters');
        logWarn('Suspicious repository name pattern detected', { 
          original: repo, 
          sanitized: sanitized,
          pattern: pattern.source 
        });
        break;
      }
    }

    return result;
  }

  // Validate PR number
  static validatePRNumber(prNumber: string): TValidationResult {
    const result: TValidationResult = { isValid: true, errors: [] };

    if (!prNumber) {
      result.isValid = false;
      result.errors.push('PR number is required');
      return result;
    }

    const sanitized = this.sanitizeString(prNumber);
    result.sanitized = sanitized;

    // Check if it's a valid positive integer
    const prNumberPattern = /^[1-9]\d*$/;
    if (!prNumberPattern.test(sanitized)) {
      result.isValid = false;
      result.errors.push('PR number must be a positive integer');
    }

    // Check reasonable range (1 to 999999)
    const num = parseInt(sanitized, 10);
    if (isNaN(num) || num < 1 || num > 999999) {
      result.isValid = false;
      result.errors.push('PR number must be between 1 and 999999');
    }

    return result;
  }

  // Validate LLM provider (whitelist validation)
  static validateProvider(provider: string): TValidationResult {
    const result: TValidationResult = { isValid: true, errors: [] };

    if (!provider) {
      result.isValid = false;
      result.errors.push('Provider is required');
      return result;
    }

    const sanitized = this.sanitizeString(provider).toLowerCase();
    result.sanitized = sanitized;

    // Use whitelist validation for providers
    const validProviders = Object.values(TLLMProvider);
    if (!validProviders.includes(sanitized as TLLMProvider)) {
      result.isValid = false;
      result.errors.push(`Provider must be one of: ${validProviders.join(', ')}`);
    }

    return result;
  }

  // Validate general string input
  static validateString(input: string, rules: TValidationRules): TValidationResult {
    const result: TValidationResult = { isValid: true, errors: [] };

    if (!input && rules.required) {
      result.isValid = false;
      result.errors.push('This field is required');
      return result;
    }

    if (!input) {
      result.sanitized = '';
      return result;
    }

    let processed = input;

    // Trim whitespace if requested
    if (rules.trim !== false) {
      processed = processed.trim();
    }

    // Sanitize if requested
    if (rules.sanitize !== false) {
      processed = this.sanitizeString(processed);
    }

    result.sanitized = processed;

    // Check length constraints
    if (rules.minLength && processed.length < rules.minLength) {
      result.isValid = false;
      result.errors.push(`Minimum length is ${rules.minLength} characters`);
    }

    if (rules.maxLength && processed.length > rules.maxLength) {
      result.isValid = false;
      result.errors.push(`Maximum length is ${rules.maxLength} characters`);
    }

    // Check pattern matching
    if (rules.pattern && !rules.pattern.test(processed)) {
      result.isValid = false;
      result.errors.push('Input format is invalid');
    }

    // Check whitelist
    if (rules.whitelist && !rules.whitelist.includes(processed)) {
      result.isValid = false;
      result.errors.push(`Value must be one of: ${rules.whitelist.join(', ')}`);
    }

    // Check allowed characters
    if (rules.allowedChars && !rules.allowedChars.test(processed)) {
      result.isValid = false;
      result.errors.push('Input contains invalid characters');
    }

    return result;
  }

  // Validate request body size
  static validateRequestSize(body: any, maxSizeBytes: number = 1024 * 1024): TValidationResult {
    const result: TValidationResult = { isValid: true, errors: [] };

    try {
      const bodySize = JSON.stringify(body).length;
      if (bodySize > maxSizeBytes) {
        result.isValid = false;
        result.errors.push(`Request body too large. Maximum size is ${Math.floor(maxSizeBytes / 1024)}KB`);
        logWarn('Large request body detected', { 
          size: bodySize, 
          maxSize: maxSizeBytes 
        });
      }
    } catch (error) {
      result.isValid = false;
      result.errors.push('Invalid request body format');
    }

    return result;
  }

  // Comprehensive validation for generate description request
  static validateGenerateDescriptionRequest(body: any): TValidationResult {
    const result: TValidationResult = { isValid: true, errors: [] };

    // Validate request size first
    const sizeValidation = InputValidator.validateRequestSize(body);
    if (!sizeValidation.isValid) {
      return sizeValidation;
    }

    // Validate repository
    const repoValidation = InputValidator.validateRepository(body.repository);
    if (!repoValidation.isValid) {
      result.isValid = false;
      result.errors.push(...repoValidation.errors);
    }

    // Validate PR number
    const prValidation = InputValidator.validatePRNumber(body.prNumber);
    if (!prValidation.isValid) {
      result.isValid = false;
      result.errors.push(...prValidation.errors);
    }

    // Validate provider (optional)
    if (body.provider) {
      const providerValidation = InputValidator.validateProvider(body.provider);
      if (!providerValidation.isValid) {
        result.isValid = false;
        result.errors.push(...providerValidation.errors);
      }
    }

    // Validate options if present
    if (body.options && typeof body.options === 'object') {
      if (body.options.maxTokens !== undefined) {
        if (typeof body.options.maxTokens !== 'number' || body.options.maxTokens < 1 || body.options.maxTokens > 4000) {
          result.isValid = false;
          result.errors.push('maxTokens must be a number between 1 and 4000');
        }
      }

      if (body.options.temperature !== undefined) {
        if (typeof body.options.temperature !== 'number' || body.options.temperature < 0 || body.options.temperature > 2) {
          result.isValid = false;
          result.errors.push('temperature must be a number between 0 and 2');
        }
      }

      if (body.options.model !== undefined) {
        const modelValidation = this.validateString(body.options.model, {
          maxLength: 100,
          allowedChars: /^[a-zA-Z0-9._-]+$/
        });
        if (!modelValidation.isValid) {
          result.isValid = false;
          result.errors.push('Invalid model name format');
        }
      }
    }

    return result;
  }
}

// Export utility functions for convenience
export const escapeHtml = InputValidator.escapeHtml;
export const sanitizeString = InputValidator.sanitizeString;
export const validateRepository = InputValidator.validateRepository;
export const validatePRNumber = InputValidator.validatePRNumber;
export const validateProvider = InputValidator.validateProvider;
export const validateString = InputValidator.validateString;
export const validateRequestSize = InputValidator.validateRequestSize;
export const validateGenerateDescriptionRequest = InputValidator.validateGenerateDescriptionRequest;
