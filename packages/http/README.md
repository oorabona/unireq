# @unireq/http

[![npm version](https://img.shields.io/npm/v/@unireq/http.svg)](https://www.npmjs.com/package/@unireq/http)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

HTTP(S) transport for Unireq built on `undici`, with serializers, parsers, policies, and protocol-specific helpers.

## Installation

```bash
pnpm add @unireq/http
```

## Quick Start

```typescript
import { client } from '@unireq/core';
import { http, body, headers, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  headers({ 'user-agent': 'MyApp/1.0' }),
  parse.json(),
);

// GET request
const user = await api.get('/users/42');

// POST with JSON body
const created = await api.post('/users', body.json({ name: 'Jane' }));
```

## Understanding body vs parse

| Direction | Namespace | Purpose | Example |
|-----------|-----------|---------|---------|
| **Request** (what you send) | `body.*` | Serialize data for sending | `body.json({ name: 'John' })` |
| **Response** (what you receive) | `parse.*` | Parse response data | `parse.json()` |

```typescript
// body.* → Outgoing data
await api.post('/users', body.json({ name: 'John' }));   // Sends JSON
await api.post('/login', body.form({ user: 'john' }));   // Sends form data
await api.post('/notes', body.auto('Hello'));            // Auto-detects type

// parse.* → Incoming data (add as policy)
const api = client(http('...'), parse.json());  // All responses parsed as JSON
```

## Base URL Support

The `http()` transport factory accepts an optional base URL that combines with relative request paths:

```typescript
import { client } from '@unireq/core';
import { http, json } from '@unireq/http';

// Create client with base URL
const api = client(http('https://api.example.com'), json());

// These relative URLs are automatically resolved:
await api.get('/users');        // → https://api.example.com/users
await api.get('/users/123');    // → https://api.example.com/users/123
await api.post('/users', body); // → https://api.example.com/users

// Absolute URLs bypass the base URL:
await api.get('https://other.api.com/data');  // → https://other.api.com/data
```

### URL Resolution Rules

1. **Relative paths** (starting with `/`) are combined with the base URL
2. **Absolute URLs** (containing `://`) are used as-is
3. **No base URL** - URLs must be absolute

```typescript
// Without base URL - each request needs full URL
const api = client(http(), json());
await api.get('https://api.example.com/users');
```

## Policy Execution Order

Policies are executed in a **middleware/onion pattern** where:
- Request flows **left to right** through policies
- Response flows **right to left** back through the same policies

```
Request:  client.get() → [policy1] → [policy2] → [transport] → Server
Response: client.get() ← [policy1] ← [policy2] ← [transport] ← Server
```

### Recommended Policy Order

For optimal behavior, compose policies in this order:

```typescript
import { client, retry, backoff } from '@unireq/core';
import { http, accept, headers, timeout, redirectPolicy, json } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  // 1. OUTER: Retry (wraps everything, catches all errors)
  retry(predicate, [backoff()], { tries: 3 }),
  // 2. HEADERS: Set accept/content-type headers
  accept(['application/json']),
  headers({ 'X-API-Key': 'secret' }),
  // 3. TIMEOUT: Request timeout (should be inside retry)
  timeout(5000),
  // 4. REDIRECTS: Follow redirects
  redirectPolicy({ allow: [307, 308] }),
  // 5. INNER: Response parsing
  json(),
);
```

This ensures:
- **Retry** wraps timeout failures, so timeouts trigger retries
- **Headers** are set before the request is made
- **Timeout** applies to each retry attempt, not the total
- **Parsing** happens last on the response

## Features

| Category | Symbols | Purpose |
| --- | --- | --- |
| Transport | `http`, `UndiciConnector` | HTTP/1.1 transport with keep-alive, proxies, TLS |
| Body serializers | `body.json`, `body.form`, `body.text`, `body.multipart`, `body.auto` | Encode requests with auto Content-Type |
| Response parsers | `parse.json`, `parse.text`, `parse.stream`, `parse.sse` | Decode responses and handle Accept |
| Policies | `headers`, `query`, `timeout`, `redirectPolicy` | Request configuration (per-phase timeouts) |
| Conditional | `etag`, `lastModified`, `conditional` | ETag/Last-Modified caching |
| Range | `range`, `resume` | Partial downloads and resumption |
| Rate limiting | `rateLimitDelay`, `parseRetryAfter` | Respect Retry-After headers |
| Retry | `httpRetryPredicate` | HTTP-specific retry conditions |
| Interceptors | `interceptRequest`, `interceptResponse` | Logging/metrics hooks |

## Body Serializers

```typescript
body.json({ name: 'value' });
body.form({ search: 'query', page: 2 });
body.text('plain text');
body.binary(arrayBuffer, 'application/octet-stream');
body.multipart(
  { name: 'file', part: body.binary(buffer, 'application/pdf'), filename: 'doc.pdf' },
  { maxFileSize: 25 * 1024 * 1024, allowedMimeTypes: ['application/pdf'] },
);

// Auto-detection (convenience)
body.auto({ name: 'value' });        // → body.json()
body.auto('plain text');             // → body.text()
body.auto(new FormData());           // → multipart/form-data
body.auto(new URLSearchParams());    // → application/x-www-form-urlencoded
```

## Response Parsers & Streaming

```typescript
const json = await api.get('/data', parse.json());
const text = await api.get('/readme', parse.text());
const stream = await api.get('/file', parse.stream());
const events = await api.get('/events', parse.sse());

for await (const event of events) {
  console.log(event.data);
}
```

## Retry with Rate Limiting

```typescript
import { client, retry, backoff } from '@unireq/core';
import { http, httpRetryPredicate, rateLimitDelay, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  retry(
    httpRetryPredicate({ statusCodes: [429, 503] }),
    [rateLimitDelay({ maxWait: 60_000 }), backoff()],
    { tries: 5 },
  ),
  parse.json(),
);
```

## Timeout Configuration

```typescript
import { timeout } from '@unireq/http';

// Simple timeout
timeout(5000);

// Per-phase timeouts for fine-grained control
timeout({
  request: 5000,   // Connection + TTFB (until headers received)
  body: 30000,     // Body download (can be interrupted mid-stream)
  total: 60000,    // Overall safety limit
});
```

## Conditional Requests

```typescript
import { etag, lastModified } from '@unireq/http';

const cache = new Map();

const api = client(
  http('https://api.example.com'),
  etag({ get: (url) => cache.get(url), set: (url, v) => cache.set(url, v) }),
  parse.json(),
);
```

## Documentation

Full documentation available at [unireq.dev](https://oorabona.github.io/unireq/)

## License

MIT
