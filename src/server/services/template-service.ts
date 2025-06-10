import fs from 'fs';
import path from 'path';
import { TLLMPromptData } from '../../types/llm-types';

export class TemplateService {
  private static templateCache: Map<string, string> = new Map();

  /**
   * 讀取模板文件內容
   */
  private static readTemplate(templateName: string): string {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    // 嘗試多個可能的路徑
    const possiblePaths = [
      // 生產環境路徑 (編譯後)
      path.join(__dirname, '..', '..', 'templates', templateName),
      // 開發環境路徑 (ts-node)
      path.join(__dirname, '..', '..', '..', 'src', 'templates', templateName),
      // 相對於當前工作目錄
      path.join(process.cwd(), 'src', 'templates', templateName),
      path.join(process.cwd(), 'dist', 'templates', templateName)
    ];

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
   * 格式化 PR 數據為 LLM prompt
   */
  static formatPRDataForPrompt(prData: TLLMPromptData): string {
    const template = this.readTemplate('pr-description-template.txt');
    
    const variables = {
      title: prData.title,
      description: prData.description || '無描述提供',
      author: prData.author,
      repository: prData.repository,
      sourceBranch: prData.sourceBranch,
      destinationBranch: prData.destinationBranch,
      diff: prData.diff
    };

    return this.replaceVariables(template, variables);
  }

  /**
   * 清除模板緩存 (用於開發時重新載入模板)
   */
  static clearCache(): void {
    this.templateCache.clear();
  }
}
