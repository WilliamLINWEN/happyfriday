import { ChatAnthropic } from '@langchain/anthropic';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import dotenv from 'dotenv';
import { TLLMProvider, TLLMRequest, TLLMResponse, ILLMService } from '../../types/llm-types';
import { LLMService } from './llm-service';
import { TemplateService } from './template-service';

dotenv.config();

export class ClaudeService implements ILLMService {
  private apiKey: string;
  private defaultModel: string;
  private llm: ChatAnthropic;

  constructor() {
    this.apiKey = process.env.CLAUDE_API_KEY || '';
    this.defaultModel = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
    
    // Initialize LangChain ChatAnthropic instance
    this.llm = new ChatAnthropic({
      apiKey: this.apiKey,
      model: this.defaultModel,
      temperature: 0.7,
      maxTokens: 1000
    });
  }

  async generateDescription(request: TLLMRequest): Promise<TLLMResponse> {
    try {
      const model = request.options?.model || this.defaultModel;
      const maxTokens = request.options?.maxTokens || 1000;
      const temperature = request.options?.temperature || 0.7;

      // Update LLM configuration if options provided
      const llm = new ChatAnthropic({
        apiKey: this.apiKey,
        model,
        temperature,
        maxTokens
      });

      // Use enhanced template service with LangChain integration
      const systemMessage = 'You are a helpful assistant that generates comprehensive pull request descriptions based on code changes and PR information.';
      const templateName = request.template || 'pr-description-template-zh.txt';
      const chatTemplate = TemplateService.createChatTemplate(systemMessage, templateName);

      // Create the chain: PromptTemplate -> LLM -> StringOutputParser
      const chain = chatTemplate.pipe(llm).pipe(new StringOutputParser());

      // Prepare template variables
      const templateVariables = {
        title: request.prData.title,
        description: request.prData.description || '無描述提供',
        author: request.prData.author,
        repository: request.prData.repository,
        sourceBranch: request.prData.sourceBranch,
        destinationBranch: request.prData.destinationBranch,
        diff: request.prData.diff,
        additionalContext: request.prData.additionalContext || ''
      };

      // Execute the chain
      const generatedText = await chain.invoke(templateVariables);

      if (!generatedText) {
        return {
          success: false,
          error: 'No response generated from Claude'
        };
      }

      // Process response using existing service method
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
      // Test API availability using LangChain
      const testLLM = new ChatAnthropic({
        apiKey: this.apiKey,
        model: this.defaultModel,
        maxTokens: 1
      });

      // Simple test prompt
      await testLLM.invoke([{ role: 'user', content: 'test' }]);
      return true;
    } catch (error: any) {
      // If it's a 400 error with our test request, the API is available
      if (error?.status === 400 || error?.code === 400) {
        return true;
      }
      return false;
    }
  }

  getProviderName(): TLLMProvider {
    return TLLMProvider.CLAUDE;
  }

  async generateDescriptionWithCallback(
    request: TLLMRequest,
    onToken?: (token: string) => void
  ): Promise<TLLMResponse> {
    if (!onToken) {
      return this.generateDescription(request);
    }

    try {
      const model = request.options?.model || this.defaultModel;
      const maxTokens = request.options?.maxTokens || 1000;
      const temperature = request.options?.temperature || 0.7;

      // Create streaming LLM
      const streamingLLM = new ChatAnthropic({
        apiKey: this.apiKey,
        model,
        temperature,
        maxTokens,
        streaming: true
      });

      // Use enhanced template service with LangChain integration
      const systemMessage = 'You are a helpful assistant that generates comprehensive pull request descriptions based on code changes and PR information.';
      const templateName = request.template || 'pr-description-template-zh.txt';
      const chatTemplate = TemplateService.createChatTemplate(systemMessage, templateName);

      // Create the chain: PromptTemplate -> LLM -> StringOutputParser
      const chain = chatTemplate.pipe(streamingLLM).pipe(new StringOutputParser());

      // Prepare template variables
      const templateVariables = {
        title: request.prData.title,
        description: request.prData.description || '無描述提供',
        author: request.prData.author,
        repository: request.prData.repository,
        sourceBranch: request.prData.sourceBranch,
        destinationBranch: request.prData.destinationBranch,
        diff: request.prData.diff,
        additionalContext: request.prData.additionalContext || ''
      };

      let fullContent = '';
      
      // Use streaming with callback
      const stream = await chain.stream(templateVariables);
      
      for await (const chunk of stream) {
        fullContent += chunk;
        onToken(chunk);
      }

      if (!fullContent) {
        return {
          success: false,
          error: 'No response generated from Claude'
        };
      }

      // Process response using existing service method
      const processedResponse = LLMService.processLLMResponse(fullContent);

      return {
        success: true,
        data: {
          description: processedResponse,
          provider: TLLMProvider.CLAUDE,
          model
        }
      };
    } catch (error: any) {
      console.error('ClaudeService streaming error:', error);
      return LLMService.handleError(error, TLLMProvider.CLAUDE);
    }
  }
}
