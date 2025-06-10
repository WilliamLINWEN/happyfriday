# API Documentation

This file will contain API endpoint documentation for the Bitbucket PR Description Generator.

## POST /api/generate-description
- **Description:** Generate a PR description using Bitbucket and LLM APIs
- **Request Body:**
  - `repository` (string, required): Bitbucket repo in `workspace/repo_slug` format
  - `prNumber` (number, required): Pull Request number
  - `provider` (string, optional): LLM provider (`openai`, `claude`, `ollama`)
- **Responses:**
  - `200 OK`: `{ success: true, data: { description, metadata } }`
  - `400 Bad Request`: `{ error: string }`
  - `500 Internal Server Error`: `{ error: string }`

## GET /api/providers
- **Description:** List available LLM providers
- **Response:** `{ success: true, data: { providers: string[] } }`

## GET /health
- **Description:** Health check endpoint
- **Response:** `{ success: true, data: { services: { totalProviders, ... } } }`

---
See [README.md](README.md) for setup and usage details.
