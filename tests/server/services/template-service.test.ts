// tests/server/services/template-service.test.ts
import { describe, beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { TemplateService, TemplateMetadata, AvailableTemplate } from '../../../src/server/services/template-service';
import { TLLMPromptData } from '../../../src/types/llm-types';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('TemplateService', () => {
  const mockTemplateContent = `Test template with {{title}} and {{description}} placeholders.
Background: {{additionalContext}}
Author: {{author}}`;

  const mockTemplatesMetadata = {
    'test-template-en.txt': {
      name: 'Test Template (English)',
      description: 'A test template for English',
      language: 'en',
      category: 'description' as const
    },
    'test-template-zh.txt': {
      name: '測試模板 (中文)',
      description: '中文測試模板',
      language: 'zh',
      category: 'description' as const
    }
  };

  const mockPRData: TLLMPromptData = {
    title: 'Test PR Title',
    description: 'Test PR description',
    author: 'Test Author',
    repository: 'test/repo',
    sourceBranch: 'feature-branch',
    destinationBranch: 'main',
    diff: 'test diff content',
    additionalContext: 'test context'
  };

  beforeEach(() => {
    // Clear all caches before each test
    TemplateService.clearCache();
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console methods
    jest.restoreAllMocks();
  });

  describe('Template Discovery', () => {
    test('should discover available templates with metadata', () => {
      // Mock directory structure
      mockFs.existsSync.mockImplementation((path: any) => {
        if (path.includes('templates') && !path.includes('.txt') && !path.includes('.json')) {
          return true; // Template directory exists
        }
        if (path.includes('templates.json')) {
          return true; // Metadata file exists
        }
        return false;
      });

      mockFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);
      
      (mockFs.readFileSync as any).mockImplementation((path: any) => {
        if (path.includes('templates.json')) {
          return JSON.stringify(mockTemplatesMetadata);
        }
        return mockTemplateContent;
      });

      mockFs.readdirSync.mockReturnValue(['test-template-en.txt', 'test-template-zh.txt'] as any);

      const templates = TemplateService.getAvailableTemplates();

      expect(templates).toHaveLength(2);
      expect(templates[0].filename).toBe('test-template-en.txt');
      expect(templates[0].metadata.name).toBe('Test Template (English)');
      expect(templates[1].filename).toBe('test-template-zh.txt');
      expect(templates[1].metadata.language).toBe('zh');
    });

    test('should handle missing template directory gracefully', () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.statSync.mockImplementation(() => {
        throw new Error('Directory not found');
      });

      const templates = TemplateService.getAvailableTemplates();

      expect(templates).toHaveLength(1);
      expect(templates[0].filename).toBe('pr-description-template-zh.txt');
      expect(templates[0].metadata.name).toBe('標準 PR 描述 (中文)');
    });

    test('should handle missing metadata file gracefully', () => {
      mockFs.existsSync.mockImplementation((path: any) => {
        if (path.includes('templates') && !path.includes('.txt') && !path.includes('.json')) {
          return true; // Template directory exists
        }
        if (path.includes('templates.json')) {
          return false; // Metadata file doesn't exist
        }
        return false;
      });

      mockFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);
      mockFs.readdirSync.mockReturnValue(['test-template.txt', 'review-template.txt'] as any);

      const templates = TemplateService.getAvailableTemplates();

      expect(templates).toHaveLength(2);
      expect(templates[0].metadata.name).toContain('template');
      expect(templates.some(t => t.metadata.category === 'review')).toBe(true);
    });

    test('should handle template discovery errors', () => {
      mockFs.existsSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      const templates = TemplateService.getAvailableTemplates();

      expect(templates).toHaveLength(1);
      expect(templates[0].filename).toBe('pr-description-template-zh.txt');
    });
  });

  describe('Template Validation', () => {
    test('should validate existing templates', () => {
      (mockFs.readFileSync as any).mockReturnValue(mockTemplateContent);

      const isValid = TemplateService.validateTemplate('test-template.txt');

      expect(isValid).toBe(true);
      expect(mockFs.readFileSync).toHaveBeenCalled();
    });

    test('should reject non-existent templates', () => {
      (mockFs.readFileSync as any).mockImplementation(() => {
        throw new Error('File not found');
      });

      const isValid = TemplateService.validateTemplate('non-existent.txt');

      expect(isValid).toBe(false);
    });

    test('should reject empty template names', () => {
      const isValid = TemplateService.validateTemplate('');

      expect(isValid).toBe(false);
      expect(mockFs.readFileSync).not.toHaveBeenCalled();
    });

    test('should reject null/undefined template names', () => {
      expect(TemplateService.validateTemplate(null as any)).toBe(false);
      expect(TemplateService.validateTemplate(undefined as any)).toBe(false);
    });
  });

  describe('Template Metadata', () => {
    test('should retrieve metadata for valid templates', () => {
      // Mock the getAvailableTemplates method
      const mockTemplates: AvailableTemplate[] = [
        {
          filename: 'test-template.txt',
          metadata: mockTemplatesMetadata['test-template-en.txt']
        }
      ];

      jest.spyOn(TemplateService, 'getAvailableTemplates').mockReturnValue(mockTemplates);

      const metadata = TemplateService.getTemplateMetadata('test-template.txt');

      expect(metadata).toEqual(mockTemplatesMetadata['test-template-en.txt']);
    });

    test('should return null for non-existent templates', () => {
      jest.spyOn(TemplateService, 'getAvailableTemplates').mockReturnValue([]);

      const metadata = TemplateService.getTemplateMetadata('non-existent.txt');

      expect(metadata).toBeNull();
    });
  });

  describe('Prompt Formatting', () => {
    beforeEach(() => {
      (mockFs.readFileSync as any).mockReturnValue(mockTemplateContent);
    });

    test('should format PR data with default template', () => {
      const result = TemplateService.formatPRDataForPrompt(mockPRData);

      expect(result).toContain('Test PR Title');
      expect(result).toContain('Test PR description');
      expect(result).toContain('Test Author');
      expect(result).toContain('test context');
      expect(result).not.toContain('{{title}}');
      expect(result).not.toContain('{{description}}');
    });

    test('should format PR data with specified template', () => {
      const result = TemplateService.formatPRDataForPrompt(mockPRData, 'custom-template.txt');

      expect(result).toContain('Test PR Title');
      expect(result).toContain('Test Author');
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('custom-template.txt'),
        'utf-8'
      );
    });

    test('should handle missing description gracefully', () => {
      const dataWithoutDescription = { ...mockPRData, description: '' };
      
      const result = TemplateService.formatPRDataForPrompt(dataWithoutDescription);

      expect(result).toContain('無描述提供');
    });

    test('should handle English template with missing description', () => {
      const dataWithoutDescription = { ...mockPRData, description: '' };
      
      const result = TemplateService.formatPRDataForPrompt(dataWithoutDescription, 'template-en.txt');

      expect(result).toContain('No description provided');
    });

    test('should handle missing additional context', () => {
      const dataWithoutContext = { ...mockPRData, additionalContext: '' };
      
      const result = TemplateService.formatPRDataForPrompt(dataWithoutContext);

      expect(result).not.toContain('{{additionalContext}}');
      expect(result).toContain('Background: '); // Empty but placeholder replaced
    });
  });

  describe('LangChain Integration', () => {
    beforeEach(() => {
      (mockFs.readFileSync as any).mockReturnValue(mockTemplateContent);
    });

    test('should create LangChain template', () => {
      const promptTemplate = TemplateService.createLangChainTemplate('test-template.txt');

      expect(promptTemplate).toBeDefined();
      expect(promptTemplate.template).toContain('{title}');
      expect(promptTemplate.template).toContain('{description}');
      expect(promptTemplate.inputVariables).toContain('title');
      expect(promptTemplate.inputVariables).toContain('description');
      expect(promptTemplate.inputVariables).toContain('author');
      expect(promptTemplate.inputVariables).toContain('additionalContext');
    });

    test('should format PR data for LangChain', async () => {
      const result = await TemplateService.formatPRDataForLangChain(mockPRData);

      expect(result).toContain('Test PR Title');
      expect(result).toContain('Test PR description');
      expect(result).toContain('Test Author');
      expect(result).not.toContain('{title}');
      expect(result).not.toContain('{description}');
    });

    test('should format PR data for LangChain with custom template', async () => {
      const result = await TemplateService.formatPRDataForLangChain(mockPRData, 'custom-template.txt');

      expect(result).toContain('Test PR Title');
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        expect.stringContaining('custom-template.txt'),
        'utf-8'
      );
    });

    test('should create chat template', () => {
      const systemMessage = 'You are a helpful assistant.';
      const chatTemplate = TemplateService.createChatTemplate(systemMessage, 'test-template.txt');

      expect(chatTemplate).toBeDefined();
      expect(chatTemplate.template).toContain('System: You are a helpful assistant.');
      expect(chatTemplate.template).toContain('User:');
      expect(chatTemplate.inputVariables).toContain('title');
      expect(chatTemplate.inputVariables).toContain('description');
    });

    test('should handle duplicate variables in template', () => {
      const templateWithDuplicates = `{{title}} - {{title}} by {{author}} - {{author}}`;
      mockFs.readFileSync.mockReturnValue(templateWithDuplicates);

      const promptTemplate = TemplateService.createLangChainTemplate('test-template.txt');

      expect(promptTemplate.inputVariables).toEqual(['title', 'author']);
      expect(promptTemplate.inputVariables.length).toBe(2); // No duplicates
    });
  });

  describe('Caching', () => {
    test('should cache template content', () => {
      (mockFs.readFileSync as any).mockReturnValue(mockTemplateContent);

      // First call
      TemplateService.formatPRDataForPrompt(mockPRData, 'test-template.txt');
      // Second call with same template
      TemplateService.formatPRDataForPrompt(mockPRData, 'test-template.txt');

      // Should only read file once due to caching
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
    });

    test('should cache LangChain templates', () => {
      (mockFs.readFileSync as any).mockReturnValue(mockTemplateContent);

      // First call
      TemplateService.createLangChainTemplate('test-template.txt');
      // Second call with same template
      TemplateService.createLangChainTemplate('test-template.txt');

      // Should only read file once due to caching
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(1);
    });

    test('should clear cache properly', () => {
      (mockFs.readFileSync as any).mockReturnValue(mockTemplateContent);

      // First call
      TemplateService.formatPRDataForPrompt(mockPRData, 'test-template.txt');
      
      // Clear cache
      TemplateService.clearCache();
      
      // Second call after cache clear
      TemplateService.formatPRDataForPrompt(mockPRData, 'test-template.txt');

      // Should read file twice due to cache clear
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle file read errors gracefully', () => {
      (mockFs.readFileSync as any).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => {
        TemplateService.formatPRDataForPrompt(mockPRData, 'test-template.txt');
      }).toThrow('Failed to find template file');
    });

    test('should try multiple paths for template files', () => {
      (mockFs.readFileSync as any)
        .mockImplementationOnce(() => { throw new Error('File not found'); })
        .mockImplementationOnce(() => { throw new Error('File not found'); })
        .mockImplementationOnce(() => mockTemplateContent);

      const result = TemplateService.formatPRDataForPrompt(mockPRData, 'test-template.txt');

      expect(result).toContain('Test PR Title');
      expect(mockFs.readFileSync).toHaveBeenCalledTimes(3);
    });

    test('should handle malformed metadata JSON', () => {
      mockFs.existsSync.mockImplementation((path: any) => {
        if (path.includes('templates') && !path.includes('.txt') && !path.includes('.json')) {
          return true;
        }
        if (path.includes('templates.json')) {
          return true;
        }
        return false;
      });

      mockFs.statSync.mockReturnValue({ isDirectory: () => true } as fs.Stats);
      mockFs.readdirSync.mockReturnValue(['test-template.txt'] as any);
      
      (mockFs.readFileSync as any).mockImplementation((path: any) => {
        if (path.includes('templates.json')) {
          return 'invalid json {';
        }
        return mockTemplateContent;
      });

      const templates = TemplateService.getAvailableTemplates();

      expect(templates).toHaveLength(1);
      expect(templates[0].filename).toBe('pr-description-template-zh.txt');
    });

    test('should handle empty template content', () => {
      mockFs.readFileSync.mockReturnValue('');

      const result = TemplateService.formatPRDataForPrompt(mockPRData, 'empty-template.txt');

      expect(result).toBe('');
    });
  });

  describe('Edge Cases', () => {
    test('should handle template with no variables', () => {
      const staticTemplate = 'This is a static template with no variables.';
      mockFs.readFileSync.mockReturnValue(staticTemplate);

      const result = TemplateService.formatPRDataForPrompt(mockPRData, 'static-template.txt');

      expect(result).toBe(staticTemplate);
    });

    test('should handle template with unknown variables', () => {
      const templateWithUnknownVars = 'Title: {{title}}, Unknown: {{unknownVar}}';
      mockFs.readFileSync.mockReturnValue(templateWithUnknownVars);

      const result = TemplateService.formatPRDataForPrompt(mockPRData, 'unknown-vars-template.txt');

      expect(result).toContain('Title: Test PR Title');
      expect(result).toContain('Unknown: '); // Unknown variables become empty
    });

    test('should handle very long template content', () => {
      const longTemplate = 'A'.repeat(1000) + '{{title}}' + 'B'.repeat(1000);
      (mockFs.readFileSync as any).mockReturnValue(longTemplate);

      const result = TemplateService.formatPRDataForPrompt(mockPRData, 'long-template.txt');

      expect(result).toContain('Test PR Title');
      expect(result.length).toBeGreaterThan(2000);
    });

    test('should handle special characters in template variables', () => {
      (mockFs.readFileSync as any).mockReturnValue(mockTemplateContent);
      
      const dataWithSpecialChars = {
        ...mockPRData,
        title: 'Title with "quotes" and <tags>',
        description: 'Description with & ampersand'
      };

      const result = TemplateService.formatPRDataForPrompt(dataWithSpecialChars, 'test-template.txt');

      expect(result).toContain('Title with "quotes" and <tags>');
      expect(result).toContain('Description with & ampersand');
    });
  });
});