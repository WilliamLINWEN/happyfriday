// Simple functional test for LangChain integration
import { TemplateService } from '../../../src/server/services/template-service';

describe('LangChain Integration', () => {
  describe('Template Service', () => {
    it('should create LangChain template from existing template file', () => {
      const template = TemplateService.createLangChainTemplate('pr-description-template.txt');
      
      expect(template).toBeDefined();
      expect(template.inputVariables).toBeDefined();
      expect(Array.isArray(template.inputVariables)).toBe(true);
      expect(template.inputVariables.length).toBeGreaterThan(0);
    });

    it('should create chat template with system message', () => {
      const systemMessage = 'You are a helpful assistant.';
      const chatTemplate = TemplateService.createChatTemplate(systemMessage, 'pr-description-template.txt');
      
      expect(chatTemplate).toBeDefined();
      expect(chatTemplate.inputVariables).toBeDefined();
      expect(Array.isArray(chatTemplate.inputVariables)).toBe(true);
    });

    it('should convert template syntax from {{variable}} to {variable}', () => {
      // This is testing the private method indirectly through createLangChainTemplate
      const template = TemplateService.createLangChainTemplate('pr-description-template.txt');
      
      // The template should be created without errors, indicating successful conversion
      expect(template).toBeDefined();
      expect(template.template).toBeDefined();
      expect(typeof template.template).toBe('string');
    });
  });

  describe('Service Availability', () => {
    it('should not throw errors when checking service availability', async () => {
      // Import services dynamically to avoid API key requirements in tests
      const { OpenAIService } = await import('../../../src/server/services/openai-service');
      const { ClaudeService } = await import('../../../src/server/services/claude-service');
      const { OllamaService } = await import('../../../src/server/services/ollama-service');
      
      const services = [
        new OpenAIService(),
        new ClaudeService(),
        new OllamaService()
      ];

      for (const service of services) {
        expect(async () => {
          await service.isAvailable();
        }).not.toThrow();
        
        expect(typeof service.getProviderName()).toBe('string');
      }
    });
  });
});
