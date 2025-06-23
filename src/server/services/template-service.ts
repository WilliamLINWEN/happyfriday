import fs from 'fs';
import path from 'path';
import { PromptTemplate } from '@langchain/core/prompts';
import { TLLMPromptData } from '../../types/llm-types';

export interface TemplateMetadata {
  name: string;
  description: string;
  language: string;
  category: 'description' | 'review';
}

export interface AvailableTemplate {
  filename: string;
  metadata: TemplateMetadata;
}

export class TemplateService {
  private static templateCache: Map<string, string> = new Map();
  private static langchainTemplateCache: Map<string, PromptTemplate> = new Map();
  private static metadataCache: Map<string, TemplateMetadata> | null = null;
  private static readonly DEFAULT_TEMPLATE = 'pr-description-template-zh.txt';

  /**
   * Get all possible template paths
   */
  private static getTemplatePaths(templateName?: string): string[] {
    const basePaths = [
      // 生產環境路徑 (編譯後)
      path.join(__dirname, '..', '..', 'templates'),
      // 開發環境路徑 (ts-node)
      path.join(__dirname, '..', '..', '..', 'src', 'templates'),
      // 相對於當前工作目錄
      path.join(process.cwd(), 'src', 'templates'),
      path.join(process.cwd(), 'dist', 'templates')
    ];

    if (templateName) {
      return basePaths.map(basePath => path.join(basePath, templateName));
    }
    return basePaths;
  }

  /**
   * Find the first existing template directory
   */
  private static findTemplateDirectory(): string | null {
    const basePaths = this.getTemplatePaths();
    for (const templatePath of basePaths) {
      try {
        if (fs.existsSync(templatePath) && fs.statSync(templatePath).isDirectory()) {
          return templatePath;
        }
      } catch (error) {
        continue;
      }
    }
    return null;
  }

  /**
   * 讀取模板文件內容
   */
  private static readTemplate(templateName: string): string {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    // 嘗試多個可能的路徑
    const possiblePaths = this.getTemplatePaths(templateName);

    let content: string | null = null;
    let lastError: Error | null = null;

    for (const templatePath of possiblePaths) {
      try {
        content = fs.readFileSync(templatePath, 'utf-8');
        console.log(`Template loaded from: ${templatePath}`);
        break;
      } catch (error) {
        lastError = error as Error;
        continue;
      }
    }

    if (content === null) {
      throw new Error(`Failed to find template file: ${templateName}. Tried paths: ${possiblePaths.join(', ')}. Last error: ${lastError?.message}`);
    }

    this.templateCache.set(templateName, content);
    return content;
  }

  /**
   * 替換模板中的變數
   */
  private static replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), value || '');
    }
    
    return result;
  }

  /**
   * Convert template with {{variable}} syntax to LangChain {variable} syntax
   */
  private static convertToLangChainSyntax(template: string): string {
    // Convert {{variable}} to {variable} for LangChain compatibility
    return template.replace(/\{\{(\w+)\}\}/g, '{$1}');
  }

  /**
   * Create a LangChain PromptTemplate from existing template file
   */
  static createLangChainTemplate(templateName: string): PromptTemplate {
    const cacheKey = templateName;
    
    if (this.langchainTemplateCache.has(cacheKey)) {
      return this.langchainTemplateCache.get(cacheKey)!;
    }

    const originalTemplate = this.readTemplate(templateName);
    const langchainTemplate = this.convertToLangChainSyntax(originalTemplate);
    
    // Extract variable names from the template
    const variableMatches = originalTemplate.match(/\{\{(\w+)\}\}/g) || [];
    const inputVariables = variableMatches.map(match => match.replace(/[{}]/g, ''));
    
    const promptTemplate = new PromptTemplate({
      template: langchainTemplate,
      inputVariables: [...new Set(inputVariables)] // Remove duplicates
    });

    this.langchainTemplateCache.set(cacheKey, promptTemplate);
    return promptTemplate;
  }

  /**
   * Get available templates with metadata
   */
  static getAvailableTemplates(): AvailableTemplate[] {
    const templateDir = this.findTemplateDirectory();
    if (!templateDir) {
      console.warn('No template directory found, using default template');
      return [{
        filename: this.DEFAULT_TEMPLATE,
        metadata: {
          name: '標準 PR 描述 (中文)',
          description: '預設的 PR 描述模板',
          language: 'zh',
          category: 'description'
        }
      }];
    }

    try {
      // Load metadata
      const metadataPath = path.join(templateDir, 'templates.json');
      let metadata: Record<string, TemplateMetadata> = {};
      
      if (fs.existsSync(metadataPath)) {
        const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
        metadata = JSON.parse(metadataContent);
        this.metadataCache = new Map(Object.entries(metadata));
      }

      // Get all .txt files in template directory
      const templateFiles = fs.readdirSync(templateDir)
        .filter(file => file.endsWith('.txt'))
        .sort();

      return templateFiles.map(filename => {
        const templateMetadata = metadata[filename] || {
          name: filename.replace('.txt', '').replace(/-/g, ' '),
          description: 'Template file',
          language: 'unknown',
          category: filename.includes('review') ? 'review' as const : 'description' as const
        };

        return {
          filename,
          metadata: templateMetadata
        };
      });
    } catch (error) {
      console.error('Error loading templates:', error);
      return [{
        filename: this.DEFAULT_TEMPLATE,
        metadata: {
          name: '標準 PR 描述 (中文)',
          description: '預設的 PR 描述模板',
          language: 'zh',
          category: 'description'
        }
      }];
    }
  }

  /**
   * Get template metadata by filename
   */
  static getTemplateMetadata(templateName: string): TemplateMetadata | null {
    if (this.metadataCache && this.metadataCache.has(templateName)) {
      return this.metadataCache.get(templateName)!;
    }

    // Try to load metadata if not cached
    const availableTemplates = this.getAvailableTemplates();
    const template = availableTemplates.find(t => t.filename === templateName);
    return template?.metadata || null;
  }

  /**
   * Validate if template exists
   */
  static validateTemplate(templateName: string): boolean {
    if (!templateName) return false;
    
    try {
      this.readTemplate(templateName);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 格式化 PR 數據為 LLM prompt
   */
  static formatPRDataForPrompt(prData: TLLMPromptData, templateName?: string): string {
    const template = this.readTemplate(templateName || this.DEFAULT_TEMPLATE);
    
    const variables = {
      title: prData.title,
      description: prData.description || (templateName?.includes('-en.txt') ? 'No description provided' : '無描述提供'),
      author: prData.author,
      repository: prData.repository,
      sourceBranch: prData.sourceBranch,
      destinationBranch: prData.destinationBranch,
      diff: prData.diff,
      additionalContext: prData.additionalContext || ''
    };

    return this.replaceVariables(template, variables);
  }

  /**
   * Format PR data for LangChain using PromptTemplate
   */
  static async formatPRDataForLangChain(prData: TLLMPromptData, templateName?: string): Promise<string> {
    const promptTemplate = this.createLangChainTemplate(templateName || this.DEFAULT_TEMPLATE);
    
    const variables = {
      title: prData.title,
      description: prData.description || (templateName?.includes('-en.txt') ? 'No description provided' : '無描述提供'),
      author: prData.author,
      repository: prData.repository,
      sourceBranch: prData.sourceBranch,
      destinationBranch: prData.destinationBranch,
      diff: prData.diff,
      additionalContext: prData.additionalContext || ''
    };

    return await promptTemplate.format(variables);
  }

  /**
   * Create a system + user message template for LangChain chat models
   */
  static createChatTemplate(systemMessage: string, templateName: string): PromptTemplate {
    const userTemplate = this.readTemplate(templateName);
    const langchainUserTemplate = this.convertToLangChainSyntax(userTemplate);
    
    const combinedTemplate = `System: ${systemMessage}

User: ${langchainUserTemplate}`;

    // Extract variable names from the user template
    const variableMatches = userTemplate.match(/\{\{(\w+)\}\}/g) || [];
    const inputVariables = variableMatches.map(match => match.replace(/[{}]/g, ''));
    
    return new PromptTemplate({
      template: combinedTemplate,
      inputVariables: [...new Set(inputVariables)]
    });
  }

  /**
   * 清除所有緩存 (包含 LangChain 模板緩存)
   */
  static clearCache(): void {
    this.templateCache.clear();
    this.langchainTemplateCache.clear();
  }
}
