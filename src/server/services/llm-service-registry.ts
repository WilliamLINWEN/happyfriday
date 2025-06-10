// Service registry to initialize and manage all LLM services
import { LLMService } from './llm-service';
import { OpenAIService } from './openai-service';
import { ClaudeService } from './claude-service';
import { OllamaService } from './ollama-service';
import { TLLMProvider } from '../../types/llm-types';

export class LLMServiceRegistry {
  private static instance: LLMService | null = null;

  static getInstance(): LLMService {
    if (!this.instance) {
      this.instance = new LLMService();
      
      // Register all available services
      this.instance.registerService(TLLMProvider.OPENAI, new OpenAIService());
      this.instance.registerService(TLLMProvider.CLAUDE, new ClaudeService());
      this.instance.registerService(TLLMProvider.OLLAMA, new OllamaService());
    }
    
    return this.instance;
  }

  static reset(): void {
    this.instance = null;
  }
}

// Export convenience function for easy access
export function getLLMService(): LLMService {
  return LLMServiceRegistry.getInstance();
}
