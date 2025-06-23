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

## Template System

The application supports customizable PR description templates with metadata-driven selection, allowing users to choose templates that best fit their workflow and language preferences.

### Using Templates

#### Web Interface
1. Open the application in your browser at `http://localhost:3000`
2. Select a template from the "Template" dropdown menu
3. View the template description below the selector for guidance
4. Enter your Bitbucket PR URL or repository/PR number
5. Choose your preferred LLM provider
6. Generate your PR description with the selected template

#### API Usage

**Get Available Templates:**
```bash
curl http://localhost:3000/api/templates
```

**Generate Description with Template:**
```bash
curl -X POST http://localhost:3000/api/generate-description \
  -H "Content-Type: application/json" \
  -d '{
    "prUrl": "https://bitbucket.org/workspace/repo/pull-requests/123",
    "provider": "openai",
    "template": "pr-description-template-en.txt"
  }'
```

**Template API Endpoints:**
- `GET /api/templates` - List all available templates
- `GET /api/templates/:templateName/metadata` - Get template metadata  
- `GET /api/templates/:templateName/validate` - Validate template exists

### Adding New Templates

#### 1. Create Template File
Create a new `.txt` file in `src/templates/`:

```markdown
# Example: src/templates/feature-template-en.txt

# Feature: {{title}}

## Overview
{{description}}

## Implementation Details
<!-- Describe the technical implementation approach -->

## New Features
- Feature 1: Description
- Feature 2: Description

## Testing Strategy
- Unit tests for core functionality
- Integration tests for API endpoints
- Manual testing scenarios

## Deployment Notes
<!-- Any special deployment considerations -->

**Author:** {{author}}
**Repository:** {{repository}}  
**Branch:** {{sourceBranch}} → {{destinationBranch}}

**Additional Context:** {{additionalContext}}
```

#### 2. Add Template Metadata
Update `src/templates/templates.json`:

```json
{
  "feature-template-en.txt": {
    "name": "Feature Development (English)",
    "description": "Comprehensive template for new feature PRs with implementation details",
    "language": "en", 
    "category": "feature"
  }
}
```

**Metadata Fields:**
- `name`: Display name shown in UI dropdown
- `description`: Brief description for user guidance
- `language`: Language code (`en`, `zh`, etc.)
- `category`: Template category (`description`, `feature`, `bugfix`, `review`, etc.)

#### 3. Available Template Variables

| Variable | Description |
|----------|-------------|
| `{{title}}` | PR title |
| `{{description}}` | PR description |
| `{{author}}` | PR author name |
| `{{repository}}` | Repository name |
| `{{sourceBranch}}` | Source branch name |
| `{{destinationBranch}}` | Target branch name |
| `{{diff}}` | Code diff content |
| `{{additionalContext}}` | Additional context from user |

### Removing Templates

#### 1. Delete Template File
```bash
rm src/templates/unwanted-template.txt
```

#### 2. Remove Metadata Entry
Edit `src/templates/templates.json` and remove the corresponding entry:

```json
{
  // Remove this entry:
  // "unwanted-template.txt": { ... }
}
```

### Modifying Existing Templates

#### 1. Edit Template Content
```bash
# Edit template file directly
vim src/templates/pr-description-template-en.txt
```

#### 2. Update Metadata (if needed)
Modify `src/templates/templates.json` if changing template purpose:

```json
{
  "pr-description-template-en.txt": {
    "name": "Updated Template Name",
    "description": "Updated description",
    "language": "en",
    "category": "description"
  }
}
```

### Template Best Practices

1. **Clear Structure**: Use markdown headers and sections
2. **Helpful Comments**: Include HTML comments as guidance
3. **Consistent Variables**: Use standard variable names
4. **Language Specific**: Create versions for different languages
5. **Category Organization**: Group similar templates by category
6. **Test Templates**: Verify formatting by generating test descriptions

### Template Categories

Organize templates by category for better user experience:

- `description`: General PR description templates
- `feature`: New feature development
- `bugfix`: Bug fix and issue resolution  
- `review`: Code review and refactoring
- `hotfix`: Emergency fixes
- `refactor`: Code refactoring and cleanup

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
│   │   ├── templates.json    # Template metadata configuration
│   │   ├── *.txt            # Template files
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
