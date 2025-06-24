// Service for intelligently chunking large diffs into manageable pieces
import { DiffChunk } from '../../types/llm-types';
import { getConfigManager, ChunkingFeatureConfig } from '../utils/config-manager';

// Re-export for backward compatibility
export { DiffChunk };

export interface ChunkingConfig {
  chunkSize: number;
  overlapSize: number;
  maxChunks: number;
  enabled: boolean;
}

interface FileBlock {
  filename: string;
  content: string;
}

export class DiffChunkerService {
  private config: ChunkingConfig;
  private readonly MIN_CHUNK_SIZE = 100; // Minimum viable chunk size
  private readonly AVERAGE_LINE_LENGTH = 50; // Average characters per line in diffs

  constructor(config?: Partial<ChunkingConfig>) {
    const globalConfig = getConfigManager().getChunkingConfig();
    this.config = {
      chunkSize: globalConfig.chunkSize,
      overlapSize: globalConfig.overlapSize,
      maxChunks: globalConfig.maxChunks,
      enabled: globalConfig.enabled,
      ...config
    };
    
    this.validateConfig();
  }

  private validateConfig(): void {
    if (this.config.chunkSize < this.MIN_CHUNK_SIZE) {
      throw new Error(`Chunk size must be at least ${this.MIN_CHUNK_SIZE} characters`);
    }
    if (this.config.overlapSize >= this.config.chunkSize) {
      throw new Error('Overlap size must be smaller than chunk size');
    }
    if (this.config.maxChunks <= 0) {
      throw new Error('Maximum chunks must be positive');
    }
  }

  chunkDiff(diff: string): DiffChunk[] {
    if (!this.config.enabled || diff.length <= this.config.chunkSize) {
      return [{
        content: diff,
        index: 0,
        totalChunks: 1,
        context: this.analyzeDiffContext(diff),
        hasOverlap: false
      }];
    }

    const fileChunks = this.chunkByFiles(diff);
    if (fileChunks.length > 1 && fileChunks.length <= this.config.maxChunks) {
      return fileChunks;
    }

    return this.chunkBySize(diff);
  }

  private chunkByFiles(diff: string): DiffChunk[] {
    const fileBlocks = this.parseFileBlocks(diff);
    if (fileBlocks.length <= 1) {
      return [];
    }

    const chunks: DiffChunk[] = [];
    let currentChunk = '';
    let filesInChunk: string[] = [];

    for (const block of fileBlocks) {
      if (currentChunk.length + block.content.length > this.config.chunkSize && currentChunk.length > 0) {
        chunks.push({
          content: currentChunk.trim(),
          index: chunks.length,
          totalChunks: 0,
          context: {
            files: [...filesInChunk],
            changeType: this.determineChangeType(currentChunk)
          },
          hasOverlap: false
        });
        
        currentChunk = block.content;
        filesInChunk = [block.filename];
      } else {
        currentChunk += block.content;
        filesInChunk.push(block.filename);
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        content: currentChunk.trim(),
        index: chunks.length,
        totalChunks: 0,
        context: {
          files: [...filesInChunk],
          changeType: this.determineChangeType(currentChunk)
        },
        hasOverlap: false
      });
    }

    chunks.forEach(chunk => chunk.totalChunks = chunks.length);
    return chunks;
  }

  private chunkBySize(diff: string): DiffChunk[] {
    const chunks: DiffChunk[] = [];
    const lines = diff.split('\n');
    
    let currentChunk = '';
    let lineIndex = 0;
    let insideHunk = false;

    while (lineIndex < lines.length && chunks.length < this.config.maxChunks) {
      const startIndex = lineIndex;
      currentChunk = '';

      while (lineIndex < lines.length && currentChunk.length < this.config.chunkSize) {
        const line = lines[lineIndex];
        
        // Check if we're starting or ending a hunk
        if (line.startsWith('@@')) {
          insideHunk = true;
        }
        
        // Don't break in the middle of a hunk unless we really have to
        if (currentChunk.length + line.length + 1 > this.config.chunkSize && currentChunk.length > 0) {
          if (!insideHunk || line.startsWith('diff --git')) {
            break;
          }
        }
        
        currentChunk += line + '\n';
        lineIndex++;
        
        // Mark end of hunk when we see next diff or reach end
        if (insideHunk && (line.startsWith('diff --git') || lineIndex === lines.length)) {
          insideHunk = false;
        }
      }

      if (currentChunk.trim()) {
        chunks.push({
          content: currentChunk.trim(),
          index: chunks.length,
          totalChunks: 0,
          context: this.analyzeDiffContext(currentChunk),
          hasOverlap: chunks.length > 0
        });
      }

      // Add overlap for next chunk
      if (lineIndex < lines.length) {
        const overlapLines = Math.min(
          Math.floor(this.config.overlapSize / this.AVERAGE_LINE_LENGTH),
          lineIndex - startIndex
        );
        lineIndex = Math.max(startIndex + 1, lineIndex - overlapLines);
      }
    }

    chunks.forEach(chunk => chunk.totalChunks = chunks.length);
    return chunks;
  }

  private parseFileBlocks(diff: string): FileBlock[] {
    const blocks: FileBlock[] = [];
    const lines = diff.split('\n');
    
    let currentFile = '';
    let currentContent = '';
    
    // Pre-compile regex for better performance
    const gitDiffRegex = /diff --git a\/(.+?) b\/(.+)/;

    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        // Save previous block if exists
        if (currentFile && currentContent) {
          blocks.push({ filename: currentFile, content: currentContent.trim() });
        }
        
        const match = line.match(gitDiffRegex);
        currentFile = match ? match[2] : 'unknown';
        currentContent = line + '\n';
      } else {
        currentContent += line + '\n';
      }
    }

    // Don't forget the last block
    if (currentFile && currentContent) {
      blocks.push({ filename: currentFile, content: currentContent.trim() });
    }

    return blocks;
  }

  private determineChangeType(diffContent: string): 'add' | 'modify' | 'delete' | 'mixed' {
    const lines = diffContent.split('\n');
    let addCount = 0;
    let deleteCount = 0;

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        addCount++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deleteCount++;
      }
    }


    // If we have both additions and deletions, it's a modification
    if (addCount > 0 && deleteCount > 0) return 'modify';
    
    // Pure additions
    if (addCount > 0 && deleteCount === 0) return 'add';
    
    // Pure deletions
    if (deleteCount > 0 && addCount === 0) return 'delete';
    
    return 'mixed';
  }

  private analyzeDiffContext(diffContent: string): DiffChunk['context'] {
    const files = this.extractFilenames(diffContent);
    const changeType = this.determineChangeType(diffContent);

    return {
      files,
      changeType
    };
  }

  private extractFilenames(diffContent: string): string[] {
    const files: string[] = [];
    const lines = diffContent.split('\n');

    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        const match = line.match(/diff --git a\/(.+?) b\/(.+)/);
        if (match) {
          files.push(match[2]);
        }
      }
    }

    return files;
  }

  getConfig(): ChunkingConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<ChunkingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}