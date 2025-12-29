# Interceptors & Logging

Request/response logging interceptors.

- `interceptRequest()` for logging requests
- `interceptResponse()` for logging responses
- Timing/duration logging
- Structured JSON logs

```typescript
/**
 * Interceptors - Logging example
 * Demonstrates request/response logging using interceptors
 * Usage: pnpm example:interceptors-logging
 */

import { client } from '@unireq/core';
import {
  http,
  interceptRequest,
  interceptResponse,
  parse,
  type RequestInterceptor,
  type ResponseInterceptor,
} from '@unireq/http';

console.log('📝 Interceptors - Logging Examples\n');

// Example 1: Basic request logging
console.log('📊 Example 1: Basic request logging\n');

const logRequest: RequestInterceptor = (ctx) => {
  console.log(`→ ${ctx.method} ${ctx.url}`);
  if (Object.keys(ctx.headers).length > 0) {
    console.log(`  Headers: ${JSON.stringify(ctx.headers)}`);
  }
  return ctx;
};

const api1 = client(http('http://localhost:3001'), interceptRequest(logRequest));

const response1 = await api1.get('/get', parse.json());
console.log(`✅ Response status: ${response1.status}\n`);

// Example 2: Response logging
console.log('📊 Example 2: Response logging\n');

const logResponse: ResponseInterceptor = (response, ctx) => {
  console.log(`← ${ctx.method} ${ctx.url} -> ${response.status} ${response.statusText}`);
  return response;
};

const api2 = client(http('http://localhost:3001'), interceptRequest(logRequest), interceptResponse(logResponse));

await api2.get('/status/200', parse.raw());
console.log('✅ Request/response logged\n');

// Example 3: Detailed logging with timing
console.log('📊 Example 3: Detailed logging with timing\n');

const logRequestWithTiming: RequestInterceptor = (ctx) => {
  const startTime = Date.now();
  console.log(`→ ${ctx.method} ${ctx.url}`);
  // Store start time in context for response logger
  return { ...ctx, startTime };
};

const logResponseWithTiming: ResponseInterceptor = (response, ctx) => {
  const duration = 'startTime' in ctx ? Date.now() - (ctx['startTime'] as number) : 0;
  console.log(`← ${ctx.method} ${ctx.url} -> ${response.status} (${duration}ms)`);
  return response;
};

const api3 = client(
  http('http://localhost:3001'),
  interceptRequest(logRequestWithTiming),
  interceptResponse(logResponseWithTiming),
);

await api3.get('/delay/1', parse.json());
console.log('✅ Request logged with timing\n');

// Example 4: Structured logging
console.log('📊 Example 4: Structured logging\n');

interface LogEntry {
  timestamp: string;
  method: string;
  url: string;
  status?: number;
  duration?: number;
}

const logs: LogEntry[] = [];

const structuredLogRequest: RequestInterceptor = (ctx) => {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    method: ctx.method,
    url: ctx.url,
  };
  console.log(`→ ${logEntry.timestamp} ${logEntry.method} ${logEntry.url}`);
  // Store in context for response logger
  return { ...ctx, logEntry, startTime: Date.now() };
};

const structuredLogResponse: ResponseInterceptor = (response, ctx) => {
  if ('logEntry' in ctx && 'startTime' in ctx) {
    const entry = ctx['logEntry'] as LogEntry;
    entry.status = response.status;
    entry.duration = Date.now() - (ctx['startTime'] as number);
    logs.push(entry);
    console.log(`← ${entry.timestamp} ${entry.method} ${entry.url} -> ${entry.status} (${entry.duration}ms)`);
  }
  return response;
};

const api4 = client(
  http('http://localhost:3001'),
  interceptRequest(structuredLogRequest),
  interceptResponse(structuredLogResponse),
);

await api4.get('/get', parse.json());
await api4.post('/post', parse.json());

console.log('\nStructured logs:');
console.log(JSON.stringify(logs, null, 2));
console.log('');

console.log('✨ Logging interceptors examples completed!');
console.log('\n💡 Note: For standard logging, prefer the new log() policy from @unireq/core');
console.log('   See examples/logging-standard.ts for details.');
console.log('\n💡 Logging use cases:');
console.log('1. Debug HTTP requests in development');
console.log('2. Audit API calls in production');
console.log('3. Performance monitoring');
console.log('4. Request/response correlation');
console.log('5. Error tracking and analytics');
```

---

<p align="center">
  <a href="#/examples/graphql">← GraphQL</a> · <a href="#/examples/streaming">Streaming →</a>
</p>