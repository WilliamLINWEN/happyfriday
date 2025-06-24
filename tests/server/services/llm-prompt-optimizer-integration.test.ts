// Integration tests for enhanced llm-prompt-optimizer with chunking and filtering
import { optimizePrompt } from '../../../src/server/services/llm-prompt-optimizer';
import { TLLMPromptData } from '../../../src/types/llm-types';

describe('LLM Prompt Optimizer Integration', () => {
  beforeEach(() => {
    // Reset environment variables
    delete process.env.ENABLE_CHUNKING;
    delete process.env.ENABLE_FILE_FILTERING;
    delete process.env.DIFF_CHUNK_SIZE;
    delete process.env.LLM_PROMPT_MAX_DIFF;
    delete process.env.IGNORE_PATTERNS;
    delete process.env.MAX_CHUNKS;
    delete process.env.DIFF_CHUNK_OVERLAP;
  });

  describe('with chunking disabled', () => {
    it('should_use_legacy_truncation_when_chunking_disabled', () => {
      // Arrange
      process.env.ENABLE_CHUNKING = 'false';
      process.env.LLM_PROMPT_MAX_DIFF = '100';
      
      const prData: TLLMPromptData = {
        title: 'Test PR',
        description: 'Test description',
        diff: 'a'.repeat(200), // Large diff that should be truncated
        author: 'test-author',
        sourceBranch: 'feature',
        destinationBranch: 'main',
        repository: 'test/repo',
        additionalContext: ''
      };

      // Act
      const result = optimizePrompt(prData);

      // Assert
      expect(result.diff.length).toBeLessThanOrEqual(100 + 20); // +20 for truncation notice
      expect(result.diff).toContain('... (diff truncated)');
      expect(result.chunks).toBeUndefined();
    });
  });

  describe('with chunking enabled', () => {
    it('should_return_chunks_when_diff_is_large', () => {
      // Arrange
      process.env.ENABLE_CHUNKING = 'true';
      process.env.DIFF_CHUNK_SIZE = '100';
      process.env.DIFF_CHUNK_OVERLAP = '20';
      process.env.LLM_PROMPT_MAX_DIFF = '10000'; // Large limit to prevent truncation
      
      // Clear config manager instance to pick up env vars
      const { ConfigManager } = require('../../../src/server/utils/config-manager');
      ConfigManager.clearInstance();
      
      const largeDiff = `diff --git a/file1.js b/file1.js
+${'line '.repeat(20)}
diff --git a/file2.js b/file2.js
+${'line '.repeat(20)}`;

      const prData: TLLMPromptData = {
        title: 'Large PR',
        description: 'Large change',
        diff: largeDiff,
        author: 'test-author',
        sourceBranch: 'feature',
        destinationBranch: 'main',
        repository: 'test/repo'
      };

      // Act
      const result = optimizePrompt(prData);

      // Assert
      expect(result.chunks).toBeDefined();
      expect(result.chunks!.length).toBeGreaterThan(1);
      expect(result.requiresChunking).toBe(true);

      // Cleanup
      delete process.env.ENABLE_CHUNKING;
      delete process.env.DIFF_CHUNK_SIZE;
      delete process.env.DIFF_CHUNK_OVERLAP;
      delete process.env.LLM_PROMPT_MAX_DIFF;
      ConfigManager.clearInstance();
    });

    it('should_filter_ignored_files_before_chunking', () => {
      // Arrange
      process.env.ENABLE_CHUNKING = 'true';
      process.env.ENABLE_FILE_FILTERING = 'true';
      process.env.DIFF_CHUNK_SIZE = '300';
      process.env.DIFF_CHUNK_OVERLAP = '50';

      // Clear config manager instance to pick up env vars
      const { ConfigManager } = require('../../../src/server/utils/config-manager');
      ConfigManager.clearInstance();
      
      const diffWithIgnoredFiles = `diff --git a/package-lock.json b/package-lock.json
+lock file changes
diff --git a/src/main.js b/src/main.js
+actual code changes`;

      const prData: TLLMPromptData = {
        title: 'Mixed PR',
        description: 'Contains both code and lock files',
        diff: diffWithIgnoredFiles,
        author: 'test-author',
        sourceBranch: 'feature',
        destinationBranch: 'main',
        repository: 'test/repo'
      };

      // Act
      const result = optimizePrompt(prData);

      // Assert
      expect(result.diff).not.toContain('package-lock.json');
      expect(result.diff).toContain('src/main.js');
      expect(result.filteredFiles).toContain('package-lock.json');

      // Cleanup
      delete process.env.ENABLE_CHUNKING;
      delete process.env.ENABLE_FILE_FILTERING;
      delete process.env.DIFF_CHUNK_SIZE;
      delete process.env.DIFF_CHUNK_OVERLAP;
      ConfigManager.clearInstance();
    });

    it('should_handle_small_diff_without_chunking', () => {
      // Arrange
      process.env.ENABLE_CHUNKING = 'true';
      process.env.DIFF_CHUNK_SIZE = '1000';
      process.env.DIFF_CHUNK_OVERLAP = '50';

      // Clear config manager instance to pick up env vars
      const { ConfigManager } = require('../../../src/server/utils/config-manager');
      ConfigManager.clearInstance();
      
      const smallDiff = 'diff --git a/small.js b/small.js\n+small change';

      const prData: TLLMPromptData = {
        title: 'Small PR',
        description: 'Small change',
        diff: smallDiff,
        author: 'test-author',
        sourceBranch: 'feature',
        destinationBranch: 'main',
        repository: 'test/repo'
      };

      // Act
      const result = optimizePrompt(prData);

      // Assert
      expect(result.requiresChunking).toBe(false);
      expect(result.chunks).toBeUndefined();
      expect(result.diff).toBe(smallDiff);

      // Cleanup
      delete process.env.ENABLE_CHUNKING;
      delete process.env.DIFF_CHUNK_SIZE;
      delete process.env.DIFF_CHUNK_OVERLAP;
      ConfigManager.clearInstance();
    });
  });

  describe('with file filtering enabled', () => {
    it('should_return_empty_diff_when_all_files_ignored', () => {
      // Arrange
      process.env.ENABLE_FILE_FILTERING = 'true';
      
      const onlyLockFiles = `diff --git a/package-lock.json b/package-lock.json
+lock changes
diff --git a/yarn.lock b/yarn.lock
+yarn changes`;

      const prData: TLLMPromptData = {
        title: 'Lock files only',
        description: 'Only lock file changes',
        diff: onlyLockFiles,
        author: 'test-author',
        sourceBranch: 'feature',
        destinationBranch: 'main',
        repository: 'test/repo'
      };

      // Act
      const result = optimizePrompt(prData);

      // Assert
      expect(result.diff.trim()).toBe('');
      expect(result.allFilesIgnored).toBe(true);
      expect(result.filteredFiles).toContain('package-lock.json');
      expect(result.filteredFiles).toContain('yarn.lock');
    });

    it('should_respect_custom_ignore_patterns', () => {
      // Arrange
      process.env.ENABLE_FILE_FILTERING = 'true';
      process.env.IGNORE_PATTERNS = 'custom.txt,*.tmp';
      
      // Clear config manager instance to pick up env vars
      const { ConfigManager } = require('../../../src/server/utils/config-manager');
      ConfigManager.clearInstance();
      
      const customIgnoreDiff = `diff --git a/custom.txt b/custom.txt
+custom file
diff --git a/test.tmp b/test.tmp
+temp file
diff --git a/keep.js b/keep.js
+keep this`;

      const prData: TLLMPromptData = {
        title: 'Custom patterns',
        description: 'Test custom ignore patterns',
        diff: customIgnoreDiff,
        author: 'test-author',
        sourceBranch: 'feature',
        destinationBranch: 'main',
        repository: 'test/repo'
      };

      // Act
      const result = optimizePrompt(prData);

      // Assert
      expect(result.diff).not.toContain('custom.txt');
      expect(result.diff).not.toContain('test.tmp');
      expect(result.diff).toContain('keep.js');

      // Cleanup
      delete process.env.ENABLE_FILE_FILTERING;
      delete process.env.IGNORE_PATTERNS;
      ConfigManager.clearInstance();
    });
  });

  describe('combined chunking and filtering', () => {
    it('should_filter_then_chunk_large_diffs', () => {
      // Arrange
      process.env.ENABLE_CHUNKING = 'true';
      process.env.ENABLE_FILE_FILTERING = 'true';
      process.env.DIFF_CHUNK_SIZE = '300';
      process.env.DIFF_CHUNK_OVERLAP = '50';
      
      // Clear config manager instance to pick up env vars
      const { ConfigManager } = require('../../../src/server/utils/config-manager');
      ConfigManager.clearInstance();
      
      const mixedLargeDiff = `diff --git a/package-lock.json b/package-lock.json
${'+ lock line\n'.repeat(50)}
diff --git a/src/file1.js b/src/file1.js
${'+ code line\n'.repeat(20)}
diff --git a/src/file2.js b/src/file2.js
${'+ more code\n'.repeat(20)}`;

      const prData: TLLMPromptData = {
        title: 'Large mixed PR',
        description: 'Large PR with mixed file types',
        diff: mixedLargeDiff,
        author: 'test-author',
        sourceBranch: 'feature',
        destinationBranch: 'main',
        repository: 'test/repo'
      };

      // Act
      const result = optimizePrompt(prData);

      // Assert
      expect(result.filteredFiles).toContain('package-lock.json');
      expect(result.requiresChunking).toBe(true);
      expect(result.chunks).toBeDefined();
      expect(result.chunks!.length).toBeGreaterThan(1);

      // Cleanup
      delete process.env.ENABLE_CHUNKING;
      delete process.env.ENABLE_FILE_FILTERING;
      delete process.env.DIFF_CHUNK_SIZE;
      delete process.env.DIFF_CHUNK_OVERLAP;
      ConfigManager.clearInstance();
      
      // All chunks should not contain ignored files
      result.chunks!.forEach(chunk => {
        expect(chunk.content).not.toContain('package-lock.json');
      });
    });
  });

  describe('error handling', () => {
    it('should_handle_empty_diff_gracefully', () => {
      // Arrange
      const prData: TLLMPromptData = {
        title: 'Empty PR',
        description: 'No changes',
        diff: '',
        author: 'test-author',
        sourceBranch: 'feature',
        destinationBranch: 'main',
        repository: 'test/repo'
      };

      // Act
      const result = optimizePrompt(prData);

      // Assert
      expect(result.diff).toBe('');
      expect(result.requiresChunking).toBe(false);
      expect(result.chunks).toBeUndefined();
    });

    it('should_handle_malformed_diff_gracefully', () => {
      // Arrange
      const prData: TLLMPromptData = {
        title: 'Malformed PR',
        description: 'Bad diff format',
        diff: 'this is not a valid diff format',
        author: 'test-author',
        sourceBranch: 'feature',
        destinationBranch: 'main',
        repository: 'test/repo'
      };

      // Act & Assert
      expect(() => optimizePrompt(prData)).not.toThrow();
    });
  });
});