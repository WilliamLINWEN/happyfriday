// Centralized configuration management for chunking features
export interface ChunkingFeatureConfig {
  chunking: {
    enabled: boolean;
    chunkSize: number;
    overlapSize: number;
    maxChunks: number;
  };
  fileFiltering: {
    enabled: boolean;
    defaultIgnorePatterns: string[];
    customIgnorePatterns: string[];
  };
  llmPrompt: {
    maxDiffLength: number;
  };
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: ChunkingFeatureConfig;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  static clearInstance(): void {
    ConfigManager.instance = undefined as any;
  }

  private loadConfiguration(): ChunkingFeatureConfig {
    return {
      chunking: {
        enabled: this.parseBoolean(process.env.ENABLE_CHUNKING, false),
        chunkSize: this.parseInteger(process.env.DIFF_CHUNK_SIZE, 4000),
        overlapSize: this.parseInteger(process.env.DIFF_CHUNK_OVERLAP, 200),
        maxChunks: this.parseInteger(process.env.MAX_CHUNKS, 10)
      },
      fileFiltering: {
        enabled: this.parseBoolean(process.env.ENABLE_FILE_FILTERING, true),
        defaultIgnorePatterns: [
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
        ],
        customIgnorePatterns: this.parseCommaSeparatedString(process.env.IGNORE_PATTERNS, [])
      },
      llmPrompt: {
        maxDiffLength: this.parseInteger(process.env.LLM_PROMPT_MAX_DIFF, 8000)
      }
    };
  }

  private parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
    if (!value) return defaultValue;
    return value.toLowerCase() === 'true';
  }

  private parseInteger(value: string | undefined, defaultValue: number): number {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  private parseCommaSeparatedString(value: string | undefined, defaultValue: string[]): string[] {
    if (!value) return defaultValue;
    return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  getChunkingConfig(): ChunkingFeatureConfig['chunking'] {
    return { ...this.config.chunking };
  }

  getFileFilteringConfig(): ChunkingFeatureConfig['fileFiltering'] {
    return { 
      ...this.config.fileFiltering,
      defaultIgnorePatterns: [...this.config.fileFiltering.defaultIgnorePatterns],
      customIgnorePatterns: [...this.config.fileFiltering.customIgnorePatterns]
    };
  }

  getLLMPromptConfig(): ChunkingFeatureConfig['llmPrompt'] {
    return { ...this.config.llmPrompt };
  }

  getFullConfig(): ChunkingFeatureConfig {
    return {
      chunking: this.getChunkingConfig(),
      fileFiltering: this.getFileFilteringConfig(),
      llmPrompt: this.getLLMPromptConfig()
    };
  }

  // For testing purposes
  updateConfig(newConfig: Partial<ChunkingFeatureConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig,
      chunking: { ...this.config.chunking, ...newConfig.chunking },
      fileFiltering: { ...this.config.fileFiltering, ...newConfig.fileFiltering },
      llmPrompt: { ...this.config.llmPrompt, ...newConfig.llmPrompt }
    };
  }

  // Reset to defaults (primarily for testing)
  reset(): void {
    this.config = this.loadConfiguration();
  }

  // Validation methods
  validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.chunking.chunkSize <= 0) {
      errors.push('Chunking chunk size must be positive');
    }

    if (this.config.chunking.overlapSize < 0) {
      errors.push('Chunking overlap size cannot be negative');
    }

    if (this.config.chunking.maxChunks <= 0) {
      errors.push('Maximum chunks must be positive');
    }

    if (this.config.chunking.overlapSize >= this.config.chunking.chunkSize) {
      errors.push('Overlap size must be smaller than chunk size');
    }

    if (this.config.llmPrompt.maxDiffLength <= 0) {
      errors.push('LLM prompt max diff length must be positive');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Convenience function for getting the singleton instance
export function getConfigManager(): ConfigManager {
  return ConfigManager.getInstance();
}