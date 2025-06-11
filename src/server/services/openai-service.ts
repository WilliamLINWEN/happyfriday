import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import dotenv from 'dotenv';
import { TLLMProvider, TLLMRequest, TLLMResponse, ILLMService } from '../../types/llm-types';
import { LLMService } from './llm-service';
import { TemplateService } from './template-service';

dotenv.config();

export class OpenAIService implements ILLMService {
  private apiKey: string;
  private defaultModel: string;
  private llm: ChatOpenAI;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.defaultModel = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    
    // Initialize LangChain ChatOpenAI instance
    this.llm = new ChatOpenAI({
      apiKey: this.apiKey,
      model: this.defaultModel,
      temperature: 0.7,
      maxTokens: 1000,
      streaming: false
    });
  }

  async generateDescription(request: TLLMRequest): Promise<TLLMResponse> {
    try {
      const model = request.options?.model || this.defaultModel;
      const maxTokens = request.options?.maxTokens || 1000;
      const temperature = request.options?.temperature || 0.7;

      // Update LLM configuration if options provided
      const llm = new ChatOpenAI({
        apiKey: this.apiKey,
        model,
        temperature,
        maxTokens,
        streaming: false
      });

      // Use enhanced template service with LangChain integration
      const systemMessage = 'You are a helpful assistant that generates comprehensive pull request descriptions based on code changes and PR information.';
      const chatTemplate = TemplateService.createChatTemplate(systemMessage, 'pr-description-template.txt');

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
        diff: request.prData.diff
      };

      // Execute the chain
      const generatedText = await chain.invoke(templateVariables);

      if (!generatedText) {
        return {
          success: false,
          error: 'No response generated from OpenAI'
        };
      }

      // Process response using existing service method
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
      console.error('OpenAIService error:', error);
      return LLMService.handleError(error, TLLMProvider.OPENAI);
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      // Test API availability using LangChain
      const testLLM = new ChatOpenAI({
        apiKey: this.apiKey,
        model: this.defaultModel,
        maxTokens: 1,
        timeout: 5000
      });

      // Simple test prompt
      await testLLM.invoke([{ role: 'user', content: 'test' }]);
      return true;
    } catch (error) {
      return false;
    }
  }

  getProviderName(): TLLMProvider {
    return TLLMProvider.OPENAI;
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
      const streamingLLM = new ChatOpenAI({
        apiKey: this.apiKey,
        model,
        temperature,
        maxTokens,
        streaming: true
      });

      // Use enhanced template service with LangChain integration
      const systemMessage = 'You are a helpful assistant that generates comprehensive pull request descriptions based on code changes and PR information.';
      const chatTemplate = TemplateService.createChatTemplate(systemMessage, 'pr-description-template.txt');

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
        diff: request.prData.diff
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
          error: 'No response generated from OpenAI'
        };
      }

      // Process response using existing service method
      const processedResponse = LLMService.processLLMResponse(fullContent);

      return {
        success: true,
        data: {
          description: processedResponse,
          provider: TLLMProvider.OPENAI,
          model
        }
      };
    } catch (error: any) {
      console.error('OpenAIService streaming error:', error);
      return LLMService.handleError(error, TLLMProvider.OPENAI);
    }
  }
}
