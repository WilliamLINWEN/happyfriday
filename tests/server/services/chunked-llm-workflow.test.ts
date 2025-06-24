// Tests for chunked LLM processing workflow
import { TLLMPromptData, TLLMProvider, TLLMRequest, TLLMResponse } from '../../../src/types/llm-types';
import { DiffChunk } from '../../../src/server/services/diff-chunker-service';
import { ChunkResult, AggregatedResult, ResultAggregatorService } from '../../../src/server/services/result-aggregator-service';

// Mock LLM service for testing
class MockLLMService {
  private shouldFail: boolean;
  private responses: string[];
  private callCount = 0;

  constructor(shouldFail = false, responses: string[] = []) {
    this.shouldFail = shouldFail;
    this.responses = responses;
  }

  async generateDescription(request: TLLMRequest): Promise<TLLMResponse> {
    if (this.shouldFail) {
      return {
        success: false,
        error: 'Mock LLM service error'
      };
    }

    const response = this.responses[this.callCount] || `Generated description for chunk ${this.callCount + 1}`;
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

  reset() {
    this.callCount = 0;
  }
}

// Helper function for processing chunked requests
async function processChunkedRequest(
  prData: TLLMPromptData,
  llmService: MockLLMService
): Promise<AggregatedResult> {
  const resultAggregator = new ResultAggregatorService();
  
  if (!prData.chunks || !prData.requiresChunking) {
    throw new Error('Request does not require chunking');
  }

  if (prData.chunks.length === 0) {
    return {
      success: false,
      error: 'No chunks to process',
      chunksProcessed: 0,
      failedChunks: 0,
      description: ''
    };
  }

  const chunkResults: ChunkResult[] = [];

  for (const chunk of prData.chunks) {
    const chunkRequest: TLLMRequest = {
      provider: TLLMProvider.OPENAI,
      prData: {
        ...prData,
        diff: chunk.content,
        additionalContext: `Processing chunk ${chunk.index + 1} of ${chunk.totalChunks}`
      }
    };

    try {
      const response = await llmService.generateDescription(chunkRequest);
      
      chunkResults.push({
        chunkIndex: chunk.index,
        success: response.success,
        description: response.data?.description || '',
        error: response.error
      });
    } catch (error) {
      chunkResults.push({
        chunkIndex: chunk.index,
        success: false,
        description: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return resultAggregator.aggregateResults(prData.chunks, chunkResults);
}

describe('Chunked LLM Processing Workflow', () => {
  let mockLLMService: MockLLMService;
  let resultAggregator: ResultAggregatorService;

  beforeEach(() => {
    mockLLMService = new MockLLMService();
    resultAggregator = new ResultAggregatorService();
  });

  describe('processChunkedRequest', () => {

    it('should_process_multiple_chunks_successfully', async () => {
      // Arrange
      const chunks: DiffChunk[] = [
        {
          content: 'diff --git a/file1.js b/file1.js\n+changes1',
          index: 0,
          totalChunks: 2,
          context: { files: ['file1.js'], changeType: 'modify' as const },
          hasOverlap: false
        },
        {
          content: 'diff --git a/file2.js b/file2.js\n+changes2',
          index: 1,
          totalChunks: 2,
          context: { files: ['file2.js'], changeType: 'modify' as const },
          hasOverlap: false
        }
      ];

      const prData: TLLMPromptData = {
        title: 'Multi-chunk PR',
        description: 'A large PR',
        diff: 'original large diff',
        author: 'test-author',
        sourceBranch: 'feature',
        destinationBranch: 'main',
        repository: 'test/repo',
        chunks,
        requiresChunking: true
      };

      const responses = [
        'Added new functionality to file1.js',
        'Updated file2.js with improvements'
      ];
      mockLLMService = new MockLLMService(false, responses);

      // Act
      const result = await processChunkedRequest(prData, mockLLMService);

      // Assert
      expect(result.success).toBe(true);
      expect(result.description).toContain('Added new functionality to file1.js');
      expect(result.description).toContain('Updated file2.js with improvements');
      expect(result.chunksProcessed).toBe(2);
    });

    it('should_handle_partial_chunk_failures', async () => {
      // Arrange
      const chunks: DiffChunk[] = [
        {
          content: 'diff --git a/file1.js b/file1.js\n+changes1',
          index: 0,
          totalChunks: 3,
          context: { files: ['file1.js'], changeType: 'modify' as const },
          hasOverlap: false
        },
        {
          content: 'diff --git a/file2.js b/file2.js\n+changes2',
          index: 1,
          totalChunks: 3,
          context: { files: ['file2.js'], changeType: 'modify' as const },
          hasOverlap: false
        },
        {
          content: 'diff --git a/file3.js b/file3.js\n+changes3',
          index: 2,
          totalChunks: 3,
          context: { files: ['file3.js'], changeType: 'modify' as const },
          hasOverlap: false
        }
      ];

      const prData: TLLMPromptData = {
        title: 'Mixed success PR',
        description: 'Some chunks will fail',
        diff: 'original large diff',
        author: 'test-author',
        sourceBranch: 'feature',
        destinationBranch: 'main',
        repository: 'test/repo',
        chunks,
        requiresChunking: true
      };

      // Mock service that fails on second call
      class PartialFailMockService extends MockLLMService {
        private callIndex = 0;
        
        async generateDescription(request: TLLMRequest): Promise<TLLMResponse> {
          this.callIndex++;
          if (this.callIndex === 2) {
            return { success: false, error: 'Simulated failure on chunk 2' };
          }
          
          const responses = [
            'Successfully processed file1.js',
            '', // This will fail (not used due to failure)
            'Successfully processed file3.js'
          ];
          
          // Use the correct response for successful calls
          const responseIndex = this.callIndex === 3 ? 2 : 0; // Map call 3 to response index 2
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

      // Act
      const result = await processChunkedRequest(prData, partialFailService as any);

      // Assert
      expect(result.success).toBe(true); // Should succeed with partial results
      expect(result.description).toContain('Successfully processed file1.js');
      expect(result.description).toContain('Successfully processed file3.js');
      expect(result.description).not.toContain('file2.js');
      expect(result.chunksProcessed).toBe(3);
    });

    it('should_fail_when_all_chunks_fail', async () => {
      // Arrange
      const chunks: DiffChunk[] = [
        {
          content: 'diff --git a/file1.js b/file1.js\n+changes1',
          index: 0,
          totalChunks: 2,
          context: { files: ['file1.js'], changeType: 'modify' as const },
          hasOverlap: false
        },
        {
          content: 'diff --git a/file2.js b/file2.js\n+changes2',
          index: 1,
          totalChunks: 2,
          context: { files: ['file2.js'], changeType: 'modify' as const },
          hasOverlap: false
        }
      ];

      const prData: TLLMPromptData = {
        title: 'Failing PR',
        description: 'All chunks will fail',
        diff: 'original large diff',
        author: 'test-author',
        sourceBranch: 'feature',
        destinationBranch: 'main',
        repository: 'test/repo',
        chunks,
        requiresChunking: true
      };

      mockLLMService = new MockLLMService(true); // All calls fail

      // Act
      const result = await processChunkedRequest(prData, mockLLMService);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to process diff chunks');
      expect(result.chunksProcessed).toBe(2);
    });

    it('should_handle_empty_chunks_gracefully', async () => {
      // Arrange
      const prData: TLLMPromptData = {
        title: 'Empty chunks PR',
        description: 'No chunks',
        diff: 'original diff',
        author: 'test-author',
        sourceBranch: 'feature',
        destinationBranch: 'main',
        repository: 'test/repo',
        chunks: [],
        requiresChunking: true
      };

      // Act
      const result = await processChunkedRequest(prData, mockLLMService);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('No chunks to process');
      expect(result.chunksProcessed).toBe(0);
    });

    it('should_preserve_chunk_context_in_requests', async () => {
      // Arrange
      const chunks: DiffChunk[] = [
        {
          content: 'diff --git a/important.js b/important.js\n+critical changes',
          index: 0,
          totalChunks: 1,
          context: { 
            files: ['important.js'], 
            changeType: 'modify' as const 
          },
          hasOverlap: false
        }
      ];

      const prData: TLLMPromptData = {
        title: 'Context preservation test',
        description: 'Test context passing',
        diff: 'original diff',
        author: 'test-author',
        sourceBranch: 'feature',
        destinationBranch: 'main',
        repository: 'test/repo',
        additionalContext: 'Original context',
        chunks,
        requiresChunking: true
      };

      // Spy on the LLM service to verify context
      const requestSpy = jest.fn();
      class SpyMockService extends MockLLMService {
        async generateDescription(request: TLLMRequest): Promise<TLLMResponse> {
          requestSpy(request);
          return super.generateDescription(request);
        }
      }

      const spyService = new SpyMockService();

      // Act
      await processChunkedRequest(prData, spyService as any);

      // Assert
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          prData: expect.objectContaining({
            diff: 'diff --git a/important.js b/important.js\n+critical changes',
            additionalContext: 'Processing chunk 1 of 1'
          })
        })
      );
    });
  });

  describe('chunk ordering and sequence', () => {
    it('should_process_chunks_in_correct_order', async () => {
      // Arrange
      const chunks: DiffChunk[] = [
        {
          content: 'chunk 0 content',
          index: 0,
          totalChunks: 3,
          context: { files: ['file1.js'], changeType: 'modify' as const },
          hasOverlap: false
        },
        {
          content: 'chunk 1 content',
          index: 1,
          totalChunks: 3,
          context: { files: ['file2.js'], changeType: 'modify' as const },
          hasOverlap: false
        },
        {
          content: 'chunk 2 content',
          index: 2,
          totalChunks: 3,
          context: { files: ['file3.js'], changeType: 'modify' as const },
          hasOverlap: false
        }
      ];

      const prData: TLLMPromptData = {
        title: 'Order test PR',
        description: 'Test chunk processing order',
        diff: 'original diff',
        author: 'test-author',
        sourceBranch: 'feature',
        destinationBranch: 'main',
        repository: 'test/repo',
        chunks,
        requiresChunking: true
      };

      const responses = ['First chunk', 'Second chunk', 'Third chunk'];
      mockLLMService = new MockLLMService(false, responses);

      // Track processing order
      const processedOrder: number[] = [];
      class OrderTrackingService extends MockLLMService {
        async generateDescription(request: TLLMRequest): Promise<TLLMResponse> {
          const contextMatch = request.prData.additionalContext?.match(/chunk (\d+) of/);
          if (contextMatch) {
            processedOrder.push(parseInt(contextMatch[1]) - 1); // Convert to 0-based index
          }
          return super.generateDescription(request);
        }
      }

      const orderService = new OrderTrackingService(false, responses);

      // Act
      await processChunkedRequest(prData, orderService as any);

      // Assert
      expect(processedOrder).toEqual([0, 1, 2]);
    });
  });

  describe('error recovery and resilience', () => {
    it('should_continue_processing_after_individual_chunk_errors', async () => {
      // Arrange
      const chunks: DiffChunk[] = [
        {
          content: 'chunk 0',
          index: 0,
          totalChunks: 4,
          context: { files: ['file1.js'], changeType: 'modify' as const },
          hasOverlap: false
        },
        {
          content: 'chunk 1',
          index: 1,
          totalChunks: 4,
          context: { files: ['file2.js'], changeType: 'modify' as const },
          hasOverlap: false
        },
        {
          content: 'chunk 2',
          index: 2,
          totalChunks: 4,
          context: { files: ['file3.js'], changeType: 'modify' as const },
          hasOverlap: false
        },
        {
          content: 'chunk 3',
          index: 3,
          totalChunks: 4,
          context: { files: ['file4.js'], changeType: 'modify' as const },
          hasOverlap: false
        }
      ];

      const prData: TLLMPromptData = {
        title: 'Resilience test PR',
        description: 'Test error recovery',
        diff: 'original diff',
        author: 'test-author',
        sourceBranch: 'feature',
        destinationBranch: 'main',
        repository: 'test/repo',
        chunks,
        requiresChunking: true
      };

      // Service that fails on chunks 1 and 3
      class SporadicFailService extends MockLLMService {
        private callIndex = 0;
        
        async generateDescription(request: TLLMRequest): Promise<TLLMResponse> {
          const currentCall = this.callIndex++;
          if (currentCall === 1 || currentCall === 3) {
            return { success: false, error: `Simulated failure on chunk ${currentCall}` };
          }
          return { 
            success: true, 
            data: { 
              description: `Success on chunk ${currentCall}`, 
              provider: TLLMProvider.OPENAI 
            } 
          };
        }
      }

      const sporadicService = new SporadicFailService();

      // Act
      const result = await processChunkedRequest(prData, sporadicService as any);

      // Assert
      expect(result.success).toBe(true); // Should succeed with partial results
      expect(result.description).toContain('Success on chunk 0');
      expect(result.description).toContain('Success on chunk 2');
      expect(result.description).not.toContain('chunk 1');
      expect(result.description).not.toContain('chunk 3');
      expect(result.chunksProcessed).toBe(4);
    });
  });
});