// formHandler.js - Fixed version with proper submit button loading behavior

// Enhanced validation patterns matching backend security
const VALIDATION_PATTERNS = {
  repository: /^[a-zA-Z0-9_\-\.\/]{1,100}$/,
  prNumber: /^[1-9]\d{0,5}$/, // 1 to 999999
  prUrl: /^https?:\/\/bitbucket\.org\/[^\/]+\/[^\/]+\/pull-requests?\/\d+/i,
  suspiciousPatterns: [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /\.\.[\/\\]/g,
    /[;&|`$(){}[\]]/g
  ]
};

// Initialize advanced options toggle
function initializeAdvancedOptions() {
  const toggleButton = document.getElementById('advanced-toggle');
  const toggleIcon = toggleButton.querySelector('.toggle-icon');
  const advancedContent = document.getElementById('advanced-content');
  
  toggleButton.addEventListener('click', function() {
    const isVisible = advancedContent.style.display !== 'none';
    
    if (isVisible) {
      // Hide advanced options
      advancedContent.style.display = 'none';
      toggleIcon.classList.remove('rotated');
    } else {
      // Show advanced options
      advancedContent.style.display = 'block';
      toggleIcon.classList.add('rotated');
    }
  });
}

// Initialize legacy format toggle
function initializeLegacyToggle() {
  const toggleButton = document.getElementById('legacy-toggle');
  const legacyInputs = document.getElementById('legacy-inputs');
  const prUrlInput = document.getElementById('pr-url');
  const repoInput = document.getElementById('repo');
  const prNumberInput = document.getElementById('pr-number');
  
  let isLegacyMode = false;
  
  toggleButton.addEventListener('click', function() {
    isLegacyMode = !isLegacyMode;
    
    if (isLegacyMode) {
      // Switch to legacy mode
      legacyInputs.style.display = 'block';
      prUrlInput.style.display = 'none';
      prUrlInput.required = false;
      repoInput.required = true;
      prNumberInput.required = true;
      toggleButton.textContent = 'Use PR URL instead';
      
      // Clear PR URL input
      prUrlInput.value = '';
    } else {
      // Switch to URL mode
      legacyInputs.style.display = 'none';
      prUrlInput.style.display = 'block';
      prUrlInput.required = true;
      repoInput.required = false;
      prNumberInput.required = false;
      toggleButton.textContent = 'Use separate repository and PR number instead';
      
      // Clear legacy inputs
      repoInput.value = '';
      prNumberInput.value = '';
    }
  });
}

// Enhanced input validation for both URL and legacy formats
function validateFormInput(prUrl, repository, prNumber) {
  const errors = [];
  
  // Check if using URL format
  if (prUrl) {
    if (!VALIDATION_PATTERNS.prUrl.test(prUrl)) {
      errors.push('Invalid Bitbucket PR URL format. Expected: https://bitbucket.org/workspace/repo/pull-requests/123');
    } else {
      // Check for suspicious patterns in URL
      for (const pattern of VALIDATION_PATTERNS.suspiciousPatterns) {
        if (pattern.test(prUrl)) {
          errors.push('PR URL contains invalid characters');
          break;
        }
      }
    }
  } else {
    // Legacy format validation
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

// Function to display PR description with metadata
function displayPRDescription(data) {
  const descContainer = document.getElementById('pr-description-container');
  
  // Store the generated description globally for keyboard shortcuts
  lastGeneratedDescription = data.generatedDescription;
  
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
  
  // Store reference for keyboard shortcuts
  lastCopyButton = copyButton;
  
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

// Function to copy text to clipboard with enhanced visual feedback
async function copyToClipboard(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    
    // Store original state
    const originalText = button.textContent;
    const originalClass = button.className;
    
    // Apply success state
    button.classList.add('copied');
    button.textContent = 'Copied!';
    
    // Provide haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    // Reset to original state after 2 seconds
    setTimeout(() => {
      button.textContent = originalText;
      button.className = originalClass;
    }, 2000);
    
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    
    // Show error state
    const originalText = button.textContent;
    const originalClass = button.className;
    
    button.textContent = 'Copy failed';
    button.style.background = '#dc3545';
    
    setTimeout(() => {
      button.textContent = originalText;
      button.className = originalClass;
      button.style.background = '';
    }, 2000);
  }
}

// Analytics event hook (stub)
function trackEvent(event, data) {
  // Integrate with analytics/monitoring here if needed
  // Example: window.gtag && window.gtag('event', event, data);
}

// Streaming function for real-time description generation
async function generateDescriptionStreaming(prUrl, repository, prNumber, provider = null, template = null, additionalContext = '') {
  const form = document.getElementById('pr-form');
  const submitBtn = form.querySelector('button[type="submit"]');
  const loadingDiv = document.getElementById('loading-indicator');
  const errorDiv = document.getElementById('error-message');
  const resultDiv = document.getElementById('pr-description-container');

  // Clear previous results
  errorDiv.textContent = '';
  resultDiv.innerHTML = '';
  
  // Show loading state
  setLoadingState(true, submitBtn, 'Generate Description');
  loadingDiv.style.display = 'block';
  loadingDiv.textContent = 'Starting streaming generation...';

  try {
    // Create a container for streaming content
    const streamingContainer = document.createElement('div');
    streamingContainer.className = 'streaming-container';
    streamingContainer.innerHTML = `
      <h3>Generating Description...</h3>
      <div class="streaming-content">
        <div class="original-pr-info"></div>
        <div class="streaming-text-container">
          <h4>Generated Description:</h4>
          <div class="streaming-text"></div>
          <div class="streaming-controls">
            <button class="copy-button streaming-copy-btn" style="display: none;">Copy Current Text</button>
          </div>
        </div>
      </div>
    `;
    
    resultDiv.appendChild(streamingContainer);
    resultDiv.style.display = 'block';

    const streamingText = streamingContainer.querySelector('.streaming-text');
    const originalPRInfo = streamingContainer.querySelector('.original-pr-info');
    const streamingCopyBtn = streamingContainer.querySelector('.streaming-copy-btn');
    
    // Add event listener for streaming copy button
    streamingCopyBtn.addEventListener('click', () => {
      const currentText = streamingText.textContent || '';
      if (currentText.trim()) {
        copyToClipboard(currentText, streamingCopyBtn);
      }
    });

    // Prepare request data
    const requestData = {};

    // Use URL format if provided, otherwise legacy format
    if (prUrl) {
      requestData.prUrl = sanitizeInput(prUrl);
    } else {
      requestData.repository = sanitizeInput(repository);
      requestData.prNumber = sanitizeInput(prNumber);
    }

    if (provider) {
      requestData.provider = provider;
    }

    if (template) {
      requestData.template = template;
    }

    if (additionalContext && additionalContext.trim()) {
      requestData.additionalContext = additionalContext.trim();
    }

    loadingDiv.textContent = 'Connecting to streaming service...';

    // Use fetch with streaming
    const response = await fetch('/api/generate-description/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    loadingDiv.textContent = 'Receiving data...';

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete SSE messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          const event = line.slice(7);
          continue;
        }
        
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            // Handle different event types
            if (data.error) {
              throw new Error(data.error);
            }
            
            if (data.originalPR) {
              // Display original PR information
              originalPRInfo.innerHTML = `
                <div class="original-pr" data-original-pr='${JSON.stringify(data.originalPR)}'>
                  <h4>Original PR Information:</h4>
                  <p><strong>Title:</strong> ${escapeHtml(data.originalPR.title)}</p>
                  <p><strong>Author:</strong> ${escapeHtml(data.originalPR.author)}</p>
                  <p><strong>Branch:</strong> ${escapeHtml(data.originalPR.sourceBranch)} → ${escapeHtml(data.originalPR.destinationBranch)}</p>
                  <p><strong>Repository:</strong> ${escapeHtml(data.originalPR.repository)}</p>
                </div>
              `;
              loadingDiv.textContent = 'Generating description...';
            }
            
            if (data.token) {
              // Append new token to streaming text
              streamingText.textContent = data.content || '';
              // Auto-scroll to bottom
              streamingText.scrollTop = streamingText.scrollHeight;
              
              // Show copy button when text starts appearing
              if ((data.content || '').trim() && streamingCopyBtn.style.display === 'none') {
                streamingCopyBtn.style.display = 'inline-flex';
              }
            }
            
            if (data.generatedDescription && data.metadata) {
              // Generation complete - display final result
              loadingDiv.style.display = 'none';
              
              // Get original PR data
              const originalPRElement = originalPRInfo.querySelector('.original-pr');
              const originalPRData = originalPRElement ? 
                JSON.parse(originalPRElement.dataset.originalPr || '{}') : {};
              
              // Replace streaming container with final result
              streamingContainer.remove();
              
              displayPRDescription({
                generatedDescription: data.generatedDescription,
                originalPR: originalPRData,
                metadata: data.metadata
              });
            }
            
          } catch (parseError) {
            console.warn('Failed to parse SSE data:', parseError);
          }
        }
      }
    }

  } catch (error) {
    console.error('Streaming error:', error);
    
    // Hide loading and show error
    loadingDiv.style.display = 'none';
    
    displayError(error.message || 'An error occurred during streaming generation');
    
  } finally {
    // Reset button state
    setLoadingState(false, submitBtn, 'Generate Description');
  }
}

// Global variables for keyboard shortcuts
let lastGeneratedDescription = '';
let lastCopyButton = null;

// Function to handle keyboard shortcuts
function handleKeyboardShortcuts(event) {
  // Ctrl+C (or Cmd+C on Mac) when description container is focused or visible
  if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
    const descContainer = document.getElementById('pr-description-container');
    const streamingText = document.querySelector('.streaming-text');
    
    // Check if user is not in an input field
    const isInInput = event.target.tagName === 'INPUT' || 
                     event.target.tagName === 'TEXTAREA' || 
                     event.target.isContentEditable;
    
    if (!isInInput && (descContainer.children.length > 0 || streamingText)) {
      event.preventDefault();
      
      // Try to copy from the main description first
      const copyButton = document.querySelector('.pr-description-section .copy-button');
      if (copyButton && lastGeneratedDescription) {
        copyToClipboard(lastGeneratedDescription, copyButton);
        return;
      }
      
      // Fall back to streaming text if available
      if (streamingText && streamingText.textContent.trim()) {
        const streamingCopyBtn = document.querySelector('.streaming-copy-btn');
        if (streamingCopyBtn) {
          copyToClipboard(streamingText.textContent, streamingCopyBtn);
        }
      }
    }
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
  
  // Add keyboard shortcut listener
  document.addEventListener('keydown', handleKeyboardShortcuts);

  // Initialize advanced options toggle
  initializeAdvancedOptions();
  
  // Initialize legacy format toggle
  initializeLegacyToggle();

  // Check available providers on page load
  checkAvailableProviders();

  // Check available templates on page load
  checkAvailableTemplates();

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

  async function checkAvailableTemplates() {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.TEMPLATES}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.templates) {
          updateTemplateOptions(data.data.templates);
        }
      }
    } catch (error) {
      console.warn('Could not check available templates:', error);
      // Set default template options
      setDefaultTemplateOptions();
    }
  }

  function updateTemplateOptions(availableTemplates) {
    const templateSelect = document.getElementById('template');
    const templateDescription = document.getElementById('template-description');
    const templateDescriptionText = templateDescription.querySelector('.template-description-text');
    
    // Clear existing options
    templateSelect.innerHTML = '';
    
    // Add templates as options
    availableTemplates.forEach(template => {
      const option = document.createElement('option');
      option.value = template.filename;
      option.textContent = template.metadata.name;
      option.dataset.description = template.metadata.description;
      templateSelect.appendChild(option);
    });

    // Set default selection (prefer English template if available, otherwise first template)
    const defaultTemplate = availableTemplates.find(t => t.filename.includes('-en.txt')) || availableTemplates[0];
    if (defaultTemplate) {
      templateSelect.value = defaultTemplate.filename;
      showTemplateDescription(defaultTemplate.metadata.description);
    }

    // Add event listener for template selection changes
    templateSelect.addEventListener('change', function() {
      const selectedOption = this.options[this.selectedIndex];
      if (selectedOption && selectedOption.dataset.description) {
        showTemplateDescription(selectedOption.dataset.description);
      } else {
        hideTemplateDescription();
      }
    });
  }

  function setDefaultTemplateOptions() {
    const templateSelect = document.getElementById('template');
    templateSelect.innerHTML = `
      <option value="pr-description-template-zh.txt">標準 PR 描述 (中文)</option>
      <option value="pr-description-template-en.txt">Standard PR Description (English)</option>
    `;
    templateSelect.value = 'pr-description-template-en.txt';
  }

  function showTemplateDescription(description) {
    const templateDescription = document.getElementById('template-description');
    const templateDescriptionText = templateDescription.querySelector('.template-description-text');
    
    templateDescriptionText.textContent = description;
    templateDescription.style.display = 'block';
  }

  function hideTemplateDescription() {
    const templateDescription = document.getElementById('template-description');
    templateDescription.style.display = 'none';
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errorMsg.textContent = '';
    descContainer.innerHTML = '';
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    
    // Get form values
    const prUrl = sanitizeInput(form['pr-url'].value.trim());
    const repo = sanitizeInput(form.repo.value.trim());
    const prNumber = sanitizeInput(form['pr-number'].value.trim());
    const provider = form.provider.value;
    const template = document.getElementById('template').value;
    const streamingMode = document.getElementById('streaming-mode').checked;
    const additionalContext = sanitizeInput(form['additional-context'].value.trim());
    
    const validationErrors = validateFormInput(prUrl, repo, prNumber);
    if (validationErrors.length > 0) {
      displayError(validationErrors.join('. '));
      return;
    }

    // Use streaming if enabled
    if (streamingMode) {
      await generateDescriptionStreaming(prUrl, repo, prNumber, provider, template, additionalContext);
      return;
    }
    setLoadingState(true, submitButton, originalButtonText);
    loading.style.display = 'block';
    loading.textContent = 'Fetching PR data from Bitbucket...';
    let retries = 0;
    const maxRetries = CONFIG.REQUEST.MAX_RETRIES;
    let lastError = null;
    while (retries <= maxRetries) {
      try {
        const requestPayload = { 
          provider: provider,
          template: template || undefined,
          additionalContext: additionalContext || undefined
        };
        
        // Add URL or legacy format
        if (prUrl) {
          requestPayload.prUrl = prUrl;
        } else {
          requestPayload.repository = repo;
          requestPayload.prNumber = prNumber;
        }
        loading.textContent = `Generating description using ${provider.toUpperCase()}...`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST.TIMEOUT);
        const response = await fetch(`${CONFIG.API_BASE_URL}${CONFIG.ENDPOINTS.GENERATE_DESCRIPTION}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestPayload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ success: false, error: { message: 'Unknown error' } }));
          switch (response.status) {
            case 400:
              throw new Error(errorData.error?.message || errorData.error || 'Invalid request. Please check your input.');
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
            case 413:
              throw new Error('PR diff is too large to process.');
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
          displayPRDescription(data.data);
          trackEvent('pr_description_generated', { provider, repo, prNumber });
        } else {
          throw new Error(data.error || 'Failed to generate PR description');
        }
        break; // Success, exit retry loop
      } catch (err) {
        lastError = err;
        if (err.name === 'AbortError' || err.name === 'TimeoutError') {
          errorMsg.textContent = 'Request timed out. Please try again.';
          trackEvent('timeout', { provider, repo, prNumber });
        } else if (err.message && err.message.includes('Rate limit')) {
          errorMsg.textContent = err.message;
          trackEvent('rate_limit', { provider, repo, prNumber });
          break; // Do not retry on rate limit
        } else if (err.message && err.message.includes('diff is too large')) {
          errorMsg.textContent = err.message;
          trackEvent('large_diff', { provider, repo, prNumber });
          break; // Do not retry on large diff
        } else if (retries < maxRetries) {
          retries++;
          errorMsg.textContent = `Network error. Retrying (${retries}/${maxRetries})...`;
          trackEvent('retry', { provider, repo, prNumber, attempt: retries });
          await new Promise(res => setTimeout(res, 500));
          continue;
        } else {
          errorMsg.textContent = err.message || 'Failed to generate PR description. Please try again.';
          trackEvent('error', { provider, repo, prNumber, error: err.message });
        }
        break;
      }
    }
    setLoadingState(false, submitButton, originalButtonText);
    loading.style.display = 'none';
  });

  console.log('Form handler setup complete');
});
