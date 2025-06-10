"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class TemplateService {
    /**
     * 讀取模板文件內容
     */
    static readTemplate(templateName) {
        if (this.templateCache.has(templateName)) {
            return this.templateCache.get(templateName);
        }
        // 嘗試多個可能的路徑
        const possiblePaths = [
            // 生產環境路徑 (編譯後)
            path_1.default.join(__dirname, '..', '..', 'templates', templateName),
            // 開發環境路徑 (ts-node)
            path_1.default.join(__dirname, '..', '..', '..', 'src', 'templates', templateName),
            // 相對於當前工作目錄
            path_1.default.join(process.cwd(), 'src', 'templates', templateName),
            path_1.default.join(process.cwd(), 'dist', 'templates', templateName)
        ];
        let content = null;
        let lastError = null;
        for (const templatePath of possiblePaths) {
            try {
                content = fs_1.default.readFileSync(templatePath, 'utf-8');
                console.log(`Template loaded from: ${templatePath}`);
                break;
            }
            catch (error) {
                lastError = error;
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
    static replaceVariables(template, variables) {
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
    static formatPRDataForPrompt(prData) {
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
    static clearCache() {
        this.templateCache.clear();
    }
}
exports.TemplateService = TemplateService;
TemplateService.templateCache = new Map();
