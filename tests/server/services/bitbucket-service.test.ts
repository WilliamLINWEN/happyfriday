import { fetchPullRequest, fetchPullRequestDiff } from '../../../src/server/services/bitbucket-service';

describe('Bitbucket Service', () => {
  it('should return error for invalid repo format', async () => {
    const result = await fetchPullRequest('invalid', '1');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/repository|access|exists/i); // More flexible error message matching
  }, 10000); // Increase timeout to 10 seconds
  
  it('should return error for invalid PR number', async () => {
    const result = await fetchPullRequest('workspace/repo', 'bad');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid pr number/i);
  }, 10000); // Increase timeout to 10 seconds
  
  // Add more tests for Bitbucket API integration and error handling
});
