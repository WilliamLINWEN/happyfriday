import { getLLMService } from '../../../src/server/services/llm-service-registry';

describe('LLM Service', () => {
  it('should list available providers', async () => {
    const llmService = getLLMService();
    const providers = await llmService.getAvailableProviders();
    expect(Array.isArray(providers)).toBe(true);
  }, 10000);
  // Add more tests for LLM prompt formatting and error handling
});
