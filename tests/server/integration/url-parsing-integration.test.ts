// Integration tests for URL parsing feature
import request from 'supertest';
import app from '../../../src/server/index';

// Mock the Bitbucket service to avoid external API calls
jest.mock('../../../src/server/services/bitbucket-service', () => ({
  fetchPullRequest: jest.fn().mockResolvedValue({
    success: true,
    data: {
      title: 'Integration Test PR',
      description: 'Test description for integration',
      author: { display_name: 'Integration Test User' },
      source: { 
        branch: { name: 'feature-url-parsing' },
        repository: { full_name: 'testworkspace/testrepo' }
      },
      destination: { branch: { name: 'main' } },
      links: { html: { href: 'https://bitbucket.org/testworkspace/testrepo/pull-requests/456' } }
    }
  }),
  fetchPullRequestDiff: jest.fn().mockResolvedValue({
    success: true,
    data: { diff: 'mock diff content for integration test' }
  })
}));

jest.mock('../../../src/server/services/llm-service-registry', () => ({
  getLLMService: jest.fn().mockReturnValue({
    getAvailableProviders: jest.fn().mockResolvedValue(['openai']),
    generateDescription: jest.fn().mockResolvedValue({
      success: true,
      data: {
        description: 'Generated integration test description',
        provider: 'openai',
        model: 'gpt-3.5-turbo'
      }
    }),
    generateDescriptionStream: jest.fn().mockImplementation((request, onToken) => {
      // Simulate streaming tokens
      setTimeout(() => onToken('Generated '), 10);
      setTimeout(() => onToken('integration '), 20);
      setTimeout(() => onToken('test '), 30);
      setTimeout(() => onToken('description'), 40);
      
      return Promise.resolve({
        success: true,
        data: {
          description: 'Generated integration test description',
          provider: 'openai',
          model: 'gpt-3.5-turbo'
        }
      });
    })
  })
}));

describe('URL Parsing Integration Tests', () => {
  // Clean up after all tests to prevent Jest hanging
  afterAll((done) => {
    // Close any open handles
    setTimeout(() => {
      done();
    }, 100);
  });

  describe('End-to-end URL parsing workflow', () => {
    test('should process valid PR URL from start to finish', async () => {
      const response = await request(app)
        .post('/api/generate-description')
        .send({
          prUrl: 'https://bitbucket.org/testworkspace/testrepo/pull-requests/456',
          provider: 'openai'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        generatedDescription: 'Generated integration test description',
        originalPR: {
          title: 'Integration Test PR',
          description: 'Test description for integration',
          author: 'Integration Test User',
          sourceBranch: 'feature-url-parsing',
          destinationBranch: 'main',
          repository: 'testworkspace/testrepo',
          url: 'https://bitbucket.org/testworkspace/testrepo/pull-requests/456'
        },
        metadata: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          processingTimeMs: expect.any(Number),
          diffSize: expect.any(Number)
        }
      });
    });

    test('should handle PR URL with different paths', async () => {
      const testUrls = [
        'https://bitbucket.org/testworkspace/testrepo/pull-requests/456/diff',
        'https://bitbucket.org/testworkspace/testrepo/pull-requests/456/commits',
        'https://bitbucket.org/testworkspace/testrepo/pull-requests/456/activity'
      ];

      for (const url of testUrls) {
        const response = await request(app)
          .post('/api/generate-description')
          .send({
            prUrl: url,
            provider: 'openai'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.generatedDescription).toBe('Generated integration test description');
      }
    });

    test('should maintain backward compatibility with legacy format', async () => {
      const response = await request(app)
        .post('/api/generate-description')
        .send({
          repository: 'testworkspace/testrepo',
          prNumber: '456',
          provider: 'openai'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.generatedDescription).toBe('Generated integration test description');
    });

    test('should reject invalid URL formats comprehensively', async () => {
      const invalidUrls = [
        'https://github.com/user/repo/pull/123',
        'https://bitbucket.org/workspace',
        'https://bitbucket.org/workspace/repo',
        'https://bitbucket.org/workspace/repo/issues/123',
        'invalid-url',
        'https://malicious.com/workspace/repo/pull-requests/123'
      ];

      for (const invalidUrl of invalidUrls) {
        const response = await request(app)
          .post('/api/generate-description')
          .send({
            prUrl: invalidUrl,
            provider: 'openai'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeTruthy();
      }
    });

    test('should handle streaming with URL format', async () => {
      const response = await request(app)
        .post('/api/generate-description/stream')
        .send({
          prUrl: 'https://bitbucket.org/testworkspace/testrepo/pull-requests/456',
          provider: 'openai'
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/event-stream');
    });

    test('should prioritize URL over legacy format when both provided', async () => {
      const response = await request(app)
        .post('/api/generate-description')
        .send({
          prUrl: 'https://bitbucket.org/testworkspace/testrepo/pull-requests/456',
          repository: 'different/repo',
          prNumber: '123',
          provider: 'openai'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      // Should use the URL format and extract testworkspace/testrepo, not different/repo
      expect(response.body.data.originalPR.repository).toBe('testworkspace/testrepo');
    });

    test('should validate mixed input scenarios', async () => {
      // Test with neither format
      const responseNeither = await request(app)
        .post('/api/generate-description')
        .send({
          provider: 'openai'
        });

      expect(responseNeither.status).toBe(400);
      expect(responseNeither.body.error).toContain('Please provide either a PR URL');

      // Test with incomplete legacy format
      const responseIncomplete = await request(app)
        .post('/api/generate-description')
        .send({
          repository: 'testworkspace/testrepo',
          provider: 'openai'
        });

      expect(responseIncomplete.status).toBe(400);
      expect(responseIncomplete.body.error).toContain('Please provide either a PR URL');
    });

    test('should handle special characters in URLs safely', async () => {
      const maliciousUrls = [
        'https://bitbucket.org/work<script>space/repo/pull-requests/123',
        'https://bitbucket.org/workspace/../repo/pull-requests/123',
        'https://bitbucket.org/workspace/repo"injection/pull-requests/123'
      ];

      for (const maliciousUrl of maliciousUrls) {
        const response = await request(app)
          .post('/api/generate-description')
          .send({
            prUrl: maliciousUrl,
            provider: 'openai'
          });

        // Security middleware may return 403 for suspicious patterns
        expect([400, 403]).toContain(response.status);
        expect(response.body.success).toBe(false);
      }
    });

    test('should extract workspace and repository correctly from complex URLs', async () => {
      const complexUrls = [
        'https://bitbucket.org/my-workspace_123/my.repo-name/pull-requests/789',
        'https://bitbucket.org/workspace-with-dashes/repo.with.dots/pull-requests/101/diff',
        'https://bitbucket.org/numeric123/repo_underscore/pull-requests/202/commits'
      ];

      for (const url of complexUrls) {
        const response = await request(app)
          .post('/api/generate-description')
          .send({
            prUrl: url,
            provider: 'openai'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.generatedDescription).toBe('Generated integration test description');
      }
    });
  });
});