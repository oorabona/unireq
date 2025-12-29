/**
 * Server-Sent Events (SSE) example
 * Demonstrates real-time event streaming with parse.sse()
 * Uses Postman Echo SSE endpoint for live testing
 * Usage: pnpm example:sse
 */

import { client } from '@unireq/core';
import { http, parse, type SSEEvent } from '@unireq/http';

// Create HTTP client for Postman Echo SSE endpoint
const api = client(http('https://postman-echo.com'));

console.log('📡 Server-Sent Events (SSE) Examples\n');

try {
  // Example 1: Live SSE stream from Postman Echo
  console.log('📊 Example 1: Live SSE stream from Postman Echo\n');

  console.log('Connecting to https://postman-echo.com/server-events/5\n');

  const liveResponse = await api.get('/server-events/5', parse.sse());

  console.log('Receiving events from live stream:\n');

  let eventCount = 0;
  for await (const event of liveResponse.data as AsyncIterable<SSEEvent>) {
    eventCount++;
    console.log(`Event ${eventCount}:`);
    if (event.event) {
      console.log(`  Type: ${event.event}`);
    }
    if (event.id) {
      console.log(`  ID: ${event.id}`);
    }
    console.log(`  Data: ${event.data}`);
    console.log('');
  }

  console.log(`✅ Received ${eventCount} events from live SSE stream\n`);

  // Example 2: Manual SSE parsing demo
  console.log('📊 Example 2: Manual SSE parsing demo (simulated data)\n');

  // Simulate SSE stream to demonstrate various SSE features
  const sseData = `
id: 1
event: message
data: Hello from server!

id: 2
event: update
data: {"status": "processing", "progress": 50}

id: 3
event: message
data: Task completed successfully

: This is a comment, will be ignored

retry: 5000
data: Connection timeout set to 5000ms
`.trim();

  // Parse SSE manually for demonstration
  const mockSSEResponse = {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'text/event-stream' },
    data: sseData,
    ok: true,
  };

  const mockNext = async () => mockSSEResponse;
  const policy = parse.sse();
  const response = await policy({ url: '/events', method: 'GET', headers: {} }, mockNext);

  console.log('Parsing simulated SSE data:\n');

  for await (const event of response.data as AsyncIterable<SSEEvent>) {
    console.log(`Event ${event.id || '(no id)'}:`);
    if (event.event) {
      console.log(`  Type: ${event.event}`);
    }
    console.log(`  Data: ${event.data}`);
    if (event.retry) {
      console.log(`  Retry: ${event.retry}ms`);
    }
    console.log('');
  }

  // Example 3: Multi-line data
  console.log('📊 Example 3: Multi-line SSE data\n');

  const multilineSSE = `
data: First line
data: Second line
data: Third line

`.trim();

  const multilineResponse = {
    status: 200,
    statusText: 'OK',
    headers: {},
    data: multilineSSE,
    ok: true,
  };

  const multilinePolicy = parse.sse();
  const multilineResult = await multilinePolicy(
    { url: '/events', method: 'GET', headers: {} },
    async () => multilineResponse,
  );

  console.log('Multi-line event data:\n');

  for await (const event of multilineResult.data as AsyncIterable<SSEEvent>) {
    console.log('Event data:');
    console.log(event.data);
    console.log('');
  }

  // Example 4: Real-world use case (stock tickers)
  console.log('📊 Example 4: Stock ticker events\n');

  const stockSSE = `
event: price_update
data: {"symbol": "AAPL", "price": 175.50, "change": 1.25}

event: price_update
data: {"symbol": "GOOGL", "price": 140.20, "change": -0.50}

event: price_update
data: {"symbol": "MSFT", "price": 380.75, "change": 2.10}
`.trim();

  const stockResponse = {
    status: 200,
    statusText: 'OK',
    headers: {},
    data: stockSSE,
    ok: true,
  };

  const stockPolicy = parse.sse();
  const stockResult = await stockPolicy(
    { url: '/stock-ticker', method: 'GET', headers: {} },
    async () => stockResponse,
  );

  console.log('Stock price updates:\n');

  for await (const event of stockResult.data as AsyncIterable<SSEEvent>) {
    if (event.event === 'price_update') {
      const stock = JSON.parse(event.data);
      const changeIndicator = stock.change >= 0 ? '📈' : '📉';
      console.log(
        `${changeIndicator} ${stock.symbol}: $${stock.price} (${stock.change >= 0 ? '+' : ''}${stock.change})`,
      );
    }
  }

  console.log('\n✨ SSE examples completed!');
  console.log('\n💡 SSE use cases:');
  console.log('1. Real-time notifications (chat, alerts)');
  console.log('2. Live dashboards (metrics, analytics)');
  console.log('3. Progress tracking (long-running tasks)');
  console.log('4. Stock tickers, sports scores');
  console.log('5. Server push updates');

  console.log('\n💡 SSE advantages over WebSockets:');
  console.log('- Simpler protocol (HTTP/text)');
  console.log('- Automatic reconnection');
  console.log('- Works through proxies/firewalls');
  console.log('- EventSource browser API');
  console.log('- One-way server→client (sufficient for many use cases)');
} catch (error) {
  console.error('❌ SSE parsing failed:', error);
}
