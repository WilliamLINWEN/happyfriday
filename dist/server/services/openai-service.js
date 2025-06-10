"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIService = void 0;
// OpenAI API integration
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const llm_types_1 = require("../../types/llm-types");
const llm_service_1 = require("./llm-service");
dotenv_1.default.config();
class OpenAIService {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY || '';
        this.baseURL = 'https://api.openai.com/v1';
        this.defaultModel = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    }
    async generateDescription(request) {
        try {
            const model = request.options?.model || this.defaultModel;
            const maxTokens = request.options?.maxTokens || 1000;
            const temperature = request.options?.temperature || 0.7;
            const prompt = llm_service_1.LLMService.formatPRDataForPrompt(request.prData);
            const response = await axios_1.default.post(`${this.baseURL}/chat/completions`, {
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
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
            });
            const responseData = response.data;
            const generatedText = responseData.choices[0]?.message?.content;
            if (!generatedText) {
                return {
                    success: false,
                    error: 'No response generated from OpenAI'
                };
            }
            const processedResponse = llm_service_1.LLMService.processLLMResponse(generatedText);
            return {
                success: true,
                data: {
                    description: processedResponse,
                    provider: llm_types_1.TLLMProvider.OPENAI,
                    model
                }
            };
        }
        catch (error) {
            return llm_service_1.LLMService.handleError(error, llm_types_1.TLLMProvider.OPENAI);
        }
    }
    async isAvailable() {
        if (!this.apiKey) {
            return false;
        }
        try {
            // Test API availability with a minimal request
            await axios_1.default.get(`${this.baseURL}/models`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                timeout: 5000, // 5 second timeout
            });
            return true;
        }
        catch (error) {
            return false;
        }
    }
    getProviderName() {
        return llm_types_1.TLLMProvider.OPENAI;
    }
}
exports.OpenAIService = OpenAIService;
