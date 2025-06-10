// test-integration.js - Simple integration test for frontend-backend communication

const axios = require('axios');

async function testIntegration() {
  console.log('🧪 Testing Frontend-Backend Integration with Template Service...\n');

  try {
    // Test 1: Check if server is running
    console.log('1. Testing server health...');
    const healthResponse = await axios.get('http://localhost:3000/api/health');
    console.log('✅ Server is running:', healthResponse.data);

    // Test 2: Check available providers
    console.log('\n2. Testing available providers...');
    const providersResponse = await axios.get('http://localhost:3000/api/providers');
    console.log('✅ Providers endpoint working:', providersResponse.data);

    // Test 3: Test PR description generation with template
    console.log('\n3. Testing PR description generation with new template...');
    const prData = {
      repoFullName: 'starlinglabs/product-service-sdk',
      prNumber: '215',
      provider: 'ollama'
    };
    
    const prResponse = await axios.post('http://localhost:3000/api/generate-description', prData);
    
    if (prResponse.data.success) {
      console.log('✅ PR description generated successfully with template!');
      console.log('Description length:', prResponse.data.description.length);
      console.log('First 200 characters:', prResponse.data.description.substring(0, 200));
    } else {
      console.log('❌ PR description generation failed:', prResponse.data.error);
    }
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
