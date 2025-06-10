"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDescription = generateDescription;
const bitbucket_service_1 = require("../services/bitbucket-service");
const llm_service_registry_1 = require("../services/llm-service-registry");
const response_formatter_1 = require("../utils/response-formatter");
const input_validator_1 = require("../utils/input-validator");
async function generateDescription(req, res, next) {
    try {
        const startTime = Date.now();
        // Validate request body
        const validationResult = (0, input_validator_1.validateGenerateDescriptionRequest)(req.body);
        if (!validationResult.isValid) {
            res.status(400).json((0, response_formatter_1.formatValidationErrorResponse)(validationResult.errors));
            return;
        }
        const { repository, prNumber, provider, options } = req.body;
        console.log(`Starting PR description generation for ${repository}#${prNumber}`);
        // Fetch PR details from Bitbucket
        const prResponse = await (0, bitbucket_service_1.fetchPullRequest)(repository, prNumber);
        if (!prResponse.success || !prResponse.data) {
            res.status(400).json((0, response_formatter_1.formatErrorResponse)(prResponse.error || 'Failed to fetch PR details'));
            return;
        }
        // Fetch PR diff from Bitbucket
        const diffResponse = await (0, bitbucket_service_1.fetchPullRequestDiff)(repository, prNumber);
        if (!diffResponse.success || !diffResponse.data) {
            res.status(400).json((0, response_formatter_1.formatErrorResponse)(diffResponse.error || 'Failed to fetch PR diff'));
            return;
        }
        const pr = prResponse.data;
        const diff = diffResponse.data.diff;
        // Get LLM service
        const llmService = (0, llm_service_registry_1.getLLMService)();
        // Determine which provider to use
        let selectedProvider = provider;
        if (!selectedProvider) {
            const availableProviders = await llmService.getAvailableProviders();
            if (availableProviders.length === 0) {
                res.status(503).json((0, response_formatter_1.formatErrorResponse)('No LLM providers are currently available'));
                return;
            }
            selectedProvider = availableProviders[0]; // Use first available provider
        }
        // Prepare LLM request
        const llmRequest = {
            provider: selectedProvider,
            prData: {
                title: pr.title,
                description: pr.description || '',
                diff: diff,
                author: pr.author.display_name,
                sourceBranch: pr.source.branch.name,
                destinationBranch: pr.destination.branch.name,
                repository: pr.source.repository.full_name
            },
            options
        };
        console.log(`Using LLM provider: ${selectedProvider}`);
        console.log(`LLM request prepared for PR ${prNumber} in repository ${repository}`);
        // Generate description using LLM
        const llmResponse = await llmService.generateDescription(llmRequest);
        if (!llmResponse.success || !llmResponse.data) {
            res.status(503).json((0, response_formatter_1.formatErrorResponse)(llmResponse.error || 'Failed to generate description'));
            return;
        }
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        console.log(`PR description generated successfully in ${processingTime}ms using ${selectedProvider}`);
        // Return successful response
        res.status(200).json((0, response_formatter_1.formatSuccessResponse)({
            generatedDescription: llmResponse.data.description,
            originalPR: {
                title: pr.title,
                description: pr.description,
                author: pr.author.display_name,
                sourceBranch: pr.source.branch.name,
                destinationBranch: pr.destination.branch.name,
                repository: pr.source.repository.full_name,
                url: pr.links.html.href
            },
            metadata: {
                provider: llmResponse.data.provider,
                model: llmResponse.data.model,
                processingTimeMs: processingTime,
                diffSize: diff.length
            }
        }, 'PR description generated successfully'));
    }
    catch (error) {
        console.error('Error in generateDescription:', error);
        next(error);
    }
}
