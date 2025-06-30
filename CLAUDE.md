# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Principles
*** IMPORTANT ***
1. Do not change/commit any code on main branch.
2. Please strictly adopt **Test-Driven Development (TDD)** approach for all code development tasks.

## TDD Development Workflow
Follow the standard **Red-Green-Refactor** cycle:

### 1. 🔴 Red Phase (Write Tests)
- **Write tests first**: Create failing test cases based on requirements
- Tests should clearly describe expected behavior
- Ensure tests fail (because functionality is not yet implemented)
- Focus on one small feature at a time

### 2. 🟢 Green Phase (Implement Functionality)
- Write the **minimum amount of code** to make tests pass
- Don't pursue perfect design, focus on making tests pass
- Avoid over-engineering

### 3. 🔵 Refactor Phase (Improve Code)
- After tests pass, optimize code quality
- Improve design, eliminate duplication, enhance readability
- Ensure all tests still pass after refactoring

## Test Writing Guidelines

### Test Naming
- Use descriptive test names that clearly express test purpose
- Format: `should_[expected_behavior]_when_[condition]`
- Example: `should_return_user_when_valid_id_provided`

### Test Structure (AAA Pattern)
```
// Arrange - Set up test data and environment
// Act - Execute the behavior being tested
// Assert - Verify the results
```

### Test Coverage
- **Unit Tests**: Test individual functions/methods
- **Integration Tests**: Test interactions between components
- **End-to-End Tests**: Test complete user workflows

## Code Development Requirements

### Development Order
1. Analyze requirements and identify core functionality
2. Write tests for minimum viable feature
3. Implement functionality to make tests pass
4. Refactor and optimize
5. Repeat above steps until all features are complete

### Code Quality Standards
- Keep functions small and focused (Single Responsibility Principle)
- Avoid deep nesting and complex logic
- Use meaningful variable and function names
- Add necessary comments for complex logic

## Testing Tools and Frameworks
This project uses **TypeScript + Express.js** with the following testing stack:
- **Test Framework**: Jest with ts-jest for TypeScript support
- **Test Environment**: Node.js for server tests, jsdom for client tests
- **HTTP Testing**: Supertest for API endpoint testing
- **Mock/Spy**: Jest built-in functionality
- **Type Checking**: TypeScript compiler + @types/jest

## TypeScript + Express.js Specific Guidelines

### API Test Structure
```typescript
describe('POST /api/generate-description', () => {
  it('should_generate_description_when_valid_pr_url_provided', async () => {
    // Arrange
    const requestData = { 
      prUrl: 'https://bitbucket.org/workspace/repo/pull-requests/123', 
      provider: 'openai' 
    };
    
    // Act
    const response = await request(app)
      .post('/api/generate-description')
      .send(requestData);
    
    // Assert
    expect(response.status).toBe(200);
    expect(response.body.description).toBeDefined();
  });
});
```

### Service Testing
Use mocks for external dependencies:
```typescript
jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

describe('LLMService', () => {
  it('should_process_chunks_when_diff_is_large', async () => {
    // Test chunking service logic
  });
});
```

## Common TDD Patterns

### Test Doubles
Use test doubles appropriately:
- **Mock**: Verify interaction behavior
- **Stub**: Provide predefined responses
- **Fake**: Simplified implementation
- **Spy**: Record call information

### Boundary Testing
Ensure tests cover:
- Normal cases (Happy Path)
- Boundary values
- Error cases
- Null/empty collection handling

## Workflow Checklist

For each new feature development:
- [ ] Understand requirements and acceptance criteria
- [ ] Write tests describing expected behavior
- [ ] Confirm tests fail
- [ ] Implement minimal code to make tests pass
- [ ] Run all tests to ensure no regression
- [ ] Refactor to improve code quality
- [ ] Repeat cycle until feature is complete

## Important Notes
- **Never skip tests**: Even simple features should have tests written first
- **Small steps**: Implement only one small feature at a time
- **Fast feedback**: Keep test execution fast
- **Tests as documentation**: Tests should clearly express code behavior
- **Continuous refactoring**: Regularly improve code structure and test quality


## Development Commands

Build and run:
- `npm run dev` - Run development server with ts-node
- `npm run dev:watch` - Run dev server with auto-restart via nodemon
- `npm start` - Build and run production server
- `npm run build` - Compile TypeScript and copy templates to dist/
- `npm run build:watch` - Compile with watch mode

Testing and quality:
- `npm test` - Run Jest test suite (includes server and client tests)
- `npm run lint` - Run ESLint on TypeScript files
- `npm run type-check` - Run TypeScript compiler without emitting files

Docker:
- `npm run docker:build` - Build Docker image
- `npm run docker:run` - Run Docker container with environment file
- `npm run docker:up` - Start services with docker-compose
- `npm run docker:down` - Stop docker-compose services
- `npm run docker:logs` - View docker-compose logs

Utilities:
- `npm run copy-templates` - Copy template files to dist/ directory

## Architecture Overview

This is a Bitbucket PR description generator service with a TypeScript/Express backend and vanilla JavaScript frontend.

### Core Components

**Server Structure (`src/server/`)**:
- `index.ts` - Main Express server with comprehensive security middleware, rate limiting, and error handling
- `api/` - REST endpoints for PR description generation (supports both regular and streaming responses)
- `services/` - Business logic layer with multiple LLM provider integrations
- `middleware/` - Security, rate limiting, and error handling middleware
- `utils/` - Logging, validation, and utility functions

**LLM Service Architecture**:
- Registry pattern (`llm-service-registry.ts`) for managing multiple LLM providers
- Base service class (`llm-service.ts`) with provider abstraction
- Individual provider services: OpenAI, Claude (Anthropic), Ollama
- LangChain integration for consistent provider interface
- Streaming support with fallback to non-streaming for unsupported providers
- Template system for consistent prompt formatting

**URL Parsing System**:
- `url-parser.ts` utility for parsing Bitbucket PR URLs
- Supports multiple URL formats: `/pull-requests/123`, `/pull-requests/123/diff`, etc.
- Comprehensive validation with security pattern detection
- Backward compatibility with legacy `repository + prNumber` format

**Frontend (`src/client/`)**:
- Vanilla HTML/CSS/JavaScript with form handling
- Real-time streaming support for LLM responses
- Responsive design with proper error handling

### Key Features

- **URL-based PR input**: Users can input Bitbucket PR URLs directly instead of separate repository/PR number fields
- Multiple LLM provider support (OpenAI, Claude, Ollama) with dynamic availability checking
- Real-time streaming responses with Server-Sent Events
- Comprehensive security middleware (headers, CORS, request validation, rate limiting)
- Robust error handling with request IDs and structured logging
- Template-based PR description generation with prompt optimization
- Backward compatibility with legacy repository + PR number format

### Environment Configuration

The application expects environment variables for LLM API keys:
- `OPENAI_API_KEY` - For OpenAI/GPT services
- `ANTHROPIC_API_KEY` - For Claude services  
- `OLLAMA_BASE_URL` - For local Ollama instances
- `BITBUCKET_USERNAME` - Bitbucket username for API access
- `BITBUCKET_APP_PASSWORD` - Bitbucket app password for authentication

### Docker Deployment

The application includes Docker support for containerized deployment:

**Quick Start with Docker:**
```bash
# Copy environment template
cp .env.example .env
# Edit .env with your API keys and Bitbucket credentials

# Start with docker-compose
npm run docker:up

# Access application at http://localhost:3000
```

**Docker Files:**
- `Dockerfile` - Multi-stage build with production optimization
- `docker-compose.yml` - Complete deployment configuration with environment variables
- `.dockerignore` - Excludes unnecessary files from Docker build context

**Docker Features:**
- Multi-stage build for optimized production image
- Non-root user for enhanced security
- Health check endpoint monitoring
- Comprehensive environment variable configuration
- Volume support for data persistence

### Testing

Tests are organized in `tests/` with separate client and server test suites. Use Jest for all testing with TypeScript support via ts-jest.

**Important test files**:
- `tests/server/utils/url-parser.test.ts` - URL parsing utility tests
- `tests/server/api/generate-description-url.test.ts` - API tests for URL input
- `tests/server/integration/url-parsing-integration.test.ts` - End-to-end integration tests

**API Input Formats**:
The `/api/generate-description` endpoint accepts either:
- URL format: `{ "prUrl": "https://bitbucket.org/workspace/repo/pull-requests/123", "provider": "openai" }`
- Legacy format: `{ "repository": "workspace/repo", "prNumber": "123", "provider": "openai" }`

### New Features

**Intelligent Diff Chunking**:
- Service for breaking large diffs into manageable chunks for LLM processing
- Three-tier chunking strategy: file-level → hunk-level → size-based with overlap
- Configurable chunk sizes and overlap to prevent context loss
- Smart boundary detection to avoid splitting within diff hunks

**File Filtering System**:
- Configurable pattern-based filtering to ignore irrelevant files (lock files, build artifacts, etc.)
- Supports glob patterns for flexible file matching
- Default patterns for common files: package-lock.json, *.lock, go.sum, etc.
- Environment variable configuration for easy customization

**Result Aggregation**:
- Intelligent merging of multiple chunk processing results
- Deduplication of similar descriptions
- Formatted output with bullet points for multiple changes
- Graceful handling of partial failures with appropriate error messages

**Configuration Files**:
- `src/server/services/diff-chunker-service.ts` - Core chunking logic
- `src/server/services/file-filter-service.ts` - File filtering and pattern matching
- `src/server/services/result-aggregator-service.ts` - Result merging and formatting

**Environment Variables**:
- `ENABLE_CHUNKING` - Enable/disable diff chunking (default: true)
- `DIFF_CHUNK_SIZE` - Maximum chunk size in characters (default: 4000)
- `DIFF_CHUNK_OVERLAP` - Overlap between chunks (default: 200)
- `MAX_CHUNKS` - Maximum number of chunks to process (default: 10)
- `ENABLE_FILE_FILTERING` - Enable/disable file filtering (default: true)
- `IGNORE_PATTERNS` - Comma-separated list of file patterns to ignore