// API endpoint for listing available templates
import { Request, Response, NextFunction } from 'express';
import { TemplateService } from '../services/template-service';
import { formatSuccessResponse, formatErrorResponse } from '../utils/response-formatter';
import { logInfo, logWarn } from '../utils/logger';

/**
 * Get all available templates with metadata
 */
export async function getTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    logInfo('Fetching available templates');

    const availableTemplates = TemplateService.getAvailableTemplates();
    
    if (!availableTemplates || availableTemplates.length === 0) {
      logWarn('No templates found');
      res.status(404).json(formatErrorResponse('No templates available'));
      return;
    }

    logInfo(`Found ${availableTemplates.length} available templates`);

    res.status(200).json(formatSuccessResponse({
      templates: availableTemplates,
      count: availableTemplates.length
    }, 'Templates retrieved successfully'));

  } catch (error) {
    console.error('Error in getTemplates:', error);
    next(error);
  }
}

/**
 * Get specific template metadata
 */
export async function getTemplateMetadata(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { templateName } = req.params;
    
    if (!templateName) {
      res.status(400).json(formatErrorResponse('Template name is required'));
      return;
    }

    logInfo(`Fetching metadata for template: ${templateName}`);

    const metadata = TemplateService.getTemplateMetadata(templateName);
    
    if (!metadata) {
      res.status(404).json(formatErrorResponse(`Template '${templateName}' not found`));
      return;
    }

    res.status(200).json(formatSuccessResponse({
      filename: templateName,
      metadata
    }, 'Template metadata retrieved successfully'));

  } catch (error) {
    console.error('Error in getTemplateMetadata:', error);
    next(error);
  }
}

/**
 * Validate template exists
 */
export async function validateTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { templateName } = req.params;
    
    if (!templateName) {
      res.status(400).json(formatErrorResponse('Template name is required'));
      return;
    }

    logInfo(`Validating template: ${templateName}`);

    const isValid = TemplateService.validateTemplate(templateName);
    
    res.status(200).json(formatSuccessResponse({
      templateName,
      isValid,
      exists: isValid
    }, `Template validation ${isValid ? 'passed' : 'failed'}`));

  } catch (error) {
    console.error('Error in validateTemplate:', error);
    next(error);
  }
}