// Service for filtering out ignored files from diffs
import { minimatch } from 'minimatch';

export interface FileFilterConfig {
  ignorePatterns: string[];
  enabled: boolean;
}

export class FileFilterService {
  private config: FileFilterConfig;

  constructor(config?: Partial<FileFilterConfig>) {
    const defaultPatterns = [
      'package-lock.json',
      'yarn.lock',
      'Gemfile.lock',
      'composer.lock',
      'Pipfile.lock',
      'go.sum',
      'go.mod',
      '*.lock',
      'node_modules/**',
      'vendor/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '.DS_Store',
      'Thumbs.db'
    ];

    // Parse environment variable patterns
    const envPatterns = process.env.IGNORE_PATTERNS 
      ? process.env.IGNORE_PATTERNS.split(',').map(p => p.trim())
      : [];

    this.config = {
      ignorePatterns: defaultPatterns,
      enabled: process.env.ENABLE_FILE_FILTERING?.toLowerCase() !== 'false',
      ...config
    };

    // Override with environment patterns if no config patterns provided
    if (!config?.ignorePatterns && envPatterns.length > 0) {
      this.config.ignorePatterns = envPatterns;
    }
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
      // Handle exact matches
      if (pattern === filepath) {
        return true;
      }
      
      // Handle glob patterns
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
  }
}