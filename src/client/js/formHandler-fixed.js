// formHandler.js - Fixed version with proper submit button loading behavior

// Enhanced validation patterns matching backend security
const VALIDATION_PATTERNS = {
  repository: /^[a-zA-Z0-9_\-\.\/]{1,100}$/,
  prNumber: /^[1-9]\d{0,5}$/, // 1 to 999999
  suspiciousPatterns: [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /\.\.[\/\\]/g,
    /[;&|`$(){}[\]]/g
  ]
};

// Enhanced input validation
function validateFormInput(repository, prNumber) {
  const errors = [];
  
  // Repository validation
  if (!repository) {
    errors.push('Repository is required');
  } else if (!VALIDATION_PATTERNS.repository.test(repository)) {
    errors.push('Repository format is invalid. Use format: username/repository');
  } else {
    // Check for suspicious patterns
    for (const pattern of VALIDATION_PATTERNS.suspiciousPatterns) {
      if (pattern.test(repository)) {
        errors.push('Repository contains invalid characters');
        break;
      }
    }
  }
  
  // PR Number validation
  if (!prNumber) {
    errors.push('PR number is required');
  } else if (!VALIDATION_PATTERNS.prNumber.test(prNumber)) {
    errors.push('PR number must be between 1 and 999999');
  }
  
  return errors;
}

// Sanitize input to prevent XSS
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    // Note: Don't sanitize forward slashes for repository names as they are legitimate
    .trim();
}

// Enhanced error display with better security
function displayError(message, isTemporary = false) {
  const errorContainer = document.getElementById('error-container') || createErrorContainer();
  
  // Sanitize error message
  const safeMessage = sanitizeInput(message);
  
  errorContainer.innerHTML = `
    <div class="alert alert-error" role="alert">
      <span class="error-icon">⚠️</span>
      <span class="error-message">${safeMessage}</span>
      <button class="error-close" onclick="this.parentElement.parentElement.style.display='none'" aria-label="Close error">×</button>
    </div>
  `;
  
  errorContainer.style.display = 'block';
  
  // Auto-hide temporary errors
  if (isTemporary) {
    setTimeout(() => {
      errorContainer.style.display = 'none';
    }, 5000);
  }
}

function createErrorContainer() {
  const container = document.createElement('div');
  container.id = 'error-container';
  container.className = 'error-container';
  container.style.display = 'none';
  
  const form = document.getElementById('pr-form');
  form.parentNode.insertBefore(container, form);
  
  return container;
}

// Function to display PR description with metadata
function displayPRDescription(data) {
  const descContainer = document.getElementById('pr-description-container');
  
  // Clear existing content
  descContainer.innerHTML = '';
  
  // Create main description section
  const descSection = document.createElement('div');
  descSection.className = 'pr-description-section';
  
  const descTitle = document.createElement('h3');
  descTitle.textContent = 'Generated PR Description';
  descTitle.className = 'pr-description-title';
  
  const descContent = document.createElement('div');
  descContent.className = 'pr-description-content';
  descContent.textContent = data.generatedDescription;
  
  // Add copy button
  const copyButton = document.createElement('button');
  copyButton.textContent = 'Copy to Clipboard';
  copyButton.className = 'copy-button';
  copyButton.onclick = () => copyToClipboard(data.generatedDescription, copyButton);
  
  descSection.appendChild(descTitle);
  descSection.appendChild(descContent);
  descSection.appendChild(copyButton);
  
  // Create metadata section
  const metaSection = document.createElement('div');
  metaSection.className = 'pr-metadata-section';
  
  const metaTitle = document.createElement('h4');
  metaTitle.textContent = 'PR Information';
  metaTitle.className = 'pr-metadata-title';
  
  const metaContent = document.createElement('div');
  metaContent.className = 'pr-metadata-content';
  
  if (data.originalPR) {
    metaContent.innerHTML = `
      <p><strong>Title:</strong> ${escapeHtml(data.originalPR.title)}</p>
      <p><strong>Author:</strong> ${escapeHtml(data.originalPR.author)}</p>
      <p><strong>Repository:</strong> ${escapeHtml(data.originalPR.repository)}</p>
      <p><strong>Branch:</strong> ${escapeHtml(data.originalPR.sourceBranch)} → ${escapeHtml(data.originalPR.destinationBranch)}</p>
    `;
  }
  
  if (data.metadata) {
    metaContent.innerHTML += `
      <p><strong>Provider:</strong> ${escapeHtml(data.metadata.provider)} (${escapeHtml(data.metadata.model || 'default')})</p>
      <p><strong>Processing Time:</strong> ${data.metadata.processingTimeMs}ms</p>
    `;
  }
  
  metaSection.appendChild(metaTitle);
  metaSection.appendChild(metaContent);
  
  // Add sections to container
  descContainer.appendChild(descSection);
  descContainer.appendChild(metaSection);
}

// Utility function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Function to copy text to clipboard
async function copyToClipboard(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    button.style.backgroundColor = '#4caf50';
    
    setTimeout(() => {
      button.textContent = originalText;
      button.style.backgroundColor = '';
    }, 2000);
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    button.textContent = 'Copy failed';
    setTimeout(() => {
      button.textContent = 'Copy to Clipboard';
    }, 2000);
  }
}

document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('pr-form');
  const loading = document.getElementById('loading-indicator');
  const errorMsg = document.getElementById('error-message');
  const descContainer = document.getElementById('pr-description-container');
  const providerSelect = document.getElementById('provider');

  if (!form) {
    console.error('Form element not found!');
    return;
  }

  // Check available providers on page load
  checkAvailableProviders();

  async function checkAvailableProviders() {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.PROVIDERS}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.availableProviders) {
          updateProviderOptions(data.data.availableProviders);
        }
      }
    } catch (error) {
      console.warn('Could not check available providers:', error);
      // Continue with default options
    }
  }

  function updateProviderOptions(availableProviders) {
    const options = providerSelect.querySelectorAll('option');
    options.forEach(option => {
      const provider = option.value;
      if (!availableProviders.includes(provider)) {
        option.disabled = true;
        option.textContent += ' (Not configured)';
      }
    });

    // Select the first available provider
    const firstAvailable = Array.from(options).find(option => !option.disabled);
    if (firstAvailable) {
      firstAvailable.selected = true;
    }
  }

  // Function to handle loading state for submit button
  function setLoadingState(isLoading, button, originalText) {
    console.log('setLoadingState:', { isLoading, button: !!button, originalText });
    
    if (!button) {
      console.error('Button not provided to setLoadingState');
      return;
    }
    
    if (isLoading) {
      button.disabled = true;
      button.textContent = 'Generating...';
      button.style.opacity = '0.7';
      button.style.cursor = 'not-allowed';
      button.style.background = '#94a3b8';
      console.log('Button set to loading state');
    } else {
      button.disabled = false;
      button.textContent = originalText || 'Generate Description';
      button.style.opacity = '1';
      button.style.cursor = 'pointer';
      button.style.background = '#0052cc';
      console.log('Button restored to normal state');
    }
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    console.log('Form submitted');
    
    // Clear previous messages
    errorMsg.textContent = '';
    descContainer.innerHTML = '';
    
    // Get submit button and store original text FIRST
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton ? submitButton.textContent : 'Generate Description';
    
    console.log('Submit button found:', !!submitButton, 'Original text:', originalButtonText);
    
    // Get and sanitize input values
    const repo = sanitizeInput(form.repo.value.trim());
    const prNumber = sanitizeInput(form['pr-number'].value.trim());
    const provider = form.provider.value;
    
    // Enhanced client-side validation
    const validationErrors = validateFormInput(repo, prNumber);
    if (validationErrors.length > 0) {
      console.log('Validation errors:', validationErrors);
      displayError(validationErrors.join('. '));
      return; // Exit early on validation error
    }
    
    // Only start loading state after validation passes
    console.log('Starting loading state...');
    setLoadingState(true, submitButton, originalButtonText);
    loading.style.display = 'block';
    loading.textContent = 'Fetching PR data from Bitbucket...';

    try {
      // Prepare request payload with sanitized data
      const requestPayload = {
        repository: repo,
        prNumber: prNumber,
        provider: provider
      };

      // Make API call to backend with enhanced error handling
      loading.textContent = `Generating description using ${provider.toUpperCase()}...`;
      
      const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.GENERATE_DESCRIPTION}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
        signal: AbortSignal.timeout(CONFIG.REQUEST.TIMEOUT)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          success: false, 
          error: { message: 'Unknown error' } 
        }));
        
        // Handle specific HTTP status codes with better error messages
        switch (response.status) {
          case 400:
            const message = errorData.error?.message || errorData.error || 'Invalid request. Please check your input.';
            throw new Error(message);
          case 401:
            throw new Error('Authentication failed. Please check API credentials.');
          case 403:
            throw new Error('Access denied. Please check your permissions.');
          case 404:
            throw new Error('PR not found. Please check the repository and PR number.');
          case 429:
            const retryAfter = response.headers.get('Retry-After');
            const retryMessage = retryAfter ? ` Please try again in ${retryAfter} seconds.` : ' Please try again later.';
            throw new Error('Rate limit exceeded.' + retryMessage);
          case 500:
            throw new Error('Server error. Please try again later.');
          case 502:
            throw new Error('Bad gateway. The server is temporarily unavailable.');
          case 503:
            throw new Error('Service temporarily unavailable. Please try again later.');
          default:
            throw new Error(errorData.error?.message || errorData.error || `Server error (${response.status}). Please try again.`);
        }
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        // Display the generated description
        displayPRDescription(data.data);
        console.log('Successfully displayed PR description');
      } else {
        throw new Error(data.error || 'Failed to generate PR description');
      }

    } catch (err) {
      console.error('Error generating PR description:', err);
      
      if (err.name === 'TimeoutError') {
        errorMsg.textContent = 'Request timed out. Please try again.';
      } else if (err.name === 'TypeError' && err.message.includes('fetch')) {
        errorMsg.textContent = 'Network error. Please check your connection and try again.';
      } else {
        errorMsg.textContent = err.message || 'Failed to generate PR description. Please try again.';
      }
    } finally {
      // Always reset loading state in finally block
      console.log('Resetting loading state...');
      setLoadingState(false, submitButton, originalButtonText);
      loading.style.display = 'none';
    }
  });

  console.log('Form handler setup complete');
});
