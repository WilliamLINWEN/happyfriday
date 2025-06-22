// Tests for URL parsing utility
import { BitbucketUrlParser, ParsedPRUrl } from '../../../src/server/utils/url-parser';

describe('BitbucketUrlParser', () => {
  describe('parsePRUrl', () => {
    describe('valid URLs', () => {
      test('should parse standard PR URL', () => {
        const url = 'https://bitbucket.org/myworkspace/myrepo/pull-requests/123';
        const result = BitbucketUrlParser.parsePRUrl(url);
        
        expect(result.isValid).toBe(true);
        expect(result.workspace).toBe('myworkspace');
        expect(result.repository).toBe('myrepo');
        expect(result.prNumber).toBe('123');
        expect(result.error).toBeUndefined();
      });

      test('should parse PR URL with trailing slash', () => {
        const url = 'https://bitbucket.org/myworkspace/myrepo/pull-requests/456/';
        const result = BitbucketUrlParser.parsePRUrl(url);
        
        expect(result.isValid).toBe(true);
        expect(result.workspace).toBe('myworkspace');
        expect(result.repository).toBe('myrepo');
        expect(result.prNumber).toBe('456');
      });

      test('should parse PR URL with diff path', () => {
        const url = 'https://bitbucket.org/myworkspace/myrepo/pull-requests/789/diff';
        const result = BitbucketUrlParser.parsePRUrl(url);
        
        expect(result.isValid).toBe(true);
        expect(result.workspace).toBe('myworkspace');
        expect(result.repository).toBe('myrepo');
        expect(result.prNumber).toBe('789');
      });

      test('should parse PR URL with commits path', () => {
        const url = 'https://bitbucket.org/myworkspace/myrepo/pull-requests/101/commits';
        const result = BitbucketUrlParser.parsePRUrl(url);
        
        expect(result.isValid).toBe(true);
        expect(result.workspace).toBe('myworkspace');
        expect(result.repository).toBe('myrepo');
        expect(result.prNumber).toBe('101');
      });

      test('should parse PR URL with activity path', () => {
        const url = 'https://bitbucket.org/myworkspace/myrepo/pull-requests/202/activity';
        const result = BitbucketUrlParser.parsePRUrl(url);
        
        expect(result.isValid).toBe(true);
        expect(result.workspace).toBe('myworkspace');
        expect(result.repository).toBe('myrepo');
        expect(result.prNumber).toBe('202');
      });

      test('should parse HTTP URL (not just HTTPS)', () => {
        const url = 'http://bitbucket.org/myworkspace/myrepo/pull-requests/303';
        const result = BitbucketUrlParser.parsePRUrl(url);
        
        expect(result.isValid).toBe(true);
        expect(result.workspace).toBe('myworkspace');
        expect(result.repository).toBe('myrepo');
        expect(result.prNumber).toBe('303');
      });

      test('should parse legacy pullrequests URL format', () => {
        const url = 'https://bitbucket.org/myworkspace/myrepo/pullrequests/404';
        const result = BitbucketUrlParser.parsePRUrl(url);
        
        expect(result.isValid).toBe(true);
        expect(result.workspace).toBe('myworkspace');
        expect(result.repository).toBe('myrepo');
        expect(result.prNumber).toBe('404');
      });

      test('should handle URLs with special characters in workspace/repo names', () => {
        const url = 'https://bitbucket.org/my-workspace_123/my.repo-name/pull-requests/505';
        const result = BitbucketUrlParser.parsePRUrl(url);
        
        expect(result.isValid).toBe(true);
        expect(result.workspace).toBe('my-workspace_123');
        expect(result.repository).toBe('my.repo-name');
        expect(result.prNumber).toBe('505');
      });

      test('should trim whitespace from URL', () => {
        const url = '  https://bitbucket.org/myworkspace/myrepo/pull-requests/606  ';
        const result = BitbucketUrlParser.parsePRUrl(url);
        
        expect(result.isValid).toBe(true);
        expect(result.workspace).toBe('myworkspace');
        expect(result.repository).toBe('myrepo');
        expect(result.prNumber).toBe('606');
      });
    });

    describe('invalid URLs', () => {
      test('should reject null or undefined input', () => {
        expect(BitbucketUrlParser.parsePRUrl(null as any).isValid).toBe(false);
        expect(BitbucketUrlParser.parsePRUrl(undefined as any).isValid).toBe(false);
      });

      test('should reject non-string input', () => {
        expect(BitbucketUrlParser.parsePRUrl(123 as any).isValid).toBe(false);
        expect(BitbucketUrlParser.parsePRUrl({} as any).isValid).toBe(false);
      });

      test('should reject empty string', () => {
        const result = BitbucketUrlParser.parsePRUrl('');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('URL cannot be empty');
      });

      test('should reject whitespace-only string', () => {
        const result = BitbucketUrlParser.parsePRUrl('   ');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('URL cannot be empty');
      });

      test('should reject non-Bitbucket URLs', () => {
        const urls = [
          'https://github.com/user/repo/pull/123',
          'https://gitlab.com/user/repo/-/merge_requests/123',
          'https://example.com/pull-request/123'
        ];

        urls.forEach(url => {
          const result = BitbucketUrlParser.parsePRUrl(url);
          expect(result.isValid).toBe(false);
          expect(result.error).toBe('URL must be from bitbucket.org');
        });
      });

      test('should reject malformed Bitbucket URLs', () => {
        const urls = [
          'https://bitbucket.org/workspace',
          'https://bitbucket.org/workspace/repo',
          'https://bitbucket.org/workspace/repo/pull-requests',
          'https://bitbucket.org/workspace/repo/issues/123',
          'https://bitbucket.org/workspace/repo/src/main'
        ];

        urls.forEach(url => {
          const result = BitbucketUrlParser.parsePRUrl(url);
          expect(result.isValid).toBe(false);
          expect(result.error).toContain('Invalid Bitbucket PR URL format');
        });
      });

      test('should reject URLs with invalid PR numbers', () => {
        const urls = [
          'https://bitbucket.org/workspace/repo/pull-requests/0',
          'https://bitbucket.org/workspace/repo/pull-requests/-1',
          'https://bitbucket.org/workspace/repo/pull-requests/abc',
          'https://bitbucket.org/workspace/repo/pull-requests/1000000'
        ];

        urls.forEach(url => {
          const result = BitbucketUrlParser.parsePRUrl(url);
          expect(result.isValid).toBe(false);
          expect(result.error).toBe('Invalid PR number');
        });
      });

      test('should reject URLs with suspicious characters', () => {
        const urls = [
          'https://bitbucket.org/work<script>space/repo/pull-requests/123',
          'https://bitbucket.org/workspace/repo"injection/pull-requests/123',
          'https://bitbucket.org/workspace/../repo/pull-requests/123',
          'https://bitbucket.org/workspace/repo;injection/pull-requests/123'
        ];

        urls.forEach(url => {
          const result = BitbucketUrlParser.parsePRUrl(url);
          expect(result.isValid).toBe(false);
          expect(result.error).toBe('Invalid characters in URL components');
        });
      });

      test('should reject URLs with empty workspace or repository', () => {
        const urls = [
          'https://bitbucket.org//repo/pull-requests/123',
          'https://bitbucket.org/workspace//pull-requests/123'
        ];

        urls.forEach(url => {
          const result = BitbucketUrlParser.parsePRUrl(url);
          expect(result.isValid).toBe(false);
        });
      });
    });
  });

  describe('formatRepositoryString', () => {
    test('should format repository string correctly', () => {
      const result = BitbucketUrlParser.formatRepositoryString('myworkspace', 'myrepo');
      expect(result).toBe('myworkspace/myrepo');
    });

    test('should handle special characters in names', () => {
      const result = BitbucketUrlParser.formatRepositoryString('my-workspace_123', 'my.repo-name');
      expect(result).toBe('my-workspace_123/my.repo-name');
    });
  });

  describe('isBitbucketPRUrl', () => {
    test('should return true for valid Bitbucket PR URLs', () => {
      const urls = [
        'https://bitbucket.org/workspace/repo/pull-requests/123',
        'https://bitbucket.org/workspace/repo/pullrequests/123',
        'HTTPS://BITBUCKET.ORG/workspace/repo/PULL-REQUESTS/123'
      ];

      urls.forEach(url => {
        expect(BitbucketUrlParser.isBitbucketPRUrl(url)).toBe(true);
      });
    });

    test('should return false for non-Bitbucket URLs', () => {
      const urls = [
        'https://github.com/user/repo/pull/123',
        'https://bitbucket.org/workspace/repo/issues/123',
        'https://example.com',
        '',
        null as any,
        undefined as any,
        123 as any
      ];

      urls.forEach(url => {
        expect(BitbucketUrlParser.isBitbucketPRUrl(url)).toBe(false);
      });
    });
  });
});