"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheck = healthCheck;
exports.getAvailableProviders = getAvailableProviders;
const llm_service_registry_1 = require("../services/llm-service-registry");
const response_formatter_1 = require("../utils/response-formatter");
async function healthCheck(req, res, next) {
    try {
        const llmService = (0, llm_service_registry_1.getLLMService)();
        const availableProviders = await llmService.getAvailableProviders();
        const healthStatus = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            services: {
                llmProviders: availableProviders,
                totalProviders: availableProviders.length
            }
        };
        res.status(200).json((0, response_formatter_1.formatSuccessResponse)(healthStatus, 'System is healthy'));
    }
    catch (error) {
        console.error('Health check failed:', error);
        next(error);
    }
}
async function getAvailableProviders(req, res, next) {
    try {
        const llmService = (0, llm_service_registry_1.getLLMService)();
        const availableProviders = await llmService.getAvailableProviders();
        res.status(200).json((0, response_formatter_1.formatSuccessResponse)({
            providers: availableProviders,
            total: availableProviders.length
        }, 'Available LLM providers retrieved successfully'));
    }
    catch (error) {
        console.error('Error getting available providers:', error);
        next(error);
    }
}
