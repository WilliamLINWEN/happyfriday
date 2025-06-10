// Ollama API integration
import axios from 'axios';
import dotenv from 'dotenv';
import { TLLMProvider, TLLMRequest, TLLMResponse, ILLMService } from '../../types/llm-types';
import { LLMService } from './llm-service';

dotenv.config();

export class OllamaService implements ILLMService {
  private baseURL: string;
  private defaultModel: string;

  constructor() {
    this.baseURL = process.env.OLLAMA_API_URL || 'http://localhost:11434';
    this.defaultModel = process.env.OLLAMA_MODEL || 'llama2';
  }

  async generateDescription(request: TLLMRequest): Promise<TLLMResponse> {
    try {
      const model = request.options?.model || this.defaultModel;
      const temperature = request.options?.temperature || 0.7;

      const prompt = LLMService.formatPRDataForPrompt(request.prData);
      console.log(`Generating description with Ollama model: ${model}`);
      const response = await axios.post(
        `${this.baseURL}/api/generate`,
        {
          model,
          prompt,
          stream: false,
          options: {
            temperature,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 60000, // 30 second timeout for Ollama
        }
      );

      const responseData = response.data as any;
      const generatedText = responseData.response;
      if (!generatedText) {
        return {
          success: false,
          error: 'No response generated from Ollama'
        };
      }

      const processedResponse = LLMService.processLLMResponse(generatedText);

      return {
        success: true,
        data: {
          description: processedResponse,
          provider: TLLMProvider.OLLAMA,
          model
        }
      };
    } catch (error: any) {
      return LLMService.handleError(error, TLLMProvider.OLLAMA);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Test API availability
      const response = await axios.get(`${this.baseURL}/api/tags`, {
        timeout: 5000, // 5 second timeout
      });
      
      // Check if any models are available
      const responseData = response.data as any;
      return responseData && responseData.models && responseData.models.length > 0;
    } catch (error) {
      return false;
    }
  }

  getProviderName(): TLLMProvider {
    return TLLMProvider.OLLAMA;
  }
}
