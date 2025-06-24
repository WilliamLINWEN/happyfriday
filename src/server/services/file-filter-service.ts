// Service for filtering out ignored files from diffs
import { minimatch } from 'minimatch';
import { getConfigManager } from '../utils/config-manager';

export interface FileFilterConfig {
  ignorePatterns: string[];
  enabled: boolean;
}

export class FileFilterService {
  private config: FileFilterConfig;
  private compiledPatterns: Map<string, RegExp> = new Map();

  constructor(config?: Partial<FileFilterConfig>) {
    const globalConfig = getConfigManager().getFileFilteringConfig();
    
    // Combine default and custom patterns
    const allPatterns = globalConfig.customIgnorePatterns.length > 0 
      ? globalConfig.customIgnorePatterns 
      : globalConfig.defaultIgnorePatterns;

    this.config = {
      ignorePatterns: allPatterns,
      enabled: globalConfig.enabled,
      ...config
    };

    this.precompilePatterns();
  }

  private precompilePatterns(): void {
    this.compiledPatterns.clear();
    for (const pattern of this.config.ignorePatterns) {
      // For simple patterns, create regex for faster matching
      if (!pattern.includes('*') && !pattern.includes('?')) {
        this.compiledPatterns.set(pattern, new RegExp(`^${this.escapeRegex(pattern)}$`));
      }
    }
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Filter out ignored files from a diff
   */
  filterDiff(diff: string): string {
    if (!this.config.enabled) {
      return diff;
    }

    const modifiedFiles = this.extractModifiedFiles(diff);
    const filesToIgnore = modifiedFiles.filter(file => this.shouldIgnoreFile(file));


    if (filesToIgnore.length === 0) {
      return diff;
    }

    return this.removeFilesFromDiff(diff, filesToIgnore);
  }

  /**
   * Check if a file should be ignored based on patterns
   */
  shouldIgnoreFile(filepath: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    return this.config.ignorePatterns.some(pattern => {
      // Use pre-compiled regex for simple patterns (performance optimization)
      const compiledPattern = this.compiledPatterns.get(pattern);
      if (compiledPattern) {
        return compiledPattern.test(filepath);
      }
      
      // Handle exact matches
      if (pattern === filepath) {
        return true;
      }
      
      // Fall back to glob patterns for complex patterns
      return minimatch(filepath, pattern);
    });
  }

  /**
   * Extract list of modified files from diff
   */
  extractModifiedFiles(diff: string): string[] {
    const files: string[] = [];
    const lines = diff.split('\n');

    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        const match = line.match(/diff --git a\/(.+?) b\/(.+)/);
        if (match) {
          files.push(match[2]); // Use the 'b/' version (after changes)
        }
      }
    }

    return files;
  }

  /**
   * Remove specific files from diff content
   */
  private removeFilesFromDiff(diff: string, filesToRemove: string[]): string {
    const lines = diff.split('\n');
    const filteredLines: string[] = [];
    let skipCurrentFile = false;
    let currentFile = '';

    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        // Extract filename from new diff header
        const match = line.match(/diff --git a\/(.+?) b\/(.+)/);
        currentFile = match ? match[2] : '';
        skipCurrentFile = filesToRemove.includes(currentFile);
        
        if (!skipCurrentFile) {
          filteredLines.push(line);
        }
      } else if (skipCurrentFile) {
        // Skip all lines for this file until next diff
        continue;
      } else {
        filteredLines.push(line);
      }
    }

    // Remove trailing empty lines
    while (filteredLines.length > 0 && filteredLines[filteredLines.length - 1].trim() === '') {
      filteredLines.pop();
    }

    return filteredLines.join('\n');
  }

  /**
   * Get current configuration
   */
  getConfig(): FileFilterConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<FileFilterConfig>): void {
    this.config = { ...this.config, ...newConfig };
    // Recompile patterns when ignore patterns change
    if (newConfig.ignorePatterns) {
      this.precompilePatterns();
    }
  }
}