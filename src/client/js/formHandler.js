// formHandler.js - Handles form submission and API communication

document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('pr-form');
  const loading = document.getElementById('loading-indicator');
  const errorMsg = document.getElementById('error-message');
  const descContainer = document.getElementById('pr-description-container');

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errorMsg.textContent = '';
    descContainer.textContent = '';
    loading.style.display = 'block';

    const repo = form.repo.value.trim();
    const prNumber = form['pr-number'].value.trim();
    if (!repo || !prNumber) {
      errorMsg.textContent = 'Both fields are required.';
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
      // Placeholder for backend API call
      // const response = await fetch('/api/generate-description', { ... });
      // const data = await response.json();
      // descContainer.textContent = data.description;
      descContainer.textContent = '[PR description will appear here]';
    } catch (err) {
      errorMsg.textContent = 'Failed to generate PR description.';
    } finally {
      loading.style.display = 'none';
    }
  });
});
