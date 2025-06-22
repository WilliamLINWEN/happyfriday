# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

Build and run:
- `npm run dev` - Run development server with ts-node
- `npm run dev:watch` - Run dev server with auto-restart via nodemon
- `npm start` - Build and run production server
- `npm run build` - Compile TypeScript and copy templates to dist/
- `npm run build:watch` - Compile with watch mode

Testing and quality:
- `npm test` - Run Jest test suite
- `npm run lint` - Run ESLint on TypeScript files
- `npm run type-check` - Run TypeScript compiler without emitting files

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