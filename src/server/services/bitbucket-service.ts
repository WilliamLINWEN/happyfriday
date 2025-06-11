// Service for Bitbucket API communication
import axios from 'axios';
import dotenv from 'dotenv';
import { TBitbucketAPIResponse, TPullRequest, TPullRequestDiff } from '../../types/bitbucket-types';
import { CacheService } from './cache-service';
import { PerformanceMonitor } from '../utils/performance-monitor';

dotenv.config();

const BITBUCKET_API_URL = process.env.BITBUCKET_API_URL || 'https://api.bitbucket.org/2.0';
const BITBUCKET_USERNAME = process.env.BITBUCKET_USERNAME;
const BITBUCKET_APP_PASSWORD = process.env.BITBUCKET_APP_PASSWORD;
const cache = new CacheService<any>(parseInt(process.env.BITBUCKET_CACHE_TTL_MS || '60000'));

function validateRepo(repo: string): boolean {
  return true;
  // console.log(`Validating repository: ${repo}`);
  // return /^\w[\w-]*\/\w[\w-]*$/.test(repo);
}

function validatePrNumber(prNumber: string): boolean {
  return /^\d+$/.test(prNumber);
}

async function fetchPullRequest(repo: string, prNumber: string): Promise<TBitbucketAPIResponse<TPullRequest>> {
  const cacheKey = `pr:${repo}:${prNumber}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return { success: true, data: cached };
  }
  const [workspace, repoSlug] = repo.split('/');
  if (!validateRepo(repoSlug)) {
    return { success: false, error: 'Invalid repository format.' };
  }
  if (!validatePrNumber(prNumber)) {
    return { success: false, error: 'Invalid PR number.' };
  }
  if (!BITBUCKET_USERNAME || !BITBUCKET_APP_PASSWORD) {
    return { success: false, error: 'Bitbucket credentials not set.' };
  }
  const start = PerformanceMonitor.start('fetchPullRequest');
  try {
    const url = `${BITBUCKET_API_URL}/repositories/${workspace}/${repoSlug}/pullrequests/${prNumber}`;
    const authHeader = `Basic ${Buffer.from(`${BITBUCKET_USERNAME}:${BITBUCKET_APP_PASSWORD}`).toString('base64')}`;
    const response = await axios.get(url, {
      headers: {
        Authorization: authHeader,
      },
      timeout: parseInt(process.env.BITBUCKET_API_TIMEOUT_MS || '10000'),
    });
    PerformanceMonitor.end('fetchPullRequest', start);
    cache.set(cacheKey, response.data);
    return { success: true, data: response.data as TPullRequest };
  } catch (err: any) {
    PerformanceMonitor.end('fetchPullRequest', start);
    if (err.code === 'ECONNABORTED') {
      return { success: false, error: 'Bitbucket API request timed out.' };
    }
    if (err.response?.status === 429) {
      return { success: false, error: 'Bitbucket API rate limit exceeded.' };
    }
    return { success: false, error: err.response?.data?.error?.message || err.message };
  }
}

async function fetchPullRequestDiff(repo: string, prNumber: string): Promise<TBitbucketAPIResponse<TPullRequestDiff>> {
  const cacheKey = `diff:${repo}:${prNumber}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return { success: true, data: { diff: cached } };
  }
  if (!validateRepo(repo)) {
    return { success: false, error: 'Invalid repository format.' };
  }
  if (!validatePrNumber(prNumber)) {
    return { success: false, error: 'Invalid PR number.' };
  }
  if (!BITBUCKET_USERNAME || !BITBUCKET_APP_PASSWORD) {
    return { success: false, error: 'Bitbucket credentials not set.' };
  }
  const [workspace, repoSlug] = repo.split('/');
  const start = PerformanceMonitor.start('fetchPullRequestDiff');
  try {
    const authHeader = `Basic ${Buffer.from(`${BITBUCKET_USERNAME}:${BITBUCKET_APP_PASSWORD}`).toString('base64')}`;
    const response = await axios.get(`${BITBUCKET_API_URL}/repositories/${workspace}/${repoSlug}/pullrequests/${prNumber}/diff`,
      {
        headers: {
          Authorization: authHeader,
        },
        responseType: 'text',
        timeout: parseInt(process.env.BITBUCKET_API_TIMEOUT_MS || '10000'),
      }
    );
    PerformanceMonitor.end('fetchPullRequestDiff', start);
    // Handle very large diffs
    const maxDiffSize = parseInt(process.env.BITBUCKET_DIFF_MAX_SIZE || '1048576');
    if (response.data && typeof response.data === 'string' && response.data.length > maxDiffSize) {
      return { success: false, error: 'PR diff is too large to process.' };
    }
    cache.set(cacheKey, response.data);
    return { success: true, data: { diff: response.data as string } };
  } catch (err: any) {
    PerformanceMonitor.end('fetchPullRequestDiff', start);
    if (err.code === 'ECONNABORTED') {
      return { success: false, error: 'Bitbucket API request timed out.' };
    }
    if (err.response?.status === 429) {
      return { success: false, error: 'Bitbucket API rate limit exceeded.' };
    }
    if (err.response?.status === 413) {
      return { success: false, error: 'PR diff is too large to process.' };
    }
    return { success: false, error: err.response?.data?.error?.message || err.message };
  }
}

export {
  validateRepo,
  validatePrNumber,
  fetchPullRequest,
  fetchPullRequestDiff,
};
