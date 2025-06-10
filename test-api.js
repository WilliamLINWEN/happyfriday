// Simple API test script
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';

async function testAPI() {
  console.log('Testing API endpoints...\n');

  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ Health check:', healthResponse.data.success ? 'PASSED' : 'FAILED');
    console.log('   Available providers:', healthResponse.data.data.services.totalProviders);

    // Test providers endpoint
    console.log('\n2. Testing providers endpoint...');
    const providersResponse = await axios.get(`${API_BASE_URL}/api/providers`);
    console.log('✅ Providers check:', providersResponse.data.success ? 'PASSED' : 'FAILED');
    console.log('   Providers:', providersResponse.data.data.providers);

    // Test generate description endpoint (this will likely fail without proper credentials)
    console.log('\n3. Testing generate description endpoint...');
    try {
      const generateResponse = await axios.post(`${API_BASE_URL}/api/generate-description`, {
        repository: 'test/repo',
        prNumber: '1'
      });
      console.log('✅ Generate description:', generateResponse.data.success ? 'PASSED' : 'FAILED');
    } catch (error) {
      if (error.response) {
        console.log('⚠️  Generate description: Expected failure (validation/credentials)');
        console.log('   Status:', error.response.status);
        console.log('   Error:', error.response.data.error);
      } else {
        console.log('❌ Generate description: Unexpected error');
      }
    }

    console.log('\n🎉 API testing completed!');
  } catch (error) {
    console.error('❌ API test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure the server is running with: npm run dev');
    }
  }
}

// Run if called directly
if (require.main === module) {
  testAPI();
}

module.exports = { testAPI };
