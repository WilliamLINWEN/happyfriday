// Claude API integration
import axios from 'axios';
import dotenv from 'dotenv';
import { TLLMProvider, TLLMRequest, TLLMResponse, ILLMService } from '../../types/llm-types';
import { LLMService } from './llm-service';

dotenv.config();

export class ClaudeService implements ILLMService {
  private apiKey: string;
  private baseURL: string;
  private defaultModel: string;

  constructor() {
    this.apiKey = process.env.CLAUDE_API_KEY || '';
    this.baseURL = 'https://api.anthropic.com/v1';
    this.defaultModel = 'claude-3-sonnet-20240229';
  }

  async generateDescription(request: TLLMRequest): Promise<TLLMResponse> {
    try {
      const model = request.options?.model || this.defaultModel;
      const maxTokens = request.options?.maxTokens || 1000;

      const prompt = LLMService.formatPRDataForPrompt(request.prData);

      const response = await axios.post(
        `${this.baseURL}/messages`,
        {
          model,
          max_tokens: maxTokens,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
        }
      );

      const responseData = response.data as any;
      const generatedText = responseData.content[0]?.text;
      if (!generatedText) {
        return {
          success: false,
          error: 'No response generated from Claude'
        };
      }

      const processedResponse = LLMService.processLLMResponse(generatedText);

      return {
        success: true,
        data: {
          description: processedResponse,
          provider: TLLMProvider.CLAUDE,
          model
        }
      };
    } catch (error: any) {
      return LLMService.handleError(error, TLLMProvider.CLAUDE);
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      // Test API availability with a minimal request
      await axios.post(
        `${this.baseURL}/messages`,
        {
          model: this.defaultModel,
          max_tokens: 1,
          messages: [
            {
              role: 'user',
              content: 'test'
            }
          ],
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
          },
          timeout: 5000, // 5 second timeout
        }
      );
      return true;
    } catch (error: any) {
      // If it's a 400 error with our test request, the API is available
      if (error.response?.status === 400) {
        return true;
      }
      return false;
    }
  }

  getProviderName(): TLLMProvider {
    return TLLMProvider.CLAUDE;
  }
}
