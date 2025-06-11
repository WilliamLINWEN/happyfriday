# Streaming Output Implementation Guide

## Overview

This document explains how to implement and use streaming output for real-time LLM response generation in the Bitbucket PR Description Generator.

## What is Streaming?

Streaming allows the application to display LLM responses in real-time as they are generated, rather than waiting for the complete response. This provides:

- **Better User Experience**: Users see immediate feedback
- **Real-time Progress**: Visual indication that processing is happening
- **Faster Perceived Performance**: Content appears progressively
- **Interactive Feedback**: Users know the system is working

## Architecture

### Server-Side Components

#### 1. LLM Service Streaming Support (`llm-service.ts`)
```typescript
async generateDescriptionStream(
  request: TLLMRequest, 
  onToken: (token: string) => void
): Promise<TLLMResponse>
```

#### 2. Individual LLM Services
All LLM services implement `generateDescriptionWithCallback`:
- **OpenAI Service**: Uses LangChain's streaming capabilities
- **Claude Service**: Uses Anthropic's streaming API
- **Ollama Service**: Uses local model streaming

#### 3. Streaming API Endpoint (`generate-description.ts`)
```typescript
export async function generateDescriptionStream(
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void>
```

Uses Server-Sent Events (SSE) protocol for real-time communication.

### Client-Side Components

#### 1. Streaming Toggle
```html
<div class="streaming-toggle">
  <input type="checkbox" id="streaming-mode" checked />
  <label>Enable real-time streaming (recommended)</label>
</div>
```

#### 2. Streaming Function (`formHandler.js`)
```javascript
async function generateDescriptionStreaming(repository, prNumber, provider)
```

#### 3. Streaming UI Components
- **Streaming Container**: Shows real-time generation
- **Progress Text**: Updates token by token
- **Visual Feedback**: Blinking cursor animation

## Implementation Details

### Server-Sent Events (SSE) Protocol

The streaming endpoint uses SSE with the following event types:

```typescript
// Event types
sendSSE('start', { originalPR: {...} });      // Initial PR info
sendSSE('token', { token: string, content: string }); // New token
sendSSE('complete', { generatedDescription, metadata }); // Final result
sendSSE('error', { error: string });          // Error occurred
```

### Client-Side Streaming Flow

1. **Initialize**: Create streaming container UI
2. **Connect**: Establish SSE connection to `/api/generate-description/stream`
3. **Process Events**: Handle incoming SSE events
4. **Update UI**: Display tokens in real-time
5. **Complete**: Show final formatted result

### Error Handling

```javascript
// Fallback mechanism
if (streamingMode && streamingFailed) {
  // Automatically fall back to regular API
  await generateDescriptionRegular(repo, prNumber, provider);
}
```

## Usage Guide

### For Users

1. **Enable Streaming**: Check the "Enable real-time streaming" checkbox (enabled by default)
2. **Submit Request**: Fill in repository and PR number, then submit
3. **Watch Generation**: See the description appear token by token
4. **View Result**: Final formatted description with metadata

### For Developers

#### Adding New LLM Provider with Streaming

```typescript
// 1. Implement the streaming method
async generateDescriptionWithCallback(
  request: TLLMRequest,
  onToken?: (token: string) => void
): Promise<TLLMResponse> {
  // Create streaming LLM instance
  const streamingLLM = new YourLLM({ streaming: true });
  
  // Handle streaming response
  const stream = await chain.stream(templateVariables);
  let fullContent = '';
  
  for await (const chunk of stream) {
    fullContent += chunk;
    onToken?.(chunk); // Send token to callback
  }
  
  return { success: true, data: { description: fullContent } };
}
```

#### Customizing Streaming UI

```css
/* Streaming-specific styles */
.streaming-text::after {
  content: "▊";
  animation: blink 1s infinite;
  color: #0052cc;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
```

## API Endpoints

### POST `/api/generate-description/stream`

**Request Body:**
```json
{
  "repository": "workspace/repo-name",
  "prNumber": "123",
  "provider": "openai"
}
```

**Response:** Server-Sent Events stream

**Event Examples:**
```
event: start
data: {"originalPR": {"title": "Fix bug", "author": "user"}}

event: token  
data: {"token": "Fix", "content": "Fix"}

event: token
data: {"token": " the", "content": "Fix the"}

event: complete
data: {"generatedDescription": "...", "metadata": {...}}
```

### GET `/api/test-stream` (Development)

Test endpoint for verifying streaming functionality.

## Browser Compatibility

- **Modern Browsers**: Full support for Fetch API and ReadableStream
- **Fallback**: Automatic fallback to regular API for unsupported browsers
- **Progressive Enhancement**: Works without JavaScript (form submission)

## Performance Considerations

### Server-Side
- **Connection Management**: Properly close SSE connections
- **Memory Usage**: Stream processing without buffering large responses
- **Error Recovery**: Handle network interruptions gracefully

### Client-Side
- **DOM Updates**: Efficient text updates without excessive reflows
- **Memory Management**: Clean up event listeners and connections
- **Visual Performance**: Smooth animations and updates

## Testing

### Unit Tests
```bash
npm test -- streaming
```

### Integration Tests
1. Navigate to `/streaming-test.html`
2. Test basic streaming functionality
3. Test PR description streaming (requires API keys)

### Manual Testing
1. Enable streaming mode in main form
2. Submit a PR description request
3. Verify real-time token display
4. Check final result formatting

## Troubleshooting

### Common Issues

1. **Streaming Not Working**
   - Check browser console for errors
   - Verify Server-Sent Events support
   - Test with `/api/test-stream`

2. **Tokens Not Appearing**
   - Check LLM service streaming implementation
   - Verify `generateDescriptionWithCallback` method
   - Check network connection

3. **UI Not Updating**
   - Verify CSS animations loaded
   - Check DOM element selection
   - Test with browser dev tools

### Debug Mode
```javascript
// Enable debug logging
localStorage.setItem('streamingDebug', 'true');
```

## Future Enhancements

1. **Progress Indicators**: Show percentage complete
2. **Token Statistics**: Display tokens/second metrics
3. **Retry Mechanism**: Automatic retry on connection failure
4. **Multiple Streams**: Parallel generation from multiple providers
5. **Voice Output**: Text-to-speech for generated content

## Security Considerations

- **Input Validation**: All streaming requests validated
- **Rate Limiting**: Applied to streaming endpoints
- **Error Sanitization**: No sensitive data in error messages
- **CORS Policy**: Configured for streaming endpoints

## Conclusion

The streaming implementation provides a modern, responsive user experience for LLM-powered PR description generation. It maintains backward compatibility while offering enhanced real-time feedback for users.
