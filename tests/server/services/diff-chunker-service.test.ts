// Test file for DiffChunkerService
import { DiffChunkerService, DiffChunk } from '../../../src/server/services/diff-chunker-service';

describe('DiffChunkerService', () => {
  let service: DiffChunkerService;

  beforeEach(() => {
    service = new DiffChunkerService({
      chunkSize: 100,
      overlapSize: 20,
      maxChunks: 5,
      enabled: true
    });
  });

  describe('chunkDiff', () => {
    it('should_return_single_chunk_when_diff_is_small', () => {
      // Arrange
      const smallDiff = 'diff --git a/file.txt b/file.txt\n+added line';
      
      // Act
      const result = service.chunkDiff(smallDiff);
      
      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(smallDiff);
      expect(result[0].index).toBe(0);
      expect(result[0].totalChunks).toBe(1);
      expect(result[0].hasOverlap).toBe(false);
    });

    it('should_return_single_chunk_when_chunking_disabled', () => {
      // Arrange
      const disabledService = new DiffChunkerService({ enabled: false });
      const largeDiff = 'a'.repeat(1000);
      
      // Act
      const result = disabledService.chunkDiff(largeDiff);
      
      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(largeDiff);
    });

    it('should_chunk_by_files_when_multiple_files_present', () => {
      // Arrange
      const multiFileDiff = `diff --git a/file1.txt b/file1.txt
index 1234567..abcdefg 100644
--- a/file1.txt
+++ b/file1.txt
@@ -1,3 +1,4 @@
 line1
 line2
+new line
 line3
diff --git a/file2.txt b/file2.txt
index 7654321..gfedcba 100644
--- a/file2.txt
+++ b/file2.txt
@@ -1,2 +1,3 @@
 another line
+another new line
 last line`;
      
      // Act
      const result = service.chunkDiff(multiFileDiff);
      
      // Assert
      expect(result.length).toBeGreaterThan(1);
      expect(result[0].context.files).toContain('file1.txt');
      expect(result[1].context.files).toContain('file2.txt');
    });

    it('should_determine_correct_change_types', () => {
      // Arrange
      const addOnlyDiff = `diff --git a/new.txt b/new.txt
+++ b/new.txt
@@ -0,0 +1,2 @@
+new line 1
+new line 2`;
      
      // Act
      const result = service.chunkDiff(addOnlyDiff);
      
      // Assert
      expect(result[0].context.changeType).toBe('add');
    });

    it('should_limit_chunks_to_maxChunks_setting', () => {
      // Arrange
      const veryLargeDiff = 'a'.repeat(1000);
      
      // Act
      const result = service.chunkDiff(veryLargeDiff);
      
      // Assert
      expect(result.length).toBeLessThanOrEqual(5); // maxChunks = 5
    });
  });

  describe('configuration', () => {
    it('should_use_environment_variables_for_default_config', () => {
      // Arrange
      process.env.DIFF_CHUNK_SIZE = '500';
      process.env.DIFF_CHUNK_OVERLAP = '50';
      process.env.MAX_CHUNKS = '3';
      process.env.ENABLE_CHUNKING = 'true';
      
      // Create a new ConfigManager instance to pick up the env vars
      const { ConfigManager } = require('../../../src/server/utils/config-manager');
      ConfigManager.clearInstance();
      
      // Act
      const newService = new DiffChunkerService();
      const config = newService.getConfig();
      
      // Assert
      expect(config.chunkSize).toBe(500);
      expect(config.overlapSize).toBe(50);
      expect(config.maxChunks).toBe(3);
      expect(config.enabled).toBe(true);
      
      // Cleanup
      delete process.env.DIFF_CHUNK_SIZE;
      delete process.env.DIFF_CHUNK_OVERLAP;
      delete process.env.MAX_CHUNKS;
      delete process.env.ENABLE_CHUNKING;
      ConfigManager.clearInstance();
    });

    it('should_allow_config_updates', () => {
      // Arrange
      const initialConfig = service.getConfig();
      
      // Act
      service.updateConfig({ chunkSize: 200 });
      const updatedConfig = service.getConfig();
      
      // Assert
      expect(updatedConfig.chunkSize).toBe(200);
      expect(updatedConfig.overlapSize).toBe(initialConfig.overlapSize);
    });
  });

  describe('chunk context analysis', () => {
    it('should_extract_filenames_from_diff', () => {
      // Arrange
      const diff = `diff --git a/src/test.js b/src/test.js
index 1234567..abcdefg 100644
--- a/src/test.js
+++ b/src/test.js
@@ -1,3 +1,4 @@
 const test = true;
+const newVar = false;
 console.log(test);`;
      
      // Act
      const result = service.chunkDiff(diff);
      
      // Assert
      expect(result[0].context.files).toEqual(['src/test.js']);
    });

    it('should_identify_modify_change_type', () => {
      // Arrange
      const modifyDiff = `diff --git a/file.txt b/file.txt
--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,3 @@
 line1
-old line
+new line
 line3`;
      
      // Act
      const result = service.chunkDiff(modifyDiff);
      
      // Assert
      expect(result[0].context.changeType).toBe('modify');
    });

    it('should_identify_delete_change_type', () => {
      // Arrange
      const deleteDiff = `diff --git a/file.txt b/file.txt
--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,2 @@
 line1
-deleted line
 line3`;
      
      // Act
      const result = service.chunkDiff(deleteDiff);
      
      // Assert
      expect(result[0].context.changeType).toBe('delete');
    });
  });

  describe('overlap handling', () => {
    it('should_add_overlap_for_size_based_chunks', () => {
      // Arrange
      const largeDiff = 'line1\n'.repeat(50); // 300 chars, should create multiple chunks
      
      // Act
      const result = service.chunkDiff(largeDiff);
      
      // Assert
      if (result.length > 1) {
        expect(result[1].hasOverlap).toBe(true);
      }
    });

    it('should_not_add_overlap_for_file_based_chunks', () => {
      // Arrange
      const multiFileDiff = `diff --git a/file1.txt b/file1.txt
+line1
diff --git a/file2.txt b/file2.txt
+line2`;
      
      // Act
      const result = service.chunkDiff(multiFileDiff);
      
      // Assert
      result.forEach(chunk => {
        expect(chunk.hasOverlap).toBe(false);
      });
    });
  });
});