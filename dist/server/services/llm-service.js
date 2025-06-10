"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMService = void 0;
// Base LLM service interface and implementation
const dotenv_1 = __importDefault(require("dotenv"));
const template_service_1 = require("./template-service");
dotenv_1.default.config();
class LLMService {
    constructor() {
        this.services = new Map();
        // Services will be registered dynamically to avoid circular dependencies
    }
    registerService(provider, service) {
        this.services.set(provider, service);
    }
    async generateDescription(request) {
        try {
            const service = this.services.get(request.provider);
            if (!service) {
                return {
                    success: false,
                    error: `Unsupported LLM provider: ${request.provider}`
                };
            }
            const isAvailable = await service.isAvailable();
            if (!isAvailable) {
                return {
                    success: false,
                    error: `${request.provider} service is not available. Please check your API credentials.`
                };
            }
            return await service.generateDescription(request);
        }
        catch (error) {
            return {
                success: false,
                error: `Failed to generate description: ${error.message}`
            };
        }
    }
    async getAvailableProviders() {
        const availableProviders = [];
        for (const [provider, service] of this.services) {
            try {
                const isAvailable = await service.isAvailable();
                if (isAvailable) {
                    availableProviders.push(provider);
                }
            }
            catch (error) {
                // Service is not available, skip it
                console.warn(`Provider ${provider} is not available:`, error);
            }
        }
        return availableProviders;
    }
    static formatPRDataForPrompt(prData) {
        return template_service_1.TemplateService.formatPRDataForPrompt(prData);
    }
    static processLLMResponse(response) {
        // Clean up and format the LLM response
        let cleanResponse = response.trim();
        // Remove any potential wrapper text that some LLMs might add
        if (cleanResponse.startsWith('Here is') || cleanResponse.startsWith('Here\'s')) {
            const lines = cleanResponse.split('\n');
            if (lines.length > 1) {
                cleanResponse = lines.slice(1).join('\n').trim();
            }
        }
        return cleanResponse;
    }
    static handleError(error, provider) {
        let errorMessage = 'Unknown error occurred';
        if (error.response) {
            // API error response
            errorMessage = error.response.data?.error?.message ||
                error.response.data?.message ||
                `API error: ${error.response.status}`;
        }
        else if (error.request) {
            // Network error
            errorMessage = 'Network error: Unable to reach the LLM service';
        }
        else {
            // Other error
            errorMessage = error.message || errorMessage;
        }
        console.error(`Error from ${provider} service:`, errorMessage);
        return {
            success: false,
            error: `${provider} service error: ${errorMessage}`
        };
    }
}
exports.LLMService = LLMService;
