// Tests for LLM service chunked request handling
import { TLLMProvider, TLLMRequest, TLLMResponse, ILLMService, TLLMPromptData, DiffChunk } from '../../../src/types/llm-types';
import { LLMService } from '../../../src/server/services/llm-service';
import { ChunkResult, AggregatedResult } from '../../../src/server/services/result-aggregator-service';

// Mock individual LLM service for testing
class MockILLMService implements ILLMService {
  private responses: string[];
  private callCount = 0;
  private shouldFail = false;

  constructor(responses: string[] = [], shouldFail = false) {
    this.responses = responses;
    this.shouldFail = shouldFail;
  }

  async generateDescription(request: TLLMRequest): Promise<TLLMResponse> {
    if (this.shouldFail) {
      return {
        success: false,
        error: 'Mock service failure'
      };
    }

    const response = this.responses[this.callCount] || `Mock response ${this.callCount + 1}`;
    this.callCount++;

    return {
      success: true,
      data: {
        description: response,
        provider: TLLMProvider.OPENAI,
        model: 'gpt-3.5-turbo'
      }
    };
  }

  async generateDescriptionWithCallback?(request: TLLMRequest, onToken?: (token: string) => void): Promise<TLLMResponse> {
    const result = await this.generateDescription(request);
    if (result.success && result.data && onToken) {
      onToken(result.data.description);
    }
    return result;
  }

  async isAvailable(): Promise<boolean> {
    return !this.shouldFail;
  }

  getProviderName(): TLLMProvider {
    return TLLMProvider.OPENAI;
  }

  reset() {
    this.callCount = 0;
  }
}

describe('LLM Service Chunked Request Handling', () => {
  let llmService: LLMService;
  let mockService: MockILLMService;

  beforeEach(() => {
    llmService = new LLMService();
    mockService = new MockILLMService();
    llmService.registerService(TLLMProvider.OPENAI, mockService);
  });

  describe('generateDescriptionChunked', () => {
    it('should_process_chunked_request_successfully', async () => {
      // Arrange
      const chunks: DiffChunk[] = [
        {
          content: 'diff --git a/file1.js b/file1.js\n+content1',
          index: 0,
          totalChunks: 2,
          context: { files: ['file1.js'], changeType: 'modify' },
          hasOverlap: false
        },
        {
          content: 'diff --git a/file2.js b/file2.js\n+content2',
          index: 1,
          totalChunks: 2,
          context: { files: ['file2.js'], changeType: 'modify' },
          hasOverlap: false
        }
      ];

      const prData: TLLMPromptData = {
        title: 'Test PR',
        description: 'Test description',
        diff: 'original large diff',
        author: 'test-author',
        sourceBranch: 'feature',
        destinationBranch: 'main',
        repository: 'test/repo',
        chunks,
        requiresChunking: true
      };

      const request: TLLMRequest = {
        provider: TLLMProvider.OPENAI,
        prData
      };

      mockService = new MockILLMService([
        'Description for file1.js changes',
        'Description for file2.js changes'
      ]);
      llmService.registerService(TLLMProvider.OPENAI, mockService);

      // Act
      const result = await (llmService as any).generateDescriptionChunked(request);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.description).toContain('Description for file1.js changes');
      expect(result.data?.description).toContain('Description for file2.js changes');
    });

    it('should_reject_non_chunked_request_when_called_directly', async () => {
      // Arrange
      const prData: TLLMPromptData = {
        title: 'Simple PR',
        description: 'Simple change',
        diff: 'small diff content',
        author: 'test-author',
        sourceBranch: 'feature',
        destinationBranch: 'main',
        repository: 'test/repo',
        requiresChunking: false // This should cause rejection when called directly
      };

      const request: TLLMRequest = {
        provider: TLLMProvider.OPENAI,
        prData
      };

      mockService = new MockILLMService(['Simple PR description']);
      llmService.registerService(TLLMProvider.OPENAI, mockService);

      // Act
      const result = await (llmService as any).generateDescriptionChunked(request);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('No chunks to process');
    });

    it('should_handle_partial_chunk_failures', async () => {
      // Arrange
      const chunks: DiffChunk[] = [
        {
          content: 'chunk 1',
          index: 0,
          totalChunks: 3,
          context: { files: ['file1.js'], changeType: 'modify' },
          hasOverlap: false
        },
        {
          content: 'chunk 2',
          index: 1,
          totalChunks: 3,
          context: { files: ['file2.js'], changeType: 'modify' },
          hasOverlap: false
        },
        {
          content: 'chunk 3',
          index: 2,
          totalChunks: 3,
          context: { files: ['file3.js'], changeType: 'modify' },
          hasOverlap: false
        }
      ];

      const prData: TLLMPromptData = {
        title: 'Partial failure test',
        description: 'Test partial failures',
        diff: 'original diff',
        author: 'test-author',
        sourceBranch: 'feature',
        destinationBranch: 'main',
        repository: 'test/repo',
        chunks,
        requiresChunking: true
      };

      const request: TLLMRequest = {
        provider: TLLMProvider.OPENAI,
        prData
      };

      // Mock service that fails on second call
      class PartialFailMockService extends MockILLMService {
        private callIndex = 0;
        
        async generateDescription(request: TLLMRequest): Promise<TLLMResponse> {
          this.callIndex++;
          if (this.callIndex === 2) {
            return { success: false, error: 'Simulated failure on chunk 2' };
          }
          
          const responses = ['Success chunk 1', '', 'Success chunk 3'];
          const responseIndex = this.callIndex === 3 ? 2 : 0;
          return {
            success: true,
            data: {
              description: responses[responseIndex],
              provider: TLLMProvider.OPENAI,
              model: 'gpt-3.5-turbo'
            }
          };
        }
      }

      const partialFailService = new PartialFailMockService();
      llmService.registerService(TLLMProvider.OPENAI, partialFailService);

      // Act
      const result = await (llmService as any).generateDescriptionChunked(request);

      // Assert
      expect(result.success).toBe(true); // Should succeed with partial results
      expect(result.data?.description).toContain('Success chunk 1');
      expect(result.data?.description).toContain('Success chunk 3');
      expect(result.data?.description).not.toContain('chunk 2');
    });

    it('should_fail_when_all_chunks_fail', async () => {
      // Arrange
      const chunks: DiffChunk[] = [
        {
          content: 'chunk 1',
          index: 0,
          totalChunks: 2,
          context: { files: ['file1.js'], changeType: 'modify' },
          hasOverlap: false
        },
        {
          content: 'chunk 2',
          index: 1,
          totalChunks: 2,
          context: { files: ['file2.js'], changeType: 'modify' },
          hasOverlap: false
        }
      ];

      const prData: TLLMPromptData = {
        title: 'All fail test',
        description: 'Test all failures',
        diff: 'original diff',
        author: 'test-author',
        sourceBranch: 'feature',
        destinationBranch: 'main',
        repository: 'test/repo',
        chunks,
        requiresChunking: true
      };

      const request: TLLMRequest = {
        provider: TLLMProvider.OPENAI,
        prData
      };

      mockService = new MockILLMService([], true); // All calls fail
      llmService.registerService(TLLMProvider.OPENAI, mockService);

      // Act
      const result = await (llmService as any).generateDescriptionChunked(request);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to process chunked request');
    });

    it('should_handle_missing_chunks_gracefully', async () => {
      // Arrange
      const prData: TLLMPromptData = {
        title: 'Empty chunks test',
        description: 'Test empty chunks',
        diff: 'original diff',
        author: 'test-author',
        sourceBranch: 'feature',
        destinationBranch: 'main',
        repository: 'test/repo',
        chunks: [],
        requiresChunking: true
      };

      const request: TLLMRequest = {
        provider: TLLMProvider.OPENAI,
        prData
      };

      // Act
      const result = await (llmService as any).generateDescriptionChunked(request);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('No chunks to process');
    });
  });

  describe('generateDescriptionStreamChunked', () => {
    it('should_stream_chunked_responses', async () => {
      // Arrange
      const chunks: DiffChunk[] = [
        {
          content: 'chunk 1',
          index: 0,
          totalChunks: 2,
          context: { files: ['file1.js'], changeType: 'modify' },
          hasOverlap: false
        },
        {
          content: 'chunk 2',
          index: 1,
          totalChunks: 2,
          context: { files: ['file2.js'], changeType: 'modify' },
          hasOverlap: false
        }
      ];

      const prData: TLLMPromptData = {
        title: 'Streaming test',
        description: 'Test streaming',
        diff: 'original diff',
        author: 'test-author',
        sourceBranch: 'feature',
        destinationBranch: 'main',
        repository: 'test/repo',
        chunks,
        requiresChunking: true
      };

      const request: TLLMRequest = {
        provider: TLLMProvider.OPENAI,
        prData
      };

      mockService = new MockILLMService([
        'Streaming chunk 1 response',
        'Streaming chunk 2 response'
      ]);
      llmService.registerService(TLLMProvider.OPENAI, mockService);

      const receivedTokens: string[] = [];
      const onToken = (token: string) => {
        receivedTokens.push(token);
      };

      // Act
      const result = await (llmService as any).generateDescriptionStreamChunked(request, onToken);

      // Assert
      expect(result.success).toBe(true);
      expect(receivedTokens).toContain('Streaming chunk 1 response');
      expect(receivedTokens).toContain('Streaming chunk 2 response');
    });
  });

  describe('integration with existing methods', () => {
    it('should_use_chunked_processing_when_chunks_present', async () => {
      // Arrange
      const chunks: DiffChunk[] = [
        {
          content: 'integrated chunk',
          index: 0,
          totalChunks: 1,
          context: { files: ['file1.js'], changeType: 'modify' },
          hasOverlap: false
        }
      ];

      const prData: TLLMPromptData = {
        title: 'Integration test',
        description: 'Test integration',
        diff: 'original diff',
        author: 'test-author',
        sourceBranch: 'feature',
        destinationBranch: 'main',
        repository: 'test/repo',
        chunks,
        requiresChunking: true
      };

      const request: TLLMRequest = {
        provider: TLLMProvider.OPENAI,
        prData
      };

      mockService = new MockILLMService(['Integrated response']);
      llmService.registerService(TLLMProvider.OPENAI, mockService);

      // Act
      const result = await llmService.generateDescription(request);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.description).toContain('Integrated response');
    });

    it('should_fallback_to_normal_processing_when_no_chunks', async () => {
      // Arrange
      const prData: TLLMPromptData = {
        title: 'Normal test',
        description: 'Test normal processing',
        diff: 'small diff',
        author: 'test-author',
        sourceBranch: 'feature',
        destinationBranch: 'main',
        repository: 'test/repo',
        requiresChunking: false
      };

      const request: TLLMRequest = {
        provider: TLLMProvider.OPENAI,
        prData
      };

      mockService = new MockILLMService(['Normal response']);
      llmService.registerService(TLLMProvider.OPENAI, mockService);

      // Act
      const result = await llmService.generateDescription(request);

      // Assert
      expect(result.success).toBe(true);
      expect(result.data?.description).toBe('Normal response');
    });
  });
});