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

## Features

| Category | Symbols | Purpose |
| --- | --- | --- |
| Transport | `http`, `UndiciConnector` | HTTP/1.1 transport with keep-alive, proxies, TLS |
| Body serializers | `body.json`, `body.form`, `body.text`, `body.multipart` | Encode requests with auto Content-Type |
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
