// Test file for FileFilterService
import { FileFilterService } from '../../../src/server/services/file-filter-service';

describe('FileFilterService', () => {
  let service: FileFilterService;

  beforeEach(() => {
    service = new FileFilterService({
      ignorePatterns: ['package-lock.json', '*.lock', '*.log', 'node_modules/**'],
      enabled: true
    });
  });

  describe('filterDiff', () => {
    it('should_remove_ignored_files_from_diff', () => {
      // Arrange
      const diff = `diff --git a/package-lock.json b/package-lock.json
index 1234567..abcdefg 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -1,3 +1,4 @@
 {
   "lockfileVersion": 1,
+  "requires": true,
   "dependencies": {
diff --git a/src/app.js b/src/app.js
index 7654321..gfedcba 100644
--- a/src/app.js
+++ b/src/app.js
@@ -1,2 +1,3 @@
 const express = require('express');
+const app = express();
 module.exports = app;`;

      // Act
      const result = service.filterDiff(diff);

      // Assert
      expect(result).not.toContain('package-lock.json');
      expect(result).toContain('src/app.js');
      expect(result).toContain('const express = require');
    });

    it('should_return_original_diff_when_filtering_disabled', () => {
      // Arrange
      const disabledService = new FileFilterService({ enabled: false });
      const diff = `diff --git a/package-lock.json b/package-lock.json
+some changes`;

      // Act
      const result = disabledService.filterDiff(diff);

      // Assert
      expect(result).toBe(diff);
    });

    it('should_handle_multiple_ignore_patterns', () => {
      // Arrange
      const multiPatternService = new FileFilterService({
        ignorePatterns: ['package-lock.json', '*.lock', '*.log', 'dist/**', 'coverage/**'],
        enabled: true
      });

      const diff = `diff --git a/package-lock.json b/package-lock.json
+lock changes
diff --git a/app.log b/app.log
+log changes
diff --git a/dist/bundle.js b/dist/bundle.js
+dist changes
diff --git a/src/main.js b/src/main.js
+main changes`;

      // Act
      const result = multiPatternService.filterDiff(diff);

      // Assert
      expect(result).not.toContain('package-lock.json');
      expect(result).not.toContain('app.log');
      expect(result).not.toContain('dist/bundle.js');
      expect(result).toContain('src/main.js');
    });

    it('should_handle_nested_directory_patterns', () => {
      // Arrange
      const diff = `diff --git a/node_modules/package/index.js b/node_modules/package/index.js
+dependency changes
diff --git a/src/utils/helper.js b/src/utils/helper.js
+utility changes`;

      // Act
      const result = service.filterDiff(diff);

      // Assert
      expect(result).not.toContain('node_modules/package/index.js');
      expect(result).toContain('src/utils/helper.js');
    });

    it('should_return_empty_string_when_all_files_ignored', () => {
      // Arrange
      const diff = `diff --git a/package-lock.json b/package-lock.json
+lock changes
diff --git a/yarn.lock b/yarn.lock
+yarn changes`;

      const lockOnlyService = new FileFilterService({
        ignorePatterns: ['package-lock.json', '*.lock'],
        enabled: true
      });

      // Act
      const result = lockOnlyService.filterDiff(diff);

      // Assert
      expect(result.trim()).toBe('');
    });
  });

  describe('configuration', () => {
    it('should_use_environment_variables_for_default_patterns', () => {
      // Arrange
      process.env.IGNORE_PATTERNS = 'test.txt,*.tmp,build/**';

      // Act
      const newService = new FileFilterService();
      const config = newService.getConfig();

      // Assert
      expect(config.ignorePatterns).toEqual(['test.txt', '*.tmp', 'build/**']);

      // Cleanup
      delete process.env.IGNORE_PATTERNS;
    });

    it('should_have_default_ignore_patterns', () => {
      // Arrange & Act
      const defaultService = new FileFilterService();
      const config = defaultService.getConfig();

      // Assert
      expect(config.ignorePatterns).toContain('package-lock.json');
      expect(config.ignorePatterns).toContain('*.lock');
      expect(config.ignorePatterns).toContain('go.sum');
      expect(config.ignorePatterns).toContain('composer.lock');
    });

    it('should_allow_config_updates', () => {
      // Arrange
      const initialConfig = service.getConfig();

      // Act
      service.updateConfig({ ignorePatterns: ['new-pattern.txt'] });
      const updatedConfig = service.getConfig();

      // Assert
      expect(updatedConfig.ignorePatterns).toEqual(['new-pattern.txt']);
      expect(updatedConfig.enabled).toBe(initialConfig.enabled);
    });

    it('should_respect_enabled_flag', () => {
      // Arrange
      const disabledService = new FileFilterService({ enabled: false });

      // Act
      const config = disabledService.getConfig();

      // Assert
      expect(config.enabled).toBe(false);
    });
  });

  describe('pattern matching', () => {
    it('should_match_glob_patterns_correctly', () => {
      // Arrange
      const patterns = ['*.json', 'temp/**', 'build/output.txt'];
      const testService = new FileFilterService({
        ignorePatterns: patterns,
        enabled: true
      });

      // Act & Assert
      expect(testService.shouldIgnoreFile('config.json')).toBe(true);
      expect(testService.shouldIgnoreFile('temp/file.txt')).toBe(true);
      expect(testService.shouldIgnoreFile('temp/nested/file.txt')).toBe(true);
      expect(testService.shouldIgnoreFile('build/output.txt')).toBe(true);
      expect(testService.shouldIgnoreFile('src/main.js')).toBe(false);
    });

    it('should_handle_exact_file_matches', () => {
      // Arrange
      const exactService = new FileFilterService({
        ignorePatterns: ['Gemfile.lock', 'composer.lock'],
        enabled: true
      });

      // Act & Assert
      expect(exactService.shouldIgnoreFile('Gemfile.lock')).toBe(true);
      expect(exactService.shouldIgnoreFile('composer.lock')).toBe(true);
      expect(exactService.shouldIgnoreFile('Gemfile')).toBe(false);
    });

    it('should_be_case_sensitive', () => {
      // Arrange
      const caseService = new FileFilterService({
        ignorePatterns: ['README.md'],
        enabled: true
      });

      // Act & Assert
      expect(caseService.shouldIgnoreFile('README.md')).toBe(true);
      expect(caseService.shouldIgnoreFile('readme.md')).toBe(false);
    });
  });

  describe('file extraction', () => {
    it('should_extract_modified_files_from_diff', () => {
      // Arrange
      const diff = `diff --git a/src/app.js b/src/app.js
index 1234567..abcdefg 100644
--- a/src/app.js
+++ b/src/app.js
@@ -1,3 +1,4 @@
 const express = require('express');
+const app = express();
diff --git a/test/app.test.js b/test/app.test.js
index 7654321..gfedcba 100644
--- a/test/app.test.js
+++ b/test/app.test.js
@@ -1,2 +1,3 @@
 const request = require('supertest');
+const app = require('../src/app');`;

      // Act
      const files = service.extractModifiedFiles(diff);

      // Assert
      expect(files).toEqual(['src/app.js', 'test/app.test.js']);
    });

    it('should_handle_empty_diff', () => {
      // Arrange
      const emptyDiff = '';

      // Act
      const files = service.extractModifiedFiles(emptyDiff);

      // Assert
      expect(files).toEqual([]);
    });
  });
});