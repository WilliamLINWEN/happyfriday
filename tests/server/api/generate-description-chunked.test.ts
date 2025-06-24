// Tests for API endpoints with chunked processing support
import request from 'supertest';
import express from 'express';
import { generateDescription, generateDescriptionStream } from '../../../src/server/api/generate-description';
import { getLLMService } from '../../../src/server/services/llm-service-registry';
import { fetchPullRequest, fetchPullRequestDiff } from '../../../src/server/services/bitbucket-service';
import { TLLMProvider, TLLMResponse, DiffChunk } from '../../../src/types/llm-types';

// Mock dependencies
jest.mock('../../../src/server/services/llm-service-registry');
jest.mock('../../../src/server/services/bitbucket-service');

const mockGetLLMService = getLLMService as jest.MockedFunction<typeof getLLMService>;
const mockFetchPullRequest = fetchPullRequest as jest.MockedFunction<typeof fetchPullRequest>;
const mockFetchPullRequestDiff = fetchPullRequestDiff as jest.MockedFunction<typeof fetchPullRequestDiff>;

// Mock LLM service
const mockLLMService = {
  generateDescription: jest.fn(),
  generateDescriptionStream: jest.fn(),
  getAvailableProviders: jest.fn()
};

describe('API Endpoints with Chunked Processing', () => {
  let app: express.Application;

  beforeAll(() => {
    // Set up environment variables for testing
    process.env.ENABLE_CHUNKING = 'true';
    process.env.ENABLE_FILE_FILTERING = 'true';
    process.env.DIFF_CHUNK_SIZE = '1000';
    process.env.LLM_PROMPT_MAX_DIFF = '2000';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    app = express();
    app.use(express.json());
    app.post('/api/generate-description', generateDescription);
    app.post('/api/generate-description/stream', generateDescriptionStream);

    // Default mock setup
    mockGetLLMService.mockReturnValue(mockLLMService as any);
    mockLLMService.getAvailableProviders.mockResolvedValue([TLLMProvider.OPENAI]);

    // Mock successful Bitbucket responses
    mockFetchPullRequest.mockResolvedValue({
      success: true,
      data: {
        id: 123,
        title: 'Test PR Title',
        description: 'Test PR Description',
        state: 'OPEN',
        author: { 
          display_name: 'Test Author', 
          uuid: '{test-uuid}' 
        },
        created_on: '2023-01-01T00:00:00Z',
        updated_on: '2023-01-01T00:00:00Z',
        source: { 
          branch: { name: 'feature-branch' },
          repository: { full_name: 'test/repo' }
        },
        destination: { 
          branch: { name: 'main' },
          repository: { full_name: 'test/repo' }
        },
        links: { html: { href: 'https://bitbucket.org/test/repo/pull-requests/123' } }
      }
    });
  });

  afterAll(() => {
    // Clean up environment variables
    delete process.env.ENABLE_CHUNKING;
    delete process.env.ENABLE_FILE_FILTERING;
    delete process.env.DIFF_CHUNK_SIZE;
    delete process.env.LLM_PROMPT_MAX_DIFF;
  });

  describe('POST /api/generate-description', () => {
    it('should_process_large_diff_with_chunking', async () => {
      // Arrange
      const largeDiff = `diff --git a/package-lock.json b/package-lock.json
${'+'.repeat(500)} lock file content
diff --git a/src/file1.js b/src/file1.js
${'+'.repeat(600)} actual code changes
diff --git a/src/file2.js b/src/file2.js
${'+'.repeat(700)} more code changes`;

      mockFetchPullRequestDiff.mockResolvedValue({
        success: true,
        data: { diff: largeDiff }
      });

      // Mock LLM response for chunked processing
      mockLLMService.generateDescription.mockResolvedValue({
        success: true,
        data: {
          description: 'Generated description from chunked processing',
          provider: TLLMProvider.OPENAI,
          model: 'gpt-3.5-turbo'
        }
      });

      // Act
      const response = await request(app)
        .post('/api/generate-description')
        .send({
          repository: 'test/repo',
          prNumber: '123',
          provider: TLLMProvider.OPENAI
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.generatedDescription).toBe('Generated description from chunked processing');
      
      // Verify LLM service was called
      expect(mockLLMService.generateDescription).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: TLLMProvider.OPENAI,
          prData: expect.objectContaining({
            title: 'Test PR Title',
            diff: expect.any(String) // Should be the processed diff (potentially chunked/filtered)
          })
        })
      );
    });

    it('should_handle_chunked_processing_with_url_format', async () => {
      // Arrange
      const largeDiff = 'a'.repeat(5000); // Large diff to trigger chunking

      mockFetchPullRequestDiff.mockResolvedValue({
        success: true,
        data: { diff: largeDiff }
      });

      mockLLMService.generateDescription.mockResolvedValue({
        success: true,
        data: {
          description: 'Chunked description via URL format',
          provider: TLLMProvider.OPENAI,
          model: 'gpt-3.5-turbo'
        }
      });

      // Act
      const response = await request(app)
        .post('/api/generate-description')
        .send({
          prUrl: 'https://bitbucket.org/test/repo/pull-requests/123',
          provider: TLLMProvider.OPENAI
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.generatedDescription).toBe('Chunked description via URL format');
    });

    it('should_handle_chunking_failure_gracefully', async () => {
      // Arrange
      const largeDiff = 'a'.repeat(5000);

      mockFetchPullRequestDiff.mockResolvedValue({
        success: true,
        data: { diff: largeDiff }
      });

      // Mock chunked processing failure
      mockLLMService.generateDescription.mockResolvedValue({
        success: false,
        error: 'Failed to process chunked request: All chunks failed'
      });

      // Act
      const response = await request(app)
        .post('/api/generate-description')
        .send({
          repository: 'test/repo',
          prNumber: '123',
          provider: TLLMProvider.OPENAI
        });

      // Assert
      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to process chunked request');
    });

    it('should_include_chunking_metadata_in_response', async () => {
      // Arrange
      const largeDiff = 'a'.repeat(3000);

      mockFetchPullRequestDiff.mockResolvedValue({
        success: true,
        data: { diff: largeDiff }
      });

      mockLLMService.generateDescription.mockResolvedValue({
        success: true,
        data: {
          description: 'Description with metadata',
          provider: TLLMProvider.OPENAI,
          model: 'gpt-3.5-turbo'
        }
      });

      // Act
      const response = await request(app)
        .post('/api/generate-description')
        .send({
          repository: 'test/repo',
          prNumber: '123',
          provider: TLLMProvider.OPENAI
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.metadata).toEqual(
        expect.objectContaining({
          provider: TLLMProvider.OPENAI,
          model: 'gpt-3.5-turbo',
          processingTimeMs: expect.any(Number),
          diffSize: 3000
        })
      );
    });

    it('should_work_normally_with_small_diffs_when_chunking_enabled', async () => {
      // Arrange
      const smallDiff = 'diff --git a/small.js b/small.js\n+small change';

      mockFetchPullRequestDiff.mockResolvedValue({
        success: true,
        data: { diff: smallDiff }
      });

      mockLLMService.generateDescription.mockResolvedValue({
        success: true,
        data: {
          description: 'Normal description for small diff',
          provider: TLLMProvider.OPENAI,
          model: 'gpt-3.5-turbo'
        }
      });

      // Act
      const response = await request(app)
        .post('/api/generate-description')
        .send({
          repository: 'test/repo',
          prNumber: '123',
          provider: TLLMProvider.OPENAI
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.generatedDescription).toBe('Normal description for small diff');
    });
  });

  describe('POST /api/generate-description/stream', () => {
    it('should_support_streaming_with_chunked_processing', async () => {
      // Arrange
      const largeDiff = 'a'.repeat(4000);

      mockFetchPullRequestDiff.mockResolvedValue({
        success: true,
        data: { diff: largeDiff }
      });

      // Mock streaming response
      mockLLMService.generateDescriptionStream.mockImplementation(async (request, onToken) => {
        // Simulate streaming tokens
        setTimeout(() => onToken('Streaming '), 10);
        setTimeout(() => onToken('chunked '), 20);
        setTimeout(() => onToken('response'), 30);
        
        return {
          success: true,
          data: {
            description: 'Streaming chunked response',
            provider: TLLMProvider.OPENAI,
            model: 'gpt-3.5-turbo'
          }
        };
      });

      // Act
      const response = await request(app)
        .post('/api/generate-description/stream')
        .send({
          repository: 'test/repo',
          prNumber: '123',
          provider: TLLMProvider.OPENAI
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/event-stream');
      
      // Verify streaming service was called
      expect(mockLLMService.generateDescriptionStream).toHaveBeenCalled();
    });

    it('should_handle_streaming_chunked_processing_errors', async () => {
      // Arrange
      const largeDiff = 'a'.repeat(4000);

      mockFetchPullRequestDiff.mockResolvedValue({
        success: true,
        data: { diff: largeDiff }
      });

      mockLLMService.generateDescriptionStream.mockResolvedValue({
        success: false,
        error: 'Streaming chunked processing failed'
      });

      // Act
      const response = await request(app)
        .post('/api/generate-description/stream')
        .send({
          repository: 'test/repo',
          prNumber: '123',
          provider: TLLMProvider.OPENAI
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/event-stream');
      // The response should contain error event in SSE format
    });
  });

  describe('chunking behavior verification', () => {
    it('should_call_llm_service_with_proper_request_structure', async () => {
      // Arrange - Create a diff that will trigger both filtering and chunking
      const mixedDiff = `diff --git a/package-lock.json b/package-lock.json
${'+ '.repeat(1000)}lock file content should be filtered
diff --git a/src/important.js b/src/important.js
${'+ '.repeat(1000)}important code changes`;

      mockFetchPullRequestDiff.mockResolvedValue({
        success: true,
        data: { diff: mixedDiff }
      });

      let capturedRequest: any = null;
      mockLLMService.generateDescription.mockImplementation(async (request) => {
        capturedRequest = request;
        return {
          success: true,
          data: {
            description: 'Processed with optimization',
            provider: TLLMProvider.OPENAI,
            model: 'gpt-3.5-turbo'
          }
        };
      });

      // Act
      await request(app)
        .post('/api/generate-description')
        .send({
          repository: 'test/repo',
          prNumber: '123',
          provider: TLLMProvider.OPENAI
        });

      // Assert - Verify that LLM service was called with correct structure
      expect(capturedRequest).not.toBeNull();
      expect(capturedRequest).toEqual(
        expect.objectContaining({
          provider: TLLMProvider.OPENAI,
          prData: expect.objectContaining({
            title: 'Test PR Title',
            description: 'Test PR Description',
            diff: expect.any(String),
            author: 'Test Author',
            sourceBranch: 'feature-branch',
            destinationBranch: 'main',
            repository: 'test/repo',
            additionalContext: ''
          }),
          template: undefined,
          options: undefined
        })
      );
      
      // Verify that the diff was passed through (optimization happens in LLM service)
      expect(capturedRequest.prData.diff).toContain('package-lock.json');
      expect(capturedRequest.prData.diff).toContain('src/important.js');
    });
  });
});