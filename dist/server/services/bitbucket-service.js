"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRepo = validateRepo;
exports.validatePrNumber = validatePrNumber;
exports.fetchPullRequest = fetchPullRequest;
exports.fetchPullRequestDiff = fetchPullRequestDiff;
// Service for Bitbucket API communication
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const BITBUCKET_API_URL = process.env.BITBUCKET_API_URL || 'https://api.bitbucket.org/2.0';
const BITBUCKET_USERNAME = process.env.BITBUCKET_USERNAME;
const BITBUCKET_APP_PASSWORD = process.env.BITBUCKET_APP_PASSWORD;
function validateRepo(repo) {
    return true;
    // console.log(`Validating repository: ${repo}`);
    // return /^\w[\w-]*\/\w[\w-]*$/.test(repo);
}
function validatePrNumber(prNumber) {
    return /^\d+$/.test(prNumber);
}
async function fetchPullRequest(repo, prNumber) {
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
    try {
        const url = `${BITBUCKET_API_URL}/repositories/${workspace}/${repoSlug}/pullrequests/${prNumber}`;
        console.log(`Fetching PR ${prNumber} for repo ${repoSlug} from ${url}`);
        const authHeader = `Basic ${Buffer.from(`${BITBUCKET_USERNAME}:${BITBUCKET_APP_PASSWORD}`).toString('base64')}`;
        const response = await axios_1.default.get(url, {
            headers: {
                Authorization: authHeader,
            },
        });
        console.info(`Fetched PR ${prNumber} for repo ${repoSlug} successfully.`);
        return { success: true, data: response.data };
    }
    catch (err) {
        console.error(`Error fetching PR ${prNumber} for repo ${repoSlug}:`, err);
        return { success: false, error: err.response?.data?.error?.message || err.message };
    }
}
async function fetchPullRequestDiff(repo, prNumber) {
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
        const authHeader = `Basic ${Buffer.from(`${BITBUCKET_USERNAME}:${BITBUCKET_APP_PASSWORD}`).toString('base64')}`;
        const response = await axios_1.default.get(`${BITBUCKET_API_URL}/repositories/${workspace}/${repoSlug}/pullrequests/${prNumber}/diff`, {
            headers: {
                Authorization: authHeader,
            },
            responseType: 'text',
        });
        console.info(`Fetched PR diff for ${repo} PR ${prNumber} successfully.`);
        return { success: true, data: { diff: response.data } };
    }
    catch (err) {
        console.error(`Error fetching PR diff for ${repo} PR ${prNumber}:`, err);
        return { success: false, error: err.response?.data?.error?.message || err.message };
    }
}
