# Performance Tuning Guide

This guide covers performance optimization strategies for @unireq HTTP clients.

## Connection Management

### Connection Pooling

@unireq uses Node.js's built-in connection pooling via `undici`. Configure pool settings:

```typescript
import { client } from '@unireq/core';
import { http, UndiciConnector, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com', {
    connector: new UndiciConnector({
      connections: 100, // Max connections per origin
      pipelining: 10,   // HTTP pipelining (for HTTP/1.1)
      keepAliveTimeout: 30000, // Keep-alive timeout in ms
      keepAliveMaxTimeout: 600000, // Max keep-alive time
    }),
  }),
  parse.json()
);
```

### HTTP/2 Multiplexing

For high-throughput scenarios, use HTTP/2:

```typescript
import { client } from '@unireq/core';
import { http2 } from '@unireq/http2';
import { parse } from '@unireq/http';

// HTTP/2 multiplexes requests over a single connection
const api = client(
  http2('https://api.example.com'),
  parse.json()
);

// All requests share the same connection
await Promise.all([
  api.get('/resource1'),
  api.get('/resource2'),
  api.get('/resource3'),
  // No connection overhead for concurrent requests
]);
```

## Request Deduplication

Prevent duplicate requests for the same resource:

```typescript
import { client } from '@unireq/core';
import { http, dedupe, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  dedupe({
    ttl: 100,            // Dedup window in ms
    methods: ['GET'],    // Only dedup safe methods
    maxSize: 1000,       // Max pending requests to track
  }),
  parse.json()
);

// Only 1 network request, 3 identical responses
const [r1, r2, r3] = await Promise.all([
  api.get('/users'),
  api.get('/users'),
  api.get('/users'),
]);
```

## Caching

### Response Caching

```typescript
import { client } from '@unireq/core';
import { http, cache, MemoryCacheStorage, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  cache({
    storage: new MemoryCacheStorage(),
    defaultTtl: 60000,   // 1 minute
    maxSize: 1000,       // Max cached entries
    keyGenerator: (ctx) => `${ctx.method}:${ctx.url}`,
  }),
  parse.json()
);
```

### Conditional Requests (ETag/Last-Modified)

Reduce bandwidth with conditional requests:

```typescript
import { client } from '@unireq/core';
import { http, conditional, cache, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  conditional({
    etag: true,          // Use ETag header
    lastModified: true,  // Use Last-Modified header
  }),
  cache({ defaultTtl: 300000 }), // Cache validated responses
  parse.json()
);

// First request: Full response
// Subsequent: 304 Not Modified (no body transfer)
```

## Rate Limiting

### Client-Side Throttling

Prevent overwhelming servers:

```typescript
import { client, throttle } from '@unireq/core';
import { http, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  throttle({
    requestsPerSecond: 10, // Max 10 RPS
    burst: 5,              // Allow 5 burst requests
    queueSize: 100,        // Max queued requests
  }),
  parse.json()
);
```

### Rate-Limit Aware Retry

Respect server rate limits:

```typescript
import { client, retry, backoff } from '@unireq/core';
import { http, httpRetryPredicate, rateLimitDelay, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  retry(
    httpRetryPredicate({ statusCodes: [429] }),
    [
      rateLimitDelay({ maxWait: 60000 }), // Respect Retry-After
      backoff({ initial: 1000, max: 30000, jitter: true }),
    ],
    { tries: 5 }
  ),
  parse.json()
);
```

## Timeout Configuration

### Phase-Based Timeouts

Fine-grained timeout control:

```typescript
import { client } from '@unireq/core';
import { http, timeout, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  timeout({
    connect: 5000,   // Connection timeout
    headers: 10000,  // Time to receive headers
    body: 60000,     // Time to receive body
    total: 120000,   // Total request timeout
  }),
  parse.json()
);
```

## Body Handling

### Streaming Large Files

Avoid loading large files into memory:

```typescript
import { client } from '@unireq/core';
import { http, body, parse } from '@unireq/http';

// Upload streaming
const fileStream = createReadStream('large-file.zip');
await api.post('/upload', body.stream(fileStream, {
  contentType: 'application/zip',
  contentLength: fileSize,
}));

// Download streaming
const response = await api.get('/download/large-file', parse.stream());
const reader = response.data.getReader();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  await writeChunk(value);
}
```

### Compression

Enable compression for text-based responses:

```typescript
import { client } from '@unireq/core';
import { http, headers, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  headers({ 'Accept-Encoding': 'gzip, deflate, br' }),
  parse.json()
);
```

## Monitoring

### Performance Timing

Track request performance:

```typescript
import { client } from '@unireq/core';
import { http, timing, parse, type TimingInfo } from '@unireq/http';

const metrics: TimingInfo[] = [];

const api = client(
  http('https://api.example.com'),
  timing({
    onTiming: (info, ctx) => {
      metrics.push(info);

      // Alert on slow requests
      if (info.total > 5000) {
        console.warn(`Slow request: ${ctx.url} took ${info.total}ms`);
      }
    },
  }),
  parse.json()
);
```

### Logging

Structured logging for analysis:

```typescript
import { client, log } from '@unireq/core';
import { http, parse } from '@unireq/http';
import pino from 'pino';

const logger = pino({ level: 'info' });

const api = client(
  http('https://api.example.com'),
  log({
    logger: {
      debug: (msg, meta) => logger.debug(meta, msg),
      info: (msg, meta) => logger.info(meta, msg),
      warn: (msg, meta) => logger.warn(meta, msg),
      error: (msg, meta) => logger.error(meta, msg),
    },
    includeHeaders: false, // Don't log sensitive headers
    includeBody: false,    // Don't log body content
  }),
  parse.json()
);
```

## Benchmarking

### Load Testing

```typescript
import { client } from '@unireq/core';
import { http, timing, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  timing(),
  parse.json()
);

async function benchmark(concurrency: number, total: number) {
  const timings: number[] = [];
  const errors = { count: 0 };

  const worker = async () => {
    for (let i = 0; i < total / concurrency; i++) {
      try {
        const response = await api.get('/benchmark');
        timings.push(response.timing.total);
      } catch {
        errors.count++;
      }
    }
  };

  const start = Date.now();
  await Promise.all(Array(concurrency).fill(null).map(worker));
  const elapsed = Date.now() - start;

  const sorted = timings.sort((a, b) => a - b);

  console.log({
    requests: total,
    concurrency,
    elapsed: `${elapsed}ms`,
    rps: Math.round(total / (elapsed / 1000)),
    errors: errors.count,
    latency: {
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    },
  });
}

await benchmark(10, 1000);
```

## Optimization Checklist

| Optimization | Impact | Effort |
|--------------|--------|--------|
| HTTP/2 | High | Low |
| Connection pooling | High | Low |
| Request deduplication | Medium | Low |
| Response caching | High | Medium |
| Conditional requests | Medium | Low |
| Streaming large files | High | Medium |
| Compression | Medium | Low |
| Throttling | Low | Low |
| Timeouts | Low | Low |

## Common Pitfalls

1. **Not reusing clients** - Create one client, reuse for all requests
2. **Ignoring connection limits** - Tune pool size for your workload
3. **Large payloads in memory** - Use streaming for files > 10MB
4. **No timeouts** - Always set reasonable timeouts
5. **Ignoring Retry-After** - Respect server rate limits
6. **Over-caching** - Use appropriate TTLs for your data
7. **No monitoring** - Add timing/logging to catch issues
