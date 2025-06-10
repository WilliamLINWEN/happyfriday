# Bitbucket PR Description Generator

## Overview
A web application that generates detailed Bitbucket Pull Request (PR) descriptions using LLMs (OpenAI, Claude, Ollama). Users input a repository and PR number, and the app fetches PR details from Bitbucket, processes them with an LLM, and displays a rich, formatted description.

## Technology Stack
- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Node.js, Express, TypeScript
- **LLM Providers**: OpenAI, Claude (Anthropic), Ollama
- **APIs**: Bitbucket REST API
- **Testing**: Jest, Supertest
- **Linting**: ESLint with TypeScript support

## Prerequisites
- Node.js (v16 or higher) - Check with `node --version`
- npm (v7 or higher) or yarn package manager - Check with `npm --version`
- Bitbucket account with app password ([setup guide](https://support.atlassian.com/bitbucket-cloud/docs/app-passwords/))
- At least one LLM provider API key:
  - OpenAI API key ([get here](https://platform.openai.com/api-keys))
  - Claude API key ([get here](https://console.anthropic.com/))
  - Ollama local installation ([install guide](https://ollama.ai/))

## Features
- Frontend form for repo and PR number input
- Provider selection (OpenAI, Claude, Ollama)
- Real-time PR description generation
- Copy-to-clipboard, loading states, error handling
- Secure backend with Express, TypeScript, and robust validation
- Modular service architecture for Bitbucket and LLM APIs

## Quick Start
```sh
# Clone and setup
git clone <repository-url>
cd happy-friday
npm install

# Configure environment (copy and edit .env file)
cp .env.example .env

# Start development server
npm run dev

# Open http://localhost:3000 in your browser
```

## Setup Instructions
1. **Clone the repository**
   ```sh
   git clone <repository-url>
   cd happy-friday
   ```
2. **Install dependencies**
   ```sh
   npm install
   ```
3. **Configure environment variables**
   - Copy `.env.example` to `.env` and fill in your API keys and settings
   ```sh
   cp .env.example .env
   ```
4. **Start the development server**
   ```sh
   npm run dev
   ```
   - For auto-restart on changes: `npm run dev:watch`
5. **Access the app**
   - Open [http://localhost:3000](http://localhost:3000) in your browser

## Production Setup
1. **Build the application**
   ```sh
   npm run build
   ```
2. **Start the production server**
   ```sh
   npm start
   ```

## Available Scripts
- `npm run dev` - Start development server with ts-node
- `npm run dev:watch` - Start development server with auto-restart (nodemon)
- `npm run build` - Build TypeScript to JavaScript and copy templates
- `npm run build:watch` - Build in watch mode
- `npm start` - Start production server (requires build first)
- `npm test` - Run Jest unit tests
- `npm run lint` - Run ESLint for code quality
- `npm run type-check` - Run TypeScript compiler without emitting files

## Environment Variables
See `.env.example` for all required variables:
- **Bitbucket**: `BITBUCKET_API_URL`, `BITBUCKET_USERNAME`, `BITBUCKET_APP_PASSWORD`
- **OpenAI**: `OPENAI_API_KEY`, `OPEN_MODEL`
- **Claude**: `CLAUDE_API_KEY`, `CLAUDE_MODEL`
- **Ollama**: `OLLAMA_API_KEY`, `OLLAMA_API_URL`, `OLLAMA_MODEL`
- **Server**: `PORT`, `NODE_ENV`
- Rate limiting and security settings

## Project Structure
```
├── src/
│   ├── client/          # Frontend files (HTML, CSS, JS)
│   ├── server/          # Backend Express application
│   │   ├── api/         # API route handlers
│   │   ├── middleware/  # Express middleware
│   │   ├── services/    # Business logic services
│   │   └── utils/       # Utility functions
│   ├── templates/       # PR description templates
│   └── types/           # TypeScript type definitions
├── tests/               # Test files
├── docs/                # Documentation
└── dist/                # Compiled output (after build)
```

## API Endpoints
See [docs/api.md](api.md) for detailed API documentation.

## Testing
- **Unit tests:** `npm test` (Jest test suite)
- **Integration tests:** `node test-integration.js`
- **API tests:** `node test-api.js`
- **LLM service tests:** `node test-llm-service.js`
- **Template tests:** `node test-template.js`
- **Client tests:** Located in `tests/client/`

All tests should pass before submitting PRs. Run `npm run lint` to check code quality.

## Development Guidelines
- Follow [shrimp-rules.md](../.shrimp_data/shrimp-rules.md) for code standards
- Use JSDoc for TypeScript functions
- Add/modify tests for all new features
- Never store API keys in code

## Security
- See [docs/security.md](security.md) for security features and best practices

## Troubleshooting

### Common Issues

**Port already in use:**
```sh
# Kill process using port 3000
lsof -ti:3000 | xargs kill -9
```

**Environment variables not loading:**
- Ensure `.env` file exists in project root
- Check that all required variables from `.env.example` are set
- Restart the development server after changing environment variables

**TypeScript compilation errors:**
```sh
# Check for type errors
npm run type-check

# Clean build and rebuild
rm -rf dist/
npm run build
```

**LLM API connection issues:**
- Verify API keys are correct and have proper permissions
- Check rate limits and quotas for your API provider
- For Ollama, ensure the local server is running: `ollama serve`

**Bitbucket authentication errors:**
- Verify your Bitbucket username and app password
- Ensure the app password has repository read permissions
- Check that the repository exists and you have access

### Debug Mode
Set `NODE_ENV=development` in your `.env` file for detailed error logs.

## License
This project is licensed under the ISC License.

## Contributing
- Fork the repository and create a feature branch
- Follow the code standards defined in [shrimp-rules.md](../.shrimp_data/shrimp-rules.md)
- Add comprehensive tests for new features
- Update documentation for any API or feature changes
- Submit PRs with clear descriptions and link to any related issues
- Ensure all tests pass: `npm test && npm run lint`

## Changelog
See commit history for detailed changes. Major updates:
- Initial release with OpenAI, Claude, and Ollama support
- Added comprehensive security middleware
- Implemented rate limiting and input validation
- Added template customization support

---
