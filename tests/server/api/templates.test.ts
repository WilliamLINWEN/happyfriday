// tests/server/api/templates.test.ts
import { describe, beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { getTemplates, getTemplateMetadata, validateTemplate } from '../../../src/server/api/templates';
import { TemplateService } from '../../../src/server/services/template-service';

// Mock the TemplateService
jest.mock('../../../src/server/services/template-service');
const mockTemplateService = TemplateService as jest.Mocked<typeof TemplateService>;

// Mock logger
jest.mock('../../../src/server/utils/logger', () => ({
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn()
}));

describe('Templates API', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  const mockTemplates = [
    {
      filename: 'pr-description-template-en.txt',
      metadata: {
        name: 'Standard PR Description (English)',
        description: 'Professional PR description template',
        language: 'en',
        category: 'description' as const
      }
    },
    {
      filename: 'pr-description-template-zh.txt',
      metadata: {
        name: '標準 PR 描述 (中文)',
        description: '專業的 PR 描述模板',
        language: 'zh',
        category: 'description' as const
      }
    }
  ];

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any
    };
    mockNext = jest.fn();

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('getTemplates', () => {
    test('should return available templates successfully', async () => {
      mockTemplateService.getAvailableTemplates.mockReturnValue(mockTemplates);

      await getTemplates(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          templates: mockTemplates,
          count: 2
        },
        message: 'Templates retrieved successfully',
        timestamp: expect.any(String)
      });
    });

    test('should handle no templates found', async () => {
      mockTemplateService.getAvailableTemplates.mockReturnValue([]);

      await getTemplates(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'No templates available',
        timestamp: expect.any(String)
      });
    });

    test('should handle service errors', async () => {
      const error = new Error('Template service error');
      mockTemplateService.getAvailableTemplates.mockImplementation(() => {
        throw error;
      });

      await getTemplates(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getTemplateMetadata', () => {
    beforeEach(() => {
      mockReq.params = { templateName: 'pr-description-template-en.txt' };
    });

    test('should return template metadata successfully', async () => {
      const mockMetadata = mockTemplates[0].metadata;
      mockTemplateService.getTemplateMetadata.mockReturnValue(mockMetadata);

      await getTemplateMetadata(mockReq as Request, mockRes as Response, mockNext);

      expect(mockTemplateService.getTemplateMetadata).toHaveBeenCalledWith('pr-description-template-en.txt');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          filename: 'pr-description-template-en.txt',
          metadata: mockMetadata
        },
        message: 'Template metadata retrieved successfully',
        timestamp: expect.any(String)
      });
    });

    test('should handle template not found', async () => {
      mockTemplateService.getTemplateMetadata.mockReturnValue(null);

      await getTemplateMetadata(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: "Template 'pr-description-template-en.txt' not found",
        timestamp: expect.any(String)
      });
    });

    test('should handle missing template name parameter', async () => {
      mockReq.params = {};

      await getTemplateMetadata(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Template name is required',
        timestamp: expect.any(String)
      });
    });

    test('should handle undefined template name', async () => {
      mockReq.params = { templateName: undefined as any };

      await getTemplateMetadata(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Template name is required',
        timestamp: expect.any(String)
      });
    });

    test('should handle service errors', async () => {
      const error = new Error('Metadata retrieval error');
      mockTemplateService.getTemplateMetadata.mockImplementation(() => {
        throw error;
      });

      await getTemplateMetadata(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('validateTemplate', () => {
    beforeEach(() => {
      mockReq.params = { templateName: 'pr-description-template-en.txt' };
    });

    test('should validate existing template successfully', async () => {
      mockTemplateService.validateTemplate.mockReturnValue(true);

      await validateTemplate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockTemplateService.validateTemplate).toHaveBeenCalledWith('pr-description-template-en.txt');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          templateName: 'pr-description-template-en.txt',
          isValid: true,
          exists: true
        },
        message: 'Template validation passed',
        timestamp: expect.any(String)
      });
    });

    test('should handle invalid template', async () => {
      mockTemplateService.validateTemplate.mockReturnValue(false);

      await validateTemplate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          templateName: 'pr-description-template-en.txt',
          isValid: false,
          exists: false
        },
        message: 'Template validation failed',
        timestamp: expect.any(String)
      });
    });

    test('should handle missing template name parameter', async () => {
      mockReq.params = {};

      await validateTemplate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Template name is required',
        timestamp: expect.any(String)
      });
    });

    test('should handle service errors', async () => {
      const error = new Error('Validation error');
      mockTemplateService.validateTemplate.mockImplementation(() => {
        throw error;
      });

      await validateTemplate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('Parameter validation', () => {
    test('should handle empty string template name', async () => {
      mockReq.params = { templateName: '' };

      await getTemplateMetadata(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Template name is required',
        timestamp: expect.any(String)
      });
    });

    test('should handle whitespace-only template name', async () => {
      mockReq.params = { templateName: '   ' };
      mockTemplateService.validateTemplate.mockReturnValue(false);

      await validateTemplate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockTemplateService.validateTemplate).toHaveBeenCalledWith('   ');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          templateName: '   ',
          isValid: false,
          exists: false
        },
        message: 'Template validation failed',
        timestamp: expect.any(String)
      });
    });

    test('should handle special characters in template name', async () => {
      mockReq.params = { templateName: 'template-with-special-chars!@#.txt' };
      mockTemplateService.validateTemplate.mockReturnValue(true);

      await validateTemplate(mockReq as Request, mockRes as Response, mockNext);

      expect(mockTemplateService.validateTemplate).toHaveBeenCalledWith('template-with-special-chars!@#.txt');
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Error handling', () => {
    test('should handle unexpected errors in getTemplates', async () => {
      const unexpectedError = new Error('Unexpected error');
      mockTemplateService.getAvailableTemplates.mockImplementation(() => {
        throw unexpectedError;
      });

      await getTemplates(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(unexpectedError);
    });

    test('should handle null response from service', async () => {
      mockTemplateService.getAvailableTemplates.mockReturnValue(null as any);

      await getTemplates(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });
});