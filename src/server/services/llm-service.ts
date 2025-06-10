// Base LLM service interface and implementation
import dotenv from 'dotenv';
import { TLLMProvider, TLLMRequest, TLLMResponse, ILLMService, TLLMPromptData } from '../../types/llm-types';
import { TemplateService } from './template-service';

dotenv.config();

export class LLMService {
  private services: Map<TLLMProvider, ILLMService>;

  constructor() {
    this.services = new Map();
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

      return await service.generateDescription(request);
    } catch (error: any) {
      return {
        success: false,
        error: `Failed to generate description: ${error.message}`
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
