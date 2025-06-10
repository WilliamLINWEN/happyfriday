// test-integration.js - Simple integration test for frontend-backend communication

const axios = require('axios');

async function testIntegration() {
  console.log('🧪 Testing Frontend-Backend Integration...\n');

  try {
    // Test 1: Check if server is running
    console.log('1. Testing server health...');
    const healthResponse = await axios.get('http://localhost:3000/health');
    console.log('✅ Server is running:', healthResponse.data);

    // Test 2: Check available providers
    console.log('\n2. Testing available providers...');
    const providersResponse = await axios.get('http://localhost:3000/api/providers');
    console.log('✅ Providers endpoint working:', providersResponse.data);

    // Test 3: Test static file serving
    console.log('\n3. Testing static file serving...');
    const indexResponse = await axios.get('http://localhost:3000/');
    if (indexResponse.status === 200) {
      console.log('✅ Static files are being served correctly');
    }

    // Test 4: Test CORS headers
    console.log('\n4. Testing CORS configuration...');
    const corsResponse = await axios.options('http://localhost:3000/api/generate-description');
    console.log('✅ CORS is configured:', corsResponse.headers['access-control-allow-origin']);

    console.log('\n🎉 All integration tests passed!');
    console.log('\n📝 Next steps:');
    console.log('   - Set up environment variables for API keys');
    console.log('   - Test with actual Bitbucket repository and PR');
    console.log('   - Verify LLM providers are working');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the server is running with: npm run dev');
    }
  }
}

// Run the test
testIntegration();
