// Service for intelligently chunking large diffs into manageable pieces
import { DiffChunk } from '../../types/llm-types';

// Re-export for backward compatibility
export { DiffChunk };

export interface ChunkingConfig {
  chunkSize: number;
  overlapSize: number;
  maxChunks: number;
  enabled: boolean;
}

export class DiffChunkerService {
  private config: ChunkingConfig;

  constructor(config?: Partial<ChunkingConfig>) {
    this.config = {
      chunkSize: parseInt(process.env.DIFF_CHUNK_SIZE || '4000'),
      overlapSize: parseInt(process.env.DIFF_CHUNK_OVERLAP || '200'),
      maxChunks: parseInt(process.env.MAX_CHUNKS || '10'),
      enabled: process.env.ENABLE_CHUNKING?.toLowerCase() === 'true',
      ...config
    };
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
          Math.floor(this.config.overlapSize / 50),
          lineIndex - startIndex
        );
        lineIndex = Math.max(startIndex + 1, lineIndex - overlapLines);
      }
    }

    chunks.forEach(chunk => chunk.totalChunks = chunks.length);
    return chunks;
  }

  private parseFileBlocks(diff: string): Array<{filename: string, content: string}> {
    const blocks: Array<{filename: string, content: string}> = [];
    const lines = diff.split('\n');
    
    let currentFile = '';
    let currentContent = '';

    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        if (currentFile && currentContent) {
          blocks.push({ filename: currentFile, content: currentContent });
        }
        
        const match = line.match(/diff --git a\/(.+?) b\/(.+)/);
        currentFile = match ? match[2] : 'unknown';
        currentContent = line + '\n';
      } else {
        currentContent += line + '\n';
      }
    }

    if (currentFile && currentContent) {
      blocks.push({ filename: currentFile, content: currentContent });
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