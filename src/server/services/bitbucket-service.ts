// Service for Bitbucket API communication
import axios from 'axios';
import dotenv from 'dotenv';
import { TBitbucketAPIResponse, TPullRequest, TPullRequestDiff } from '../../types/bitbucket-types';

dotenv.config();

const BITBUCKET_API_URL = process.env.BITBUCKET_API_URL || 'https://api.bitbucket.org/2.0';
const BITBUCKET_USERNAME = process.env.BITBUCKET_USERNAME;
const BITBUCKET_APP_PASSWORD = process.env.BITBUCKET_APP_PASSWORD;

function validateRepo(repo: string): boolean {
  return /^\w[\w-]*\/\w[\w-]*$/.test(repo);
}

function validatePrNumber(prNumber: string): boolean {
  return /^\d+$/.test(prNumber);
}

async function fetchPullRequest(repo: string, prNumber: string): Promise<TBitbucketAPIResponse<TPullRequest>> {
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
  try {
    const response = await axios.get(`${BITBUCKET_API_URL}/repositories/${workspace}/${repoSlug}/pullrequests/${prNumber}`,
      {
        auth: {
          username: BITBUCKET_USERNAME,
          password: BITBUCKET_APP_PASSWORD,
        },
      }
    );
    return { success: true, data: response.data as TPullRequest };
  } catch (err: any) {
    return { success: false, error: err.response?.data?.error?.message || err.message };
  }
}

async function fetchPullRequestDiff(repo: string, prNumber: string): Promise<TBitbucketAPIResponse<TPullRequestDiff>> {
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
  try {
    const response = await axios.get(`${BITBUCKET_API_URL}/repositories/${workspace}/${repoSlug}/pullrequests/${prNumber}/diff`,
      {
        auth: {
          username: BITBUCKET_USERNAME,
          password: BITBUCKET_APP_PASSWORD,
        },
        responseType: 'text',
      }
    );
    return { success: true, data: { diff: response.data as string } };
  } catch (err: any) {
    return { success: false, error: err.response?.data?.error?.message || err.message };
  }
}

export {
  validateRepo,
  validatePrNumber,
  fetchPullRequest,
  fetchPullRequestDiff,
};
