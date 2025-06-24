// Service for aggregating results from multiple diff chunks
import { DiffChunk } from '../../types/llm-types';

export interface ChunkResult {
  chunkIndex: number;
  description: string;
  success: boolean;
  error?: string;
}

export interface AggregatedResult {
  success: boolean;
  description: string;
  chunksProcessed: number;
  failedChunks?: number;
  error?: string;
}

export interface ProcessingSummary {
  totalFiles: number;
  totalChunks: number;
  successfulChunks: number;
  failedChunks: number;
  changeTypes: Record<string, number>;
}

export class ResultAggregatorService {
  
  /**
   * Aggregate multiple chunk results into a single result
   */
  aggregateResults(chunks: DiffChunk[], results: ChunkResult[]): AggregatedResult {
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    if (successfulResults.length === 0) {
      return {
        success: false,
        description: '',
        chunksProcessed: results.length,
        failedChunks: failedResults.length,
        error: 'Failed to process diff chunks: No successful chunks found'
      };
    }

    // Single chunk case
    if (successfulResults.length === 1 && failedResults.length === 0) {
      return {
        success: true,
        description: successfulResults[0].description,
        chunksProcessed: results.length
      };
    }

    // Multiple chunks case
    const descriptions = successfulResults.map(r => r.description);
    let aggregatedDescription = this.formatDescription(descriptions);

    // Add note about failed chunks if any
    if (failedResults.length > 0) {
      aggregatedDescription += '\n\n(Note: Some changes could not be processed)';
    }

    return {
      success: true,
      description: aggregatedDescription,
      chunksProcessed: results.length,
      failedChunks: failedResults.length
    };
  }

  /**
   * Generate processing summary statistics
   */
  generateSummary(chunks: DiffChunk[], results: ChunkResult[]): ProcessingSummary {
    const allFiles = new Set<string>();
    const changeTypes: Record<string, number> = {};

    // Collect file and change type statistics
    chunks.forEach(chunk => {
      chunk.context.files.forEach(file => allFiles.add(file));
      const changeType = chunk.context.changeType;
      changeTypes[changeType] = (changeTypes[changeType] || 0) + 1;
    });

    const successfulChunks = results.filter(r => r.success).length;
    const failedChunks = results.filter(r => !r.success).length;

    return {
      totalFiles: allFiles.size,
      totalChunks: chunks.length,
      successfulChunks,
      failedChunks,
      changeTypes
    };
  }

  /**
   * Format multiple descriptions into a cohesive single description
   */
  formatDescription(descriptions: string[]): string {
    if (descriptions.length === 0) {
      return '';
    }

    if (descriptions.length === 1) {
      return descriptions[0];
    }

    // Deduplicate similar descriptions
    const uniqueDescriptions = this.deduplicateDescriptions(descriptions);

    if (uniqueDescriptions.length === 1) {
      return uniqueDescriptions[0];
    }

    // Format as bullet points
    return uniqueDescriptions
      .map(desc => `• ${desc}`)
      .join('\n');
  }

  /**
   * Remove duplicate or very similar descriptions
   */
  private deduplicateDescriptions(descriptions: string[]): string[] {
    const unique: string[] = [];
    const seen = new Set<string>();

    for (const desc of descriptions) {
      const normalized = this.normalizeDescription(desc);
      
      if (!seen.has(normalized)) {
        seen.add(normalized);
        unique.push(desc);
      }
    }

    return unique;
  }

  /**
   * Normalize description for comparison
   */
  private normalizeDescription(description: string): string {
    return description
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim();
  }
}