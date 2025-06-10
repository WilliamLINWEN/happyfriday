// API endpoint for PR description generation
import { Request, Response, NextFunction } from 'express';
import { fetchPullRequest, fetchPullRequestDiff, validateRepo, validatePrNumber } from '../services/bitbucket-service';
import { getLLMService } from '../services/llm-service-registry';
import { TLLMProvider, TLLMRequest } from '../../types/llm-types';
import { formatSuccessResponse, formatErrorResponse, formatValidationErrorResponse } from '../utils/response-formatter';
import { AppError, createValidationError, createServiceUnavailableError } from '../utils/error-handler';

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

function validateGenerateDescriptionRequest(body: any): string[] {
  const errors: string[] = [];

  if (!body.repository || typeof body.repository !== 'string') {
    errors.push('Repository is required and must be a string');
  } else if (!validateRepo(body.repository)) {
    errors.push('Repository must be in format "workspace/repo_slug"');
  }

  if (!body.prNumber || typeof body.prNumber !== 'string') {
    errors.push('PR number is required and must be a string');
  } else if (!validatePrNumber(body.prNumber)) {
    errors.push('PR number must be a valid number');
  }

  if (body.provider && !Object.values(TLLMProvider).includes(body.provider)) {
    errors.push('Provider must be one of: openai, claude, ollama');
  }

  if (body.options) {
    if (body.options.maxTokens && (typeof body.options.maxTokens !== 'number' || body.options.maxTokens < 1 || body.options.maxTokens > 4000)) {
      errors.push('maxTokens must be a number between 1 and 4000');
    }
    if (body.options.temperature && (typeof body.options.temperature !== 'number' || body.options.temperature < 0 || body.options.temperature > 2)) {
      errors.push('temperature must be a number between 0 and 2');
    }
  }

  return errors;
}

export async function generateDescription(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const startTime = Date.now();

    // Validate request body
    const validationErrors = validateGenerateDescriptionRequest(req.body);
    if (validationErrors.length > 0) {
      res.status(400).json(formatValidationErrorResponse(validationErrors));
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
