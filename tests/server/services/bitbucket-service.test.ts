import { fetchPullRequest, fetchPullRequestDiff } from '../../../src/server/services/bitbucket-service';

describe('Bitbucket Service', () => {
  it('should return error for invalid repo format', async () => {
    const result = await fetchPullRequest('invalid', '1');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid repository/i);
  });
  it('should return error for invalid PR number', async () => {
    const result = await fetchPullRequest('workspace/repo', 'bad');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid pr number/i);
  });
  // Add more tests for Bitbucket API integration and error handling
});
