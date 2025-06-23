// config.js - Configuration settings for the frontend application

// API Configuration
const CONFIG = {
  // Base URL for the backend API
  API_BASE_URL: window.location.protocol + '//' + window.location.host,
  
  // API endpoints
  ENDPOINTS: {
    GENERATE_DESCRIPTION: '/api/generate-description',
    PROVIDERS: '/api/providers',
    TEMPLATES: '/api/templates',
    HEALTH: '/health'
  },
  
  // Request configuration
  REQUEST: {
    TIMEOUT: 30000, // 30 seconds timeout
    MAX_RETRIES: 2
  },
  
  // UI Configuration
  UI: {
    LOADING_DELAY: 200, // Delay before showing loading indicator
    ERROR_DISPLAY_TIME: 5000 // How long to show error messages
  }
};

// Export for use in other modules
window.CONFIG = CONFIG;
