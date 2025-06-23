// API endpoint for PR description generation
import { Request, Response, NextFunction } from 'express';
import { fetchPullRequest, fetchPullRequestDiff } from '../services/bitbucket-service';
import { getLLMService } from '../services/llm-service-registry';
import { TemplateService } from '../services/template-service';
import { TLLMProvider, TLLMRequest } from '../../types/llm-types';
import { formatSuccessResponse, formatErrorResponse, formatValidationErrorResponse } from '../utils/response-formatter';
import { AppError, createValidationError, createServiceUnavailableError } from '../utils/error-handler';
import { validateGenerateDescriptionRequest } from '../utils/input-validator';
import { logInfo, logWarn } from '../utils/logger';
import { BitbucketUrlParser } from '../utils/url-parser';

interface TGenerateDescriptionRequest {
  // New URL-based format
  prUrl?: string;
  // Legacy format (for backward compatibility)
  repository?: string;
  prNumber?: string;
  // Common fields
  provider?: TLLMProvider;
  template?: string;
  additionalContext?: string;
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
}

/**
 * Parse request to extract repository and PR number from either URL or legacy format
 */
function parseRequestInput(body: TGenerateDescriptionRequest): { repository: string; prNumber: string; error?: string } {
  const { prUrl, repository, prNumber } = body;

  // If PR URL is provided, parse it
  if (prUrl) {
    const parsed = BitbucketUrlParser.parsePRUrl(prUrl);
    if (!parsed.isValid) {
      return { repository: '', prNumber: '', error: parsed.error };
    }
    return {
      repository: BitbucketUrlParser.formatRepositoryString(parsed.workspace, parsed.repository),
      prNumber: parsed.prNumber
    };
  }

  // Fall back to legacy format
  if (repository && prNumber) {
    return { repository, prNumber };
  }

  // Neither format provided
  return {
    repository: '',
    prNumber: '',
    error: 'Please provide either a PR URL (prUrl) or repository and PR number (repository, prNumber)'
  };
}

export async function generateDescription(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const startTime = Date.now();

    // Parse request input (URL or legacy format)
    const inputResult = parseRequestInput(req.body);
    if (inputResult.error) {
      res.status(400).json(formatErrorResponse(inputResult.error));
      return;
    }

    const { repository, prNumber } = inputResult;
    const { provider, template, additionalContext, options }: TGenerateDescriptionRequest = req.body;

    // Validate template if provided
    if (template && !TemplateService.validateTemplate(template)) {
      res.status(400).json(formatErrorResponse(`Invalid template: ${template}`));
      return;
    }

    console.log(`Starting PR description generation for ${repository}#${prNumber}${template ? ` with template: ${template}` : ''}`);

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
        repository: pr.source.repository.full_name,
        additionalContext: additionalContext || ''
      },
      template,
      options
    };
    console.log(`Using LLM provider: ${selectedProvider}`);
    console.log(`LLM request prepared for PR ${prNumber} in repository ${repository}`);
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

export async function generateDescriptionStream(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const startTime = Date.now();

    // Parse request input (URL or legacy format)
    const inputResult = parseRequestInput(req.body);
    if (inputResult.error) {
      res.status(400).json(formatErrorResponse(inputResult.error));
      return;
    }

    const { repository, prNumber } = inputResult;
    const { provider, template, additionalContext, options }: TGenerateDescriptionRequest = req.body;

    // Validate template if provided
    if (template && !TemplateService.validateTemplate(template)) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: `Invalid template: ${template}` })}\n\n`);
      res.end();
      return;
    }

    console.log(`Starting streaming PR description generation for ${repository}#${prNumber}${template ? ` with template: ${template}` : ''}`);

    // Set up Server-Sent Events headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Helper function to send SSE data
    const sendSSE = (event: string, data: any) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Fetch PR details from Bitbucket
    const prResponse = await fetchPullRequest(repository, prNumber);
    if (!prResponse.success || !prResponse.data) {
      sendSSE('error', { error: prResponse.error || 'Failed to fetch PR details' });
      res.end();
      return;
    }

    // Fetch PR diff from Bitbucket
    const diffResponse = await fetchPullRequestDiff(repository, prNumber);
    if (!diffResponse.success || !diffResponse.data) {
      sendSSE('error', { error: diffResponse.error || 'Failed to fetch PR diff' });
      res.end();
      return;
    }

    const pr = prResponse.data;
    const diff = diffResponse.data.diff;

    // Send initial data
    sendSSE('start', {
      originalPR: {
        title: pr.title,
        description: pr.description,
        author: pr.author.display_name,
        sourceBranch: pr.source.branch.name,
        destinationBranch: pr.destination.branch.name,
        repository: pr.source.repository.full_name,
        url: pr.links.html.href
      }
    });

    // Get LLM service
    const llmService = getLLMService();
    
    // Determine which provider to use
    let selectedProvider = provider;
    if (!selectedProvider) {
      const availableProviders = await llmService.getAvailableProviders();
      if (availableProviders.length === 0) {
        sendSSE('error', { error: 'No LLM providers are currently available' });
        res.end();
        return;
      }
      selectedProvider = availableProviders[0];
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
        repository: pr.source.repository.full_name,
        additionalContext: additionalContext || ''
      },
      template,
      options
    };

    console.log(`Using LLM provider: ${selectedProvider} for streaming`);

    let generatedContent = '';

    // Generate description using streaming LLM
    const llmResponse = await llmService.generateDescriptionStream(llmRequest, (token: string) => {
      generatedContent += token;
      sendSSE('token', { 
        token: token,
        content: generatedContent 
      });
    });

    if (!llmResponse.success || !llmResponse.data) {
      sendSSE('error', { error: llmResponse.error || 'Failed to generate description' });
      res.end();
      return;
    }

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    console.log(`Streaming PR description generated successfully in ${processingTime}ms using ${selectedProvider}`);

    // Send completion event
    sendSSE('complete', {
      generatedDescription: llmResponse.data.description,
      metadata: {
        provider: llmResponse.data.provider,
        model: llmResponse.data.model,
        processingTimeMs: processingTime,
        diffSize: diff.length
      }
    });

    res.end();

  } catch (error) {
    console.error('Error in generateDescriptionStream:', error);
    
    // Try to send error via SSE if headers haven't been sent
    if (!res.headersSent) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
    }
    
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({ error: 'Internal server error' })}\n\n`);
    res.end();
  }
}
