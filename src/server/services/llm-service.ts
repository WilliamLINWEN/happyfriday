// Base LLM service interface and implementation
import dotenv from 'dotenv';
import { TLLMProvider, TLLMRequest, TLLMResponse, ILLMService, TLLMPromptData, DiffChunk } from '../../types/llm-types';
import { TemplateService } from './template-service';
import { optimizePrompt } from './llm-prompt-optimizer';
import { ResultAggregatorService, ChunkResult } from './result-aggregator-service';

dotenv.config();

export class LLMService {
  private services: Map<TLLMProvider, ILLMService>;
  private resultAggregator: ResultAggregatorService;

  constructor() {
    this.services = new Map();
    this.resultAggregator = new ResultAggregatorService();
    // Services will be registered dynamically to avoid circular dependencies
  }

  registerService(provider: TLLMProvider, service: ILLMService): void {
    this.services.set(provider, service);
  }

  async generateDescription(request: TLLMRequest): Promise<TLLMResponse> {
    try {
      const service = this.services.get(request.provider);
      if (!service) {
        return {
          success: false,
          error: `Unsupported LLM provider: ${request.provider}`
        };
      }

      const isAvailable = await service.isAvailable();
      if (!isAvailable) {
        return {
          success: false,
          error: `${request.provider} service is not available. Please check your API credentials.`
        };
      } 
     
      console.info(`${request.provider} is available. Using ${request.provider} service for description generation.`);     

      // Optimize prompt data before sending to LLM
      if (request.prData) {
        request.prData = optimizePrompt(request.prData);
      }

      // Check if request requires chunking
      if (request.prData?.requiresChunking && request.prData?.chunks) {
        return await this.generateDescriptionChunked(request);
      }

      return await service.generateDescription(request);
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to generate description: ${error.message}`
      };
    }
  }

  async generateDescriptionStream(
    request: TLLMRequest, 
    onToken: (token: string) => void
  ): Promise<TLLMResponse> {
    try {
      const service = this.services.get(request.provider);
      if (!service) {
        return {
          success: false,
          error: `Unsupported LLM provider: ${request.provider}`
        };
      }

      const isAvailable = await service.isAvailable();
      if (!isAvailable) {
        return {
          success: false,
          error: `${request.provider} service is not available. Please check your API credentials.`
        };
      }

      console.info(`${request.provider} is available. Using ${request.provider} service for streaming description generation.`);

      // Optimize prompt data before sending to LLM
      if (request.prData) {
        request.prData = optimizePrompt(request.prData);
      }

      // Check if request requires chunking
      if (request.prData?.requiresChunking && request.prData?.chunks) {
        return await this.generateDescriptionStreamChunked(request, onToken);
      }

      // Check if service supports streaming
      if (service.generateDescriptionWithCallback) {
        return await service.generateDescriptionWithCallback(request, onToken);
      } else {
        // Fallback to non-streaming if not supported
        console.warn(`${request.provider} service does not support streaming. Falling back to non-streaming mode.`);
        const response = await service.generateDescription(request);
        
        // Simulate streaming by sending the complete response at once
        if (response.success && response.data) {
          onToken(response.data.description);
        }
        
        return response;
      }
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to generate streaming description: ${error.message}`
      };
    }
  }

  async getAvailableProviders(): Promise<TLLMProvider[]> {
    const availableProviders: TLLMProvider[] = [];
    
    for (const [provider, service] of this.services) {
      try {
        const isAvailable = await service.isAvailable();
        if (isAvailable) {
          availableProviders.push(provider);
        }
      } catch (error) {
        // Service is not available, skip it
        console.warn(`Provider ${provider} is not available:`, error);
      }
    }
    
    return availableProviders;
  }

  static formatPRDataForPrompt(prData: TLLMPromptData): string {
    return TemplateService.formatPRDataForPrompt(prData);
  }

  static processLLMResponse(response: string): string {
    // Clean up and format the LLM response
    let cleanResponse = response.trim();
    
    // Remove any potential wrapper text that some LLMs might add
    if (cleanResponse.startsWith('Here is') || cleanResponse.startsWith('Here\'s')) {
      const lines = cleanResponse.split('\n');
      if (lines.length > 1) {
        cleanResponse = lines.slice(1).join('\n').trim();
      }
    }
    
    return cleanResponse;
  }

  async generateDescriptionChunked(request: TLLMRequest): Promise<TLLMResponse> {
    try {
      const service = this.services.get(request.provider);
      if (!service) {
        return {
          success: false,
          error: `Unsupported LLM provider: ${request.provider}`
        };
      }

      const prData = request.prData;
      if (!prData?.chunks || prData.chunks.length === 0) {
        return {
          success: false,
          error: 'No chunks to process'
        };
      }

      console.info(`Processing ${prData.chunks.length} chunks using ${request.provider} service`);

      const chunkResults: ChunkResult[] = [];

      // Process each chunk sequentially
      for (const chunk of prData.chunks) {
        const chunkRequest: TLLMRequest = {
          ...request,
          prData: {
            ...prData,
            diff: chunk.content,
            additionalContext: `Processing chunk ${chunk.index + 1} of ${chunk.totalChunks}. ${prData.additionalContext || ''}`
          }
        };

        try {
          const response = await service.generateDescription(chunkRequest);
          
          chunkResults.push({
            chunkIndex: chunk.index,
            success: response.success,
            description: response.data?.description || '',
            error: response.error
          });

          console.info(`Chunk ${chunk.index + 1}/${chunk.totalChunks} processed: ${response.success ? 'success' : 'failed'}`);
        } catch (error) {
          chunkResults.push({
            chunkIndex: chunk.index,
            success: false,
            description: '',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          console.error(`Chunk ${chunk.index + 1}/${chunk.totalChunks} failed:`, error);
        }
      }

      // Aggregate results
      const aggregatedResult = this.resultAggregator.aggregateResults(prData.chunks, chunkResults);

      if (!aggregatedResult.success) {
        return {
          success: false,
          error: `Failed to process chunked request: ${aggregatedResult.error}`
        };
      }

      return {
        success: true,
        data: {
          description: aggregatedResult.description,
          provider: request.provider,
          model: request.options?.model
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to process chunked request: ${error.message}`
      };
    }
  }

  async generateDescriptionStreamChunked(
    request: TLLMRequest, 
    onToken: (token: string) => void
  ): Promise<TLLMResponse> {
    try {
      const service = this.services.get(request.provider);
      if (!service) {
        return {
          success: false,
          error: `Unsupported LLM provider: ${request.provider}`
        };
      }

      const prData = request.prData;
      if (!prData?.chunks || prData.chunks.length === 0) {
        return {
          success: false,
          error: 'No chunks to process'
        };
      }

      console.info(`Streaming ${prData.chunks.length} chunks using ${request.provider} service`);

      const chunkResults: ChunkResult[] = [];

      // Process each chunk sequentially with streaming
      for (const chunk of prData.chunks) {
        const chunkRequest: TLLMRequest = {
          ...request,
          prData: {
            ...prData,
            diff: chunk.content,
            additionalContext: `Processing chunk ${chunk.index + 1} of ${chunk.totalChunks}. ${prData.additionalContext || ''}`
          }
        };

        try {
          let response: TLLMResponse;
          
          if (service.generateDescriptionWithCallback) {
            response = await service.generateDescriptionWithCallback(chunkRequest, onToken);
          } else {
            // Fallback to non-streaming
            response = await service.generateDescription(chunkRequest);
            if (response.success && response.data) {
              onToken(response.data.description);
            }
          }
          
          chunkResults.push({
            chunkIndex: chunk.index,
            success: response.success,
            description: response.data?.description || '',
            error: response.error
          });

          console.info(`Streamed chunk ${chunk.index + 1}/${chunk.totalChunks}: ${response.success ? 'success' : 'failed'}`);
        } catch (error) {
          chunkResults.push({
            chunkIndex: chunk.index,
            success: false,
            description: '',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          console.error(`Streaming chunk ${chunk.index + 1}/${chunk.totalChunks} failed:`, error);
        }
      }

      // Aggregate results
      const aggregatedResult = this.resultAggregator.aggregateResults(prData.chunks, chunkResults);

      if (!aggregatedResult.success) {
        return {
          success: false,
          error: `Failed to process streamed chunked request: ${aggregatedResult.error}`
        };
      }

      return {
        success: true,
        data: {
          description: aggregatedResult.description,
          provider: request.provider,
          model: request.options?.model
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to process streamed chunked request: ${error.message}`
      };
    }
  }

  static handleError(error: any, provider: TLLMProvider): TLLMResponse {
    let errorMessage = 'Unknown error occurred';
    
    if (error.response) {
      // API error response
      errorMessage = error.response.data?.error?.message || 
                    error.response.data?.message || 
                    `API error: ${error.response.status}`;
    } else if (error.request) {
      // Network error
      errorMessage = 'Network error: Unable to reach the LLM service';
    } else {
      // Other error
      errorMessage = error.message || errorMessage;
    }
    console.error(`Error from ${provider} service:`, errorMessage);
    return {
      success: false,
      error: `${provider} service error: ${errorMessage}`
    };
  }
}

// Re-export types for convenience
export type { TLLMProvider, TLLMRequest, TLLMResponse, ILLMService } from '../../types/llm-types';
