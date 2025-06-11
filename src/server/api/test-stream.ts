// Test streaming endpoint for debugging
import { Request, Response, NextFunction } from 'express';

export async function testStream(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Set up Server-Sent Events headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Helper function to send SSE data
    const sendSSE = (event: string, data: any) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send test data
    sendSSE('start', { message: 'Starting test stream...' });

    // Simulate streaming content
    const testContent = "This is a test streaming response. ";
    let content = '';
    
    for (let i = 0; i < testContent.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 50)); // 50ms delay
      content += testContent[i];
      sendSSE('token', { 
        token: testContent[i],
        content: content 
      });
    }

    // Send completion
    sendSSE('complete', {
      message: 'Test stream completed successfully!',
      totalLength: content.length
    });

    res.end();

  } catch (error) {
    console.error('Error in testStream:', error);
    
    if (!res.headersSent) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
    }
    
    res.write(`event: error\n`);
    res.write(`data: ${JSON.stringify({ error: 'Test stream error' })}\n\n`);
    res.end();
  }
}
