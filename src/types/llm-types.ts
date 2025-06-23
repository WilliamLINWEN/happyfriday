// TypeScript type definitions for LLM services

export enum TLLMProvider {
  OPENAI = 'openai',
  CLAUDE = 'claude',
  OLLAMA = 'ollama'
}

export type TLLMRequest = {
  provider: TLLMProvider;
  prData: {
    title: string;
    description: string;
    diff: string;
    author: string;
    sourceBranch: string;
    destinationBranch: string;
    repository: string;
    additionalContext?: string;
  };
  template?: string;
  options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
};

export type TLLMResponse = {
  success: boolean;
  data?: {
    description: string;
    provider: TLLMProvider;
    model?: string;
  };
  error?: string;
};

export interface ILLMService {
  generateDescription(request: TLLMRequest): Promise<TLLMResponse>;
  generateDescriptionWithCallback?(request: TLLMRequest, onToken?: (token: string) => void): Promise<TLLMResponse>;
  isAvailable(): Promise<boolean>;
  getProviderName(): TLLMProvider;
}

// DiffChunk type for chunking functionality
export interface DiffChunk {
  content: string;
  index: number;
  totalChunks: number;
  context: {
    files: string[];
    changeType: 'add' | 'modify' | 'delete' | 'mixed';
    startLine?: number;
    endLine?: number;
  };
  hasOverlap: boolean;
}

export type TLLMPromptData = {
  title: string;
  description: string;
  diff: string;
  author: string;
  sourceBranch: string;
  destinationBranch: string;
  repository: string;
  additionalContext?: string;
  // New properties for chunking and filtering
  chunks?: DiffChunk[];
  requiresChunking?: boolean;
  filteredFiles?: string[];
  allFilesIgnored?: boolean;
};
