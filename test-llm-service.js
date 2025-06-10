// Simple test to verify LLM service functionality
const { getLLMService } = require('./src/server/services/llm-service-registry');
const { TLLMProvider } = require('./src/types/llm-types');

async function testLLMService() {
  console.log('Testing LLM Service...');
  
  const llmService = getLLMService();
  
  // Test getting available providers
  console.log('Getting available providers...');
  const availableProviders = await llmService.getAvailableProviders();
  console.log('Available providers:', availableProviders);
  
  // Test static methods
  const samplePRData = {
    title: 'Add user authentication feature',
    description: 'Implements JWT-based authentication',
    diff: `@@ -1,3 +1,10 @@
+import jwt from 'jsonwebtoken';
+
+export function authenticateUser(token: string) {
+  return jwt.verify(token, process.env.JWT_SECRET);
+}
+
 export function getUser(id: string) {
   return database.findUser(id);
 }`,
    author: 'John Doe',
    sourceBranch: 'feature/auth',
    destinationBranch: 'main',
    repository: 'myorg/myrepo'
  };
  
  // Import the LLMService class to access static methods
  const { LLMService } = require('./src/server/services/llm-service');
  const formattedPrompt = LLMService.formatPRDataForPrompt(samplePRData);
  console.log('Formatted prompt length:', formattedPrompt.length);
  console.log('Prompt preview:', formattedPrompt.substring(0, 200) + '...');
  
  console.log('LLM Service test completed!');
}

testLLMService().catch(console.error);
