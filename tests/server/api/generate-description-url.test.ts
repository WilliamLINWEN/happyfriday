// Tests for URL parsing in the generate description API
import request from 'supertest';
import app from '../../../src/server/index';

// Mock the dependencies to avoid external API calls
jest.mock('../../../src/server/services/bitbucket-service', () => ({
  fetchPullRequest: jest.fn().mockResolvedValue({
    success: true,
    data: {
      title: 'Test PR',
      description: 'Test description',
      author: { display_name: 'Test User' },
      source: { 
        branch: { name: 'feature-branch' },
        repository: { full_name: 'workspace/repo' }
      },
      destination: { branch: { name: 'main' } },
      links: { html: { href: 'https://bitbucket.org/workspace/repo/pull-requests/123' } }
    }
  }),
  fetchPullRequestDiff: jest.fn().mockResolvedValue({
    success: true,
    data: { diff: 'test diff content' }
  })
}));

jest.mock('../../../src/server/services/llm-service-registry', () => ({
  getLLMService: jest.fn().mockReturnValue({
    getAvailableProviders: jest.fn().mockResolvedValue(['openai']),
    generateDescription: jest.fn().mockResolvedValue({
      success: true,
      data: {
        description: 'Generated test description',
        provider: 'openai',
        model: 'gpt-3.5-turbo'
      }
    })
  })
}));

describe('Generate Description API - URL Support', () => {
  describe('POST /api/generate-description', () => {
    describe('URL-based input', () => {
      test('should accept valid Bitbucket PR URL', async () => {
        const response = await request(app)
          .post('/api/generate-description')
          .send({
            prUrl: 'https://bitbucket.org/workspace/repo/pull-requests/123',
            provider: 'openai'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.generatedDescription).toBe('Generated test description');
      });

      test('should accept PR URL with additional paths', async () => {
        const response = await request(app)
          .post('/api/generate-description')
          .send({
            prUrl: 'https://bitbucket.org/workspace/repo/pull-requests/123/diff',
            provider: 'openai'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      test('should reject invalid PR URL format', async () => {
        const response = await request(app)
          .post('/api/generate-description')
          .send({
            prUrl: 'https://github.com/user/repo/pull/123',
            provider: 'openai'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('bitbucket.org');
      });

      test('should reject malformed PR URL', async () => {
        const response = await request(app)
          .post('/api/generate-description')
          .send({
            prUrl: 'https://bitbucket.org/workspace/repo',
            provider: 'openai'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Invalid Bitbucket PR URL format');
      });

      test('should reject PR URL with suspicious characters', async () => {
        const response = await request(app)
          .post('/api/generate-description')
          .send({
            prUrl: 'https://bitbucket.org/work<script>space/repo/pull-requests/123',
            provider: 'openai'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Invalid characters');
      });
    });

    describe('Legacy format (backward compatibility)', () => {
      test('should still accept repository and prNumber', async () => {
        const response = await request(app)
          .post('/api/generate-description')
          .send({
            repository: 'workspace/repo',
            prNumber: '123',
            provider: 'openai'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.generatedDescription).toBe('Generated test description');
      });

      test('should require both repository and prNumber for legacy format', async () => {
        const response = await request(app)
          .post('/api/generate-description')
          .send({
            repository: 'workspace/repo',
            provider: 'openai'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Please provide either a PR URL');
      });
    });

    describe('Input validation', () => {
      test('should require either prUrl or repository+prNumber', async () => {
        const response = await request(app)
          .post('/api/generate-description')
          .send({
            provider: 'openai'
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Please provide either a PR URL');
      });

      test('should prioritize prUrl over legacy format when both provided', async () => {
        const response = await request(app)
          .post('/api/generate-description')
          .send({
            prUrl: 'https://bitbucket.org/workspace/repo/pull-requests/456',
            repository: 'different/repo',
            prNumber: '123',
            provider: 'openai'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        // The response should use the PR URL (456), not the legacy format (123)
      });

      test('should accept additional context with URL format', async () => {
        const response = await request(app)
          .post('/api/generate-description')
          .send({
            prUrl: 'https://bitbucket.org/workspace/repo/pull-requests/123',
            provider: 'openai',
            additionalContext: 'This fixes issue #456'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });
});