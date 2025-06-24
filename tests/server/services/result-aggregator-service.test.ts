// Test file for ResultAggregatorService
import { ResultAggregatorService, ChunkResult } from '../../../src/server/services/result-aggregator-service';
import { DiffChunk } from '../../../src/server/services/diff-chunker-service';

describe('ResultAggregatorService', () => {
  let service: ResultAggregatorService;

  beforeEach(() => {
    service = new ResultAggregatorService();
  });

  describe('aggregateResults', () => {
    it('should_return_single_result_when_only_one_chunk', () => {
      // Arrange
      const chunks: DiffChunk[] = [{
        content: 'diff --git a/file.js b/file.js\n+added line',
        index: 0,
        totalChunks: 1,
        context: {
          files: ['file.js'],
          changeType: 'add'
        },
        hasOverlap: false
      }];

      const results: ChunkResult[] = [{
        chunkIndex: 0,
        description: 'Added new functionality to file.js',
        success: true
      }];

      // Act
      const aggregated = service.aggregateResults(chunks, results);

      // Assert
      expect(aggregated.success).toBe(true);
      expect(aggregated.description).toBe('Added new functionality to file.js');
      expect(aggregated.chunksProcessed).toBe(1);
    });

    it('should_combine_multiple_chunk_results', () => {
      // Arrange
      const chunks: DiffChunk[] = [
        {
          content: 'diff --git a/auth.js b/auth.js\n+auth changes',
          index: 0,
          totalChunks: 2,
          context: { files: ['auth.js'], changeType: 'modify' },
          hasOverlap: false
        },
        {
          content: 'diff --git a/user.js b/user.js\n+user changes',
          index: 1,
          totalChunks: 2,
          context: { files: ['user.js'], changeType: 'add' },
          hasOverlap: false
        }
      ];

      const results: ChunkResult[] = [
        {
          chunkIndex: 0,
          description: 'Enhanced authentication system',
          success: true
        },
        {
          chunkIndex: 1,
          description: 'Added user management features',
          success: true
        }
      ];

      // Act
      const aggregated = service.aggregateResults(chunks, results);

      // Assert
      expect(aggregated.success).toBe(true);
      expect(aggregated.description).toContain('Enhanced authentication system');
      expect(aggregated.description).toContain('Added user management features');
      expect(aggregated.chunksProcessed).toBe(2);
    });

    it('should_handle_failed_chunks_gracefully', () => {
      // Arrange
      const chunks: DiffChunk[] = [
        {
          content: 'diff --git a/working.js b/working.js\n+working changes',
          index: 0,
          totalChunks: 2,
          context: { files: ['working.js'], changeType: 'modify' },
          hasOverlap: false
        },
        {
          content: 'diff --git a/broken.js b/broken.js\n+broken changes',
          index: 1,
          totalChunks: 2,
          context: { files: ['broken.js'], changeType: 'add' },
          hasOverlap: false
        }
      ];

      const results: ChunkResult[] = [
        {
          chunkIndex: 0,
          description: 'Successfully updated working.js',
          success: true
        },
        {
          chunkIndex: 1,
          description: '',
          success: false,
          error: 'Failed to process chunk'
        }
      ];

      // Act
      const aggregated = service.aggregateResults(chunks, results);

      // Assert
      expect(aggregated.success).toBe(true); // Partial success
      expect(aggregated.description).toContain('Successfully updated working.js');
      expect(aggregated.description).toContain('(Note: Some changes could not be processed)');
      expect(aggregated.chunksProcessed).toBe(2);
      expect(aggregated.failedChunks).toBe(1);
    });

    it('should_fail_when_no_successful_chunks', () => {
      // Arrange
      const chunks: DiffChunk[] = [{
        content: 'diff --git a/error.js b/error.js\n+error changes',
        index: 0,
        totalChunks: 1,
        context: { files: ['error.js'], changeType: 'modify' },
        hasOverlap: false
      }];

      const results: ChunkResult[] = [{
        chunkIndex: 0,
        description: '',
        success: false,
        error: 'Processing failed'
      }];

      // Act
      const aggregated = service.aggregateResults(chunks, results);

      // Assert
      expect(aggregated.success).toBe(false);
      expect(aggregated.error).toContain('Failed to process diff chunks');
      expect(aggregated.chunksProcessed).toBe(1);
      expect(aggregated.failedChunks).toBe(1);
    });

    it('should_organize_results_by_file_groups', () => {
      // Arrange
      const chunks: DiffChunk[] = [
        {
          content: 'auth chunk',
          index: 0,
          totalChunks: 3,
          context: { files: ['auth/login.js', 'auth/logout.js'], changeType: 'modify' },
          hasOverlap: false
        },
        {
          content: 'user chunk',
          index: 1,
          totalChunks: 3,
          context: { files: ['user/profile.js'], changeType: 'add' },
          hasOverlap: false
        },
        {
          content: 'test chunk',
          index: 2,
          totalChunks: 3,
          context: { files: ['test/auth.test.js', 'test/user.test.js'], changeType: 'add' },
          hasOverlap: false
        }
      ];

      const results: ChunkResult[] = [
        { chunkIndex: 0, description: 'Authentication improvements', success: true },
        { chunkIndex: 1, description: 'User profile features', success: true },
        { chunkIndex: 2, description: 'Added comprehensive tests', success: true }
      ];

      // Act
      const aggregated = service.aggregateResults(chunks, results);

      // Assert
      expect(aggregated.success).toBe(true);
      expect(aggregated.description).toMatch(/authentication/i);
      expect(aggregated.description).toMatch(/user.*profile/i);
      expect(aggregated.description).toMatch(/test/i);
      expect(aggregated.chunksProcessed).toBe(3);
    });
  });

  describe('generateSummary', () => {
    it('should_create_summary_with_file_statistics', () => {
      // Arrange
      const chunks: DiffChunk[] = [
        {
          content: 'chunk1',
          index: 0,
          totalChunks: 2,
          context: { files: ['src/app.js', 'src/utils.js'], changeType: 'modify' },
          hasOverlap: false
        },
        {
          content: 'chunk2',
          index: 1,
          totalChunks: 2,
          context: { files: ['test/app.test.js'], changeType: 'add' },
          hasOverlap: false
        }
      ];

      const results: ChunkResult[] = [
        { chunkIndex: 0, description: 'Core functionality updates', success: true },
        { chunkIndex: 1, description: 'Added test coverage', success: true }
      ];

      // Act
      const summary = service.generateSummary(chunks, results);

      // Assert
      expect(summary.totalFiles).toBe(3);
      expect(summary.totalChunks).toBe(2);
      expect(summary.successfulChunks).toBe(2);
      expect(summary.failedChunks).toBe(0);
      expect(summary.changeTypes).toEqual({ modify: 1, add: 1 });
    });

    it('should_handle_mixed_success_and_failure', () => {
      // Arrange
      const chunks: DiffChunk[] = [
        {
          content: 'chunk1',
          index: 0,
          totalChunks: 2,
          context: { files: ['good.js'], changeType: 'add' },
          hasOverlap: false
        },
        {
          content: 'chunk2',
          index: 1,
          totalChunks: 2,
          context: { files: ['bad.js'], changeType: 'delete' },
          hasOverlap: false
        }
      ];

      const results: ChunkResult[] = [
        { chunkIndex: 0, description: 'Success', success: true },
        { chunkIndex: 1, description: '', success: false, error: 'Failed' }
      ];

      // Act
      const summary = service.generateSummary(chunks, results);

      // Assert
      expect(summary.totalFiles).toBe(2);
      expect(summary.successfulChunks).toBe(1);
      expect(summary.failedChunks).toBe(1);
      expect(summary.changeTypes).toEqual({ add: 1, delete: 1 });
    });
  });

  describe('formatDescription', () => {
    it('should_format_single_section_description', () => {
      // Arrange
      const descriptions = ['Added user authentication system'];
      
      // Act
      const formatted = service.formatDescription(descriptions);
      
      // Assert
      expect(formatted).toBe('Added user authentication system');
    });

    it('should_format_multiple_sections_with_bullets', () => {
      // Arrange
      const descriptions = [
        'Enhanced authentication system',
        'Added user profile management',
        'Implemented comprehensive test suite'
      ];
      
      // Act
      const formatted = service.formatDescription(descriptions);
      
      // Assert
      expect(formatted).toContain('•');
      expect(formatted).toContain('Enhanced authentication system');
      expect(formatted).toContain('Added user profile management');
      expect(formatted).toContain('Implemented comprehensive test suite');
    });

    it('should_deduplicate_similar_descriptions', () => {
      // Arrange
      const descriptions = [
        'Updated authentication system',
        'Enhanced authentication system',
        'Added new user features',
        'Updated authentication system' // Duplicate
      ];
      
      // Act
      const formatted = service.formatDescription(descriptions);
      
      // Assert
      const lines = formatted.split('\n').filter(line => line.trim());
      expect(lines.length).toBeLessThan(4); // Should deduplicate
      expect(formatted).toContain('authentication');
      expect(formatted).toContain('user features');
    });
  });
});