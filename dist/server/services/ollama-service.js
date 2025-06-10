"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaService = void 0;
// Ollama API integration
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const llm_types_1 = require("../../types/llm-types");
const llm_service_1 = require("./llm-service");
dotenv_1.default.config();
class OllamaService {
    constructor() {
        this.baseURL = process.env.OLLAMA_API_URL || 'http://localhost:11434';
        this.defaultModel = process.env.OLLAMA_MODEL || 'llama2';
    }
    async generateDescription(request) {
        try {
            const model = request.options?.model || this.defaultModel;
            const temperature = request.options?.temperature || 0.7;
            const prompt = llm_service_1.LLMService.formatPRDataForPrompt(request.prData);
            const response = await axios_1.default.post(`${this.baseURL}/api/generate`, {
                model,
                prompt,
                stream: false,
                options: {
                    temperature,
                },
            }, {
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: 30000, // 30 second timeout for Ollama
            });
            const responseData = response.data;
            const generatedText = responseData.response;
            if (!generatedText) {
                return {
                    success: false,
                    error: 'No response generated from Ollama'
                };
            }
            const processedResponse = llm_service_1.LLMService.processLLMResponse(generatedText);
            return {
                success: true,
                data: {
                    description: processedResponse,
                    provider: llm_types_1.TLLMProvider.OLLAMA,
                    model
                }
            };
        }
        catch (error) {
            return llm_service_1.LLMService.handleError(error, llm_types_1.TLLMProvider.OLLAMA);
        }
    }
    async isAvailable() {
        try {
            // Test API availability
            const response = await axios_1.default.get(`${this.baseURL}/api/tags`, {
                timeout: 5000, // 5 second timeout
            });
            // Check if any models are available
            const responseData = response.data;
            return responseData && responseData.models && responseData.models.length > 0;
        }
        catch (error) {
            return false;
        }
    }
    getProviderName() {
        return llm_types_1.TLLMProvider.OLLAMA;
    }
}
exports.OllamaService = OllamaService;
