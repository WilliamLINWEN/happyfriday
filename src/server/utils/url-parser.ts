// URL parsing utility for Bitbucket PR URLs
export interface ParsedPRUrl {
  workspace: string;
  repository: string;
  prNumber: string;
  isValid: boolean;
  error?: string;
}

export class BitbucketUrlParser {
  // Supported Bitbucket PR URL patterns
  private static readonly URL_PATTERNS = [
    // Standard PR URL
    /^https?:\/\/bitbucket\.org\/([^\/]+)\/([^\/]+)\/pull-requests\/([^\/\?\s]+)\/?(\?.*)?$/,
    // PR URL with additional paths (diff, commits, etc.)
    /^https?:\/\/bitbucket\.org\/([^\/]+)\/([^\/]+)\/pull-requests\/([^\/\?\s]+)\/([^?\s]*?)(\?.*)?$/,
    // Legacy URL format
    /^https?:\/\/bitbucket\.org\/([^\/]+)\/([^\/]+)\/pullrequests\/([^\/\?\s]+)\/?(\?.*)?$/
  ];

  // General pattern to catch bitbucket PR URLs for validation
  private static readonly GENERAL_PR_PATTERN = /^https?:\/\/bitbucket\.org\/(.+?)\/(.+?)\/(pull-requests?|pullrequests?)\/(.+)$/;

  /**
   * Parse a Bitbucket PR URL and extract workspace, repository, and PR number
   * @param url - The Bitbucket PR URL to parse
   * @returns ParsedPRUrl object with extracted components
   */
  static parsePRUrl(url: string): ParsedPRUrl {
    if (typeof url !== 'string') {
      return {
        workspace: '',
        repository: '',
        prNumber: '',
        isValid: false,
        error: 'URL is required and must be a string'
      };
    }

    // Trim whitespace
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      return {
        workspace: '',
        repository: '',
        prNumber: '',
        isValid: false,
        error: 'URL cannot be empty'
      };
    }

    // Check if it's a Bitbucket URL
    if (!trimmedUrl.includes('bitbucket.org')) {
      return {
        workspace: '',
        repository: '',
        prNumber: '',
        isValid: false,
        error: 'URL must be from bitbucket.org'
      };
    }

    // First try the general pattern to see if it's a Bitbucket PR URL
    const generalMatch = trimmedUrl.match(this.GENERAL_PR_PATTERN);
    if (generalMatch) {
      const [, workspace, repository, , prPart] = generalMatch;
      // Extract just the PR number from the PR part (could have /diff, /commits, etc.)
      const prNumber = prPart.split('/')[0];
      
      // Validate extracted components
      const validation = this.validateComponents(workspace, repository, prNumber);
      if (!validation.isValid) {
        return {
          workspace: workspace || '',
          repository: repository || '',
          prNumber: prNumber || '',
          isValid: false,
          error: validation.error
        };
      }

      return {
        workspace,
        repository,
        prNumber,
        isValid: true
      };
    }

    // Try to match against supported patterns (fallback)
    for (const pattern of this.URL_PATTERNS) {
      const match = trimmedUrl.match(pattern);
      if (match) {
        const [, workspace, repository, prNumber] = match;
        
        // Validate extracted components
        const validation = this.validateComponents(workspace, repository, prNumber);
        if (!validation.isValid) {
          return {
            workspace: workspace || '',
            repository: repository || '',
            prNumber: prNumber || '',
            isValid: false,
            error: validation.error
          };
        }

        return {
          workspace,
          repository,
          prNumber,
          isValid: true
        };
      }
    }

    return {
      workspace: '',
      repository: '',
      prNumber: '',
      isValid: false,
      error: 'Invalid Bitbucket PR URL format. Expected: https://bitbucket.org/workspace/repository/pull-requests/123'
    };
  }

  /**
   * Validate extracted URL components
   * @private
   */
  private static validateComponents(workspace: string, repository: string, prNumber: string): { isValid: boolean; error?: string } {
    // Workspace validation
    if (!workspace || workspace.length < 1 || workspace.length > 100) {
      return { isValid: false, error: 'Invalid workspace name' };
    }

    // Repository validation
    if (!repository || repository.length < 1 || repository.length > 100) {
      return { isValid: false, error: 'Invalid repository name' };
    }

    // PR number validation
    const prNum = parseInt(prNumber, 10);
    if (isNaN(prNum) || prNum < 1 || prNum > 999999) {
      return { isValid: false, error: 'Invalid PR number' };
    }

    // Check for suspicious characters that might indicate injection attempts
    const suspiciousPatterns = [
      /[<>'"&;`$(){}[\]|\\]/g,
      /\.\.[\/\\]/g,
      /javascript:/gi,
      /<script/gi
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(workspace) || pattern.test(repository)) {
        return { isValid: false, error: 'Invalid characters in URL components' };
      }
    }

    return { isValid: true };
  }

  /**
   * Generate the repository string in the format expected by the Bitbucket API
   * @param workspace - The workspace name
   * @param repository - The repository name
   * @returns Repository string in format "workspace/repository"
   */
  static formatRepositoryString(workspace: string, repository: string): string {
    return `${workspace}/${repository}`;
  }

  /**
   * Check if a URL looks like a Bitbucket PR URL (basic check)
   * @param url - URL to check
   * @returns boolean indicating if it might be a Bitbucket PR URL
   */
  static isBitbucketPRUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }
    
    const trimmedUrl = url.trim().toLowerCase();
    return trimmedUrl.includes('bitbucket.org') && 
           (trimmedUrl.includes('/pull-requests/') || trimmedUrl.includes('/pullrequests/'));
  }
}