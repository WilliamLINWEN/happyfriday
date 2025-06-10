"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeService = void 0;
// Claude API integration
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const llm_types_1 = require("../../types/llm-types");
const llm_service_1 = require("./llm-service");
dotenv_1.default.config();
class ClaudeService {
    constructor() {
        this.apiKey = process.env.CLAUDE_API_KEY || '';
        this.baseURL = 'https://api.anthropic.com/v1';
        this.defaultModel = 'claude-3-sonnet-20240229';
    }
    async generateDescription(request) {
        try {
            const model = request.options?.model || this.defaultModel;
            const maxTokens = request.options?.maxTokens || 1000;
            const prompt = llm_service_1.LLMService.formatPRDataForPrompt(request.prData);
            const response = await axios_1.default.post(`${this.baseURL}/messages`, {
                model,
                max_tokens: maxTokens,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
            }, {
                headers: {
                    'x-api-key': this.apiKey,
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                },
            });
            const responseData = response.data;
            const generatedText = responseData.content[0]?.text;
            if (!generatedText) {
                return {
                    success: false,
                    error: 'No response generated from Claude'
                };
            }
            const processedResponse = llm_service_1.LLMService.processLLMResponse(generatedText);
            return {
                success: true,
                data: {
                    description: processedResponse,
                    provider: llm_types_1.TLLMProvider.CLAUDE,
                    model
                }
            };
        }
        catch (error) {
            return llm_service_1.LLMService.handleError(error, llm_types_1.TLLMProvider.CLAUDE);
        }
    }
    async isAvailable() {
        if (!this.apiKey) {
            return false;
        }
        try {
            // Test API availability with a minimal request
            await axios_1.default.post(`${this.baseURL}/messages`, {
                model: this.defaultModel,
                max_tokens: 1,
                messages: [
                    {
                        role: 'user',
                        content: 'test'
                    }
                ],
            }, {
                headers: {
                    'x-api-key': this.apiKey,
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                },
                timeout: 5000, // 5 second timeout
            });
            return true;
        }
        catch (error) {
            // If it's a 400 error with our test request, the API is available
            if (error.response?.status === 400) {
                return true;
            }
            return false;
        }
    }
    getProviderName() {
        return llm_types_1.TLLMProvider.CLAUDE;
    }
}
exports.ClaudeService = ClaudeService;
