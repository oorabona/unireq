# @unireq/presets

[![npm version](https://img.shields.io/npm/v/@unireq/presets.svg)](https://www.npmjs.com/package/@unireq/presets)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Pre-configured clients and helpers that assemble transports + policies for common scenarios.

**This is the easiest way to get started with Unireq.**

## Installation

```bash
pnpm add @unireq/presets
```

## Quick Start

### The simplest client

```typescript
import { httpClient } from '@unireq/presets';

const api = httpClient('https://api.example.com');

// GET request
const response = await api.get('/users/42');
console.log(response.data);

// POST with JSON body
await api.post('/users', { body: { name: 'John', email: 'john@example.com' } });
```

### With options

```typescript
const api = httpClient('https://api.example.com', {
  timeout: 10000,
  headers: { 'X-API-Key': 'secret' },
  query: { format: 'json' }, // added to all requests
});
```

### Safe methods (functional error handling)

```typescript
// Returns Result<Response, Error> instead of throwing
const result = await api.safe.get('/users/1');

if (result.isOk()) {
  console.log(result.value.data);
} else {
  console.error(result.error.message);
}

// Or use pattern matching
result.match({
  ok: (res) => console.log(res.data),
  err: (error) => console.error(error.message),
});
```

### Full-featured client with OAuth

```typescript
import { httpsJsonAuthSmart } from '@unireq/presets';

const secureApi = await httpsJsonAuthSmart('https://api.example.com', {
  tokenSupplier: () => getAccessToken(),
  jwks: { type: 'url', url: 'https://accounts.example.com/jwks.json' },
});
const res = await secureApi.get('/users/me');
```

## Available Presets

| Helper | Description |
| --- | --- |
| `httpClient` | Simple HTTP client with sensible defaults (JSON, redirects, timeout, headers, query) |
| `restApi` | REST API client with retry, rate-limiting, and production-ready defaults |
| `webhook` | Webhook sender with aggressive retry and fast timeout for reliable delivery |
| `scraper` | Web scraper with browser-like User-Agent and HTML parsing |
| `httpsJsonAuthSmart` | HTTPS + content negotiation + retry/backoff + optional OAuth |
| `httpUploadGeneric` | Thin wrapper for upload clients |
| `createMultipartUpload` | Convenience helper over `body.multipart` with validation |
| `httpDownloadResume` | HTTP client with range/resume for partial downloads |
| `gmailImap` | Policy for Gmail INBOX over IMAP with XOAUTH2 |

## restApi

Production-ready REST API client with built-in retry and rate-limiting.

```typescript
import { restApi } from '@unireq/presets';

const api = restApi('https://api.example.com', {
  headers: { 'Authorization': 'Bearer token' },
  timeout: 10000,
  retries: 5,
});

const users = await api.get('/users');
await api.post('/users', { body: { name: 'John' } });
```

Features:
- JSON Accept header and response parsing
- Safe redirects (307/308 only)
- Retry on transient errors (408, 429, 500, 502, 503, 504)
- Rate-limit aware (respects Retry-After headers)
- Exponential backoff with jitter

## webhook

Webhook sender optimized for reliable event delivery.

```typescript
import { webhook } from '@unireq/presets';

const hooks = webhook('https://hooks.example.com', {
  headers: { 'X-Webhook-Secret': 'secret' },
  retries: 10,  // High retry count for reliability
});

await hooks.post('/events', { body: { type: 'order.created', data: order } });
```

Features:
- No redirects (security: webhooks must hit exact URL)
- Aggressive retry (5 attempts by default)
- Short timeout (10s default - fail fast, retry quickly)
- Rate-limit awareness

## scraper

Web scraper with browser-like defaults.

```typescript
import { scraper } from '@unireq/presets';

const crawler = scraper('https://example.com', {
  userAgent: 'MyBot/1.0',
  timeout: 30000,
});

const html = await crawler.get('/page');
console.log(html.data); // HTML string
```

Features:
- Accept HTML and text content
- Follow all redirect types (301, 302, 307, 308)
- Browser-like User-Agent (configurable)
- Longer timeout (60s default for slow pages)
- Text response parsing

## httpsJsonAuthSmart

```typescript
const api = await httpsJsonAuthSmart('https://api.example.com', {
  tokenSupplier: () => getAccessToken(),
  jwks: { type: 'url', url: 'https://accounts.example.com/jwks.json' },
  policies: [customMetrics()],
});
```

Features:
- Accepts JSON/XML
- Follows only 307/308 redirects
- Retries 408/429/5xx with `rateLimitDelay` + `backoff`
- Optional OAuth layer

## Multipart Uploads

```typescript
import { httpUploadGeneric, createMultipartUpload, body } from '@unireq/presets';

const uploader = httpUploadGeneric('https://uploads.example.com');

await uploader.post('/files', createMultipartUpload([
  { name: 'file', filename: 'doc.pdf', part: body.binary(buffer, 'application/pdf') },
]));
```

## Resume Downloads

```typescript
import { httpDownloadResume } from '@unireq/presets';

const downloader = httpDownloadResume('https://cdn.example.com', {
  resumeState: { downloaded: 5_000 },
});

const chunk = await downloader.get('/video.mp4');
```

## Preset Comparison

| Helper | OAuth | Retry | Rate-limit | Content Negotiation | Use Case |
| --- | --- | --- | --- | --- | --- |
| `httpClient` | No | No | No | JSON | General purpose |
| `restApi` | No | Yes | Yes | JSON | API consumption |
| `webhook` | No | Yes | Yes | JSON | Event delivery |
| `scraper` | No | No | No | HTML/Text | Web scraping |
| `httpsJsonAuthSmart` | Optional | Yes | Yes | JSON/XML | Secure APIs |
| `httpUploadGeneric` | BYOD | No | No | Configurable | File uploads |
| `httpDownloadResume` | No | No | No | Binary | Large downloads |
| `gmailImap` | XOAUTH2 | No | No | IMAP | Gmail access |

## Documentation

Full documentation available at [unireq.dev](https://oorabona.github.io/unireq/)

## License

MIT
