// formHandler.js - Handles form submission and API communication

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

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errorMsg.textContent = '';
    descContainer.innerHTML = '';
    loading.style.display = 'block';
    loading.textContent = 'Fetching PR data from Bitbucket...';

    const repo = form.repo.value.trim();
    const prNumber = form['pr-number'].value.trim();
    const provider = form.provider.value;
    
    if (!repo || !prNumber) {
      errorMsg.textContent = 'Repository and PR number are required.';
      loading.style.display = 'none';
      return;
    }
    // Validate repo format (should be workspace/repo_slug)
    if (!/^\w[\w-]*\/\w[\w-]*$/.test(repo)) {
      errorMsg.textContent = 'Repository must be in workspace/repo_slug format.';
      loading.style.display = 'none';
      return;
    }
    if (!/^\d+$/.test(prNumber)) {
      errorMsg.textContent = 'PR number must be a valid number.';
      loading.style.display = 'none';
      return;
    }

    try {
      // Parse repository to get workspace and repo_slug
      const [workspace, repoSlug] = repo.split('/');
      
      // Prepare request payload
      const requestPayload = {
        repository: repo,
        prNumber: prNumber,
        provider: provider // Use the selected provider
      };

      // Make API call to backend
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
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        
        // Handle specific HTTP status codes
        switch (response.status) {
          case 400:
            throw new Error(`Invalid request: ${errorData.error || 'Please check your input.'}`);
          case 401:
            throw new Error('Authentication failed. Please check API credentials.');
          case 404:
            throw new Error('PR not found. Please check the repository and PR number.');
          case 429:
            throw new Error('Rate limit exceeded. Please try again later.');
          case 503:
            throw new Error('Service temporarily unavailable. Please try again later.');
          default:
            throw new Error(errorData.error || `Server error (${response.status}). Please try again.`);
        }
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        // Display the generated description
        displayPRDescription(data.data);
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
      loading.style.display = 'none';
    }
  });
});
