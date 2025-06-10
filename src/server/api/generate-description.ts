// API endpoint for PR description generation
import { Request, Response, NextFunction } from 'express';
import { fetchPullRequest, fetchPullRequestDiff } from '../services/bitbucket-service';
import { getLLMService } from '../services/llm-service-registry';
import { TLLMProvider, TLLMRequest } from '../../types/llm-types';
import { formatSuccessResponse, formatErrorResponse, formatValidationErrorResponse } from '../utils/response-formatter';
import { AppError, createValidationError, createServiceUnavailableError } from '../utils/error-handler';
import { validateGenerateDescriptionRequest } from '../utils/input-validator';
import { logInfo, logWarn } from '../utils/logger';

interface TGenerateDescriptionRequest {
  repository: string;
  prNumber: string;
  provider?: TLLMProvider;
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
}

export async function generateDescription(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const startTime = Date.now();

    // Validate request body
    const validationResult = validateGenerateDescriptionRequest(req.body);
    if (!validationResult.isValid) {
      res.status(400).json(formatValidationErrorResponse(validationResult.errors));
      return;
    }

    const { repository, prNumber, provider, options }: TGenerateDescriptionRequest = req.body;

    console.log(`Starting PR description generation for ${repository}#${prNumber}`);

    // Fetch PR details from Bitbucket
    const prResponse = await fetchPullRequest(repository, prNumber);
    if (!prResponse.success || !prResponse.data) {
      res.status(400).json(formatErrorResponse(prResponse.error || 'Failed to fetch PR details'));
      return;
    }

    // Fetch PR diff from Bitbucket
    const diffResponse = await fetchPullRequestDiff(repository, prNumber);
    if (!diffResponse.success || !diffResponse.data) {
      res.status(400).json(formatErrorResponse(diffResponse.error || 'Failed to fetch PR diff'));
      return;
    }

    const pr = prResponse.data;
    const diff = diffResponse.data.diff;

    // Get LLM service
    const llmService = getLLMService();
    
    // Determine which provider to use
    let selectedProvider = provider;
    if (!selectedProvider) {
      const availableProviders = await llmService.getAvailableProviders();
      if (availableProviders.length === 0) {
        res.status(503).json(formatErrorResponse('No LLM providers are currently available'));
        return;
      }
      selectedProvider = availableProviders[0]; // Use first available provider
    }

    // Prepare LLM request
    const llmRequest: TLLMRequest = {
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

    // Generate description using LLM
    const llmResponse = await llmService.generateDescription(llmRequest);
    if (!llmResponse.success || !llmResponse.data) {
      res.status(503).json(formatErrorResponse(llmResponse.error || 'Failed to generate description'));
      return;
    }

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    console.log(`PR description generated successfully in ${processingTime}ms using ${selectedProvider}`);

    // Return successful response
    res.status(200).json(formatSuccessResponse({
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

  } catch (error) {
    console.error('Error in generateDescription:', error);
    next(error);
  }
}
