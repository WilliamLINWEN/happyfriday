# Bitbucket PR Description Generator

## Overview
A web application that generates detailed Bitbucket Pull Request (PR) descriptions using LLMs (OpenAI, Claude, Ollama). Users input a repository and PR number, and the app fetches PR details from Bitbucket, processes them with an LLM, and displays a rich, formatted description.

## Features
- Frontend form for repo and PR number input
- Provider selection (OpenAI, Claude, Ollama)
- Real-time PR description generation
- Copy-to-clipboard, loading states, error handling
- Secure backend with Express, TypeScript, and robust validation
- Modular service architecture for Bitbucket and LLM APIs

## Setup Instructions
1. **Clone the repository**
2. **Install dependencies**
   ```sh
   npm install
   ```
3. **Configure environment variables**
   - Copy `.env.example` to `.env` and fill in your API keys and settings
4. **Start the development server**
   ```sh
   npm run dev
   ```
5. **Access the app**
   - Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Variables
See `.env.example` for all required variables:
- `BITBUCKET_API_URL`, `BITBUCKET_USERNAME`, `BITBUCKET_APP_PASSWORD`
- `OPENAI_API_KEY`, `CLAUDE_API_KEY`, `OLLAMA_API_KEY`
- `OLLAMA_API_URL`, `OLLAMA_MODEL`
- Rate limiting and security settings

## API Endpoints
See [docs/api.md](api.md) for detailed API documentation.

## Testing
- **Unit tests:** Run with `npm test`
- **Integration tests:** Run `node test-integration.js`
- **API tests:** Run `node test-api.js`
- **LLM service tests:** Run `node test-llm-service.js`

## Development Guidelines
- Follow [shrimp-rules.md](../.shrimp_data/shrimp-rules.md) for code standards
- Use JSDoc for TypeScript functions
- Add/modify tests for all new features
- Never store API keys in code

## Security
- See [docs/security.md](security.md) for security features and best practices

## Contributing
- Fork, branch, and submit PRs with clear descriptions
- Add/modify tests and documentation for all changes

---
