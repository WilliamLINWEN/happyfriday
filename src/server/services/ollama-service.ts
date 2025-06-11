import { ChatOllama } from '@langchain/ollama';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import axios from 'axios';
import dotenv from 'dotenv';
import { TLLMProvider, TLLMRequest, TLLMResponse, ILLMService } from '../../types/llm-types';
import { LLMService } from './llm-service';
import { TemplateService } from './template-service';

dotenv.config();

export class OllamaService implements ILLMService {
  private baseURL: string;
  private defaultModel: string;
  private llm: ChatOllama;

  constructor() {
    this.baseURL = process.env.OLLAMA_API_URL || 'http://localhost:11434';
    this.defaultModel = process.env.OLLAMA_MODEL || 'llama2';
    
    // Initialize LangChain ChatOllama instance
    this.llm = new ChatOllama({
      baseUrl: this.baseURL,
      model: this.defaultModel,
      temperature: 0.7
    });
  }

  async generateDescription(request: TLLMRequest): Promise<TLLMResponse> {
    try {
      const model = request.options?.model || this.defaultModel;
      const temperature = request.options?.temperature || 0.7;

      console.log(`Generating description with Ollama model: ${model}`);

      // Update LLM configuration if options provided
      const llm = new ChatOllama({
        baseUrl: this.baseURL,
        model,
        temperature
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
          error: 'No response generated from Ollama'
        };
      }

      // Process response using existing service method
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
      // Test API availability using direct HTTP call (keep existing logic)
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

  async generateDescriptionWithCallback(
    request: TLLMRequest,
    onToken?: (token: string) => void
  ): Promise<TLLMResponse> {
    if (!onToken) {
      return this.generateDescription(request);
    }

    try {
      const model = request.options?.model || this.defaultModel;
      const temperature = request.options?.temperature || 0.7;

      console.log(`Generating description with Ollama model: ${model} (streaming)`);

      // Create streaming LLM
      const streamingLLM = new ChatOllama({
        baseUrl: this.baseURL,
        model,
        temperature
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
          error: 'No response generated from Ollama'
        };
      }

      // Process response using existing service method
      const processedResponse = LLMService.processLLMResponse(fullContent);

      return {
        success: true,
        data: {
          description: processedResponse,
          provider: TLLMProvider.OLLAMA,
          model
        }
      };
    } catch (error: any) {
      console.error('OllamaService streaming error:', error);
      return LLMService.handleError(error, TLLMProvider.OLLAMA);
    }
  }
}
