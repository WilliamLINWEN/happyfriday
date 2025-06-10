// OpenAI API integration
import axios from 'axios';
import dotenv from 'dotenv';
import { TLLMProvider, TLLMRequest, TLLMResponse, ILLMService } from '../../types/llm-types';
import { LLMService } from './llm-service';

dotenv.config();

export class OpenAIService implements ILLMService {
  private apiKey: string;
  private baseURL: string;
  private defaultModel: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.baseURL = 'https://api.openai.com/v1';
    this.defaultModel = 'gpt-3.5-turbo';
  }

  async generateDescription(request: TLLMRequest): Promise<TLLMResponse> {
    try {
      const model = request.options?.model || this.defaultModel;
      const maxTokens = request.options?.maxTokens || 1000;
      const temperature = request.options?.temperature || 0.7;

      const prompt = LLMService.formatPRDataForPrompt(request.prData);

      const response = await axios.post(
        `${this.baseURL}/chat/completions`,
        {
          model,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that generates comprehensive pull request descriptions based on code changes and PR information.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: maxTokens,
          temperature,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const responseData = response.data as any;
      const generatedText = responseData.choices[0]?.message?.content;
      if (!generatedText) {
        return {
          success: false,
          error: 'No response generated from OpenAI'
        };
      }

      const processedResponse = LLMService.processLLMResponse(generatedText);

      return {
        success: true,
        data: {
          description: processedResponse,
          provider: TLLMProvider.OPENAI,
          model
        }
      };
    } catch (error: any) {
      return LLMService.handleError(error, TLLMProvider.OPENAI);
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      // Test API availability with a minimal request
      await axios.get(`${this.baseURL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        timeout: 5000, // 5 second timeout
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  getProviderName(): TLLMProvider {
    return TLLMProvider.OPENAI;
  }
}
