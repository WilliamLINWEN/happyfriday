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
    return /^\w[\w-]*\/\w[\w-]*$/.test(repo);
}
function validatePrNumber(prNumber) {
    return /^\d+$/.test(prNumber);
}
async function fetchPullRequest(repo, prNumber) {
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
        const response = await axios_1.default.get(`${BITBUCKET_API_URL}/repositories/${workspace}/${repoSlug}/pullrequests/${prNumber}`, {
            auth: {
                username: BITBUCKET_USERNAME,
                password: BITBUCKET_APP_PASSWORD,
            },
        });
        return { success: true, data: response.data };
    }
    catch (err) {
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
        const response = await axios_1.default.get(`${BITBUCKET_API_URL}/repositories/${workspace}/${repoSlug}/pullrequests/${prNumber}/diff`, {
            auth: {
                username: BITBUCKET_USERNAME,
                password: BITBUCKET_APP_PASSWORD,
            },
            responseType: 'text',
        });
        return { success: true, data: { diff: response.data } };
    }
    catch (err) {
        return { success: false, error: err.response?.data?.error?.message || err.message };
    }
}
