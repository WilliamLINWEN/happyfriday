"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMServiceRegistry = void 0;
exports.getLLMService = getLLMService;
// Service registry to initialize and manage all LLM services
const llm_service_1 = require("./llm-service");
const openai_service_1 = require("./openai-service");
const claude_service_1 = require("./claude-service");
const ollama_service_1 = require("./ollama-service");
const llm_types_1 = require("../../types/llm-types");
class LLMServiceRegistry {
    static getInstance() {
        if (!this.instance) {
            this.instance = new llm_service_1.LLMService();
            // Register all available services
            this.instance.registerService(llm_types_1.TLLMProvider.OPENAI, new openai_service_1.OpenAIService());
            this.instance.registerService(llm_types_1.TLLMProvider.CLAUDE, new claude_service_1.ClaudeService());
            this.instance.registerService(llm_types_1.TLLMProvider.OLLAMA, new ollama_service_1.OllamaService());
        }
        return this.instance;
    }
    static reset() {
        this.instance = null;
    }
}
exports.LLMServiceRegistry = LLMServiceRegistry;
LLMServiceRegistry.instance = null;
// Export convenience function for easy access
function getLLMService() {
    return LLMServiceRegistry.getInstance();
}
