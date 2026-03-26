# @unireq/* — Pipe-first, tree-shakeable, multi-protocol I/O toolkit

[![CI](https://github.com/oorabona/unireq/workflows/CI/badge.svg)](https://github.com/oorabona/unireq/actions)
[![codecov](https://codecov.io/gh/oorabona/unireq/branch/main/graph/badge.svg)](https://codecov.io/gh/oorabona/unireq)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern, composable HTTP(S)/HTTP/2/IMAP/FTP client toolkit for Node.js ≥18, built on **undici** (Node's built-in fetch) with first-class support for:

- 🔗 **Pipe-first composition** — `compose(...policies)` for clean, onion-model middleware
- 🌳 **Tree-shakeable** — Import only what you need, minimal bundle size
- 🔐 **Smart OAuth Bearer** — JWT validation, automatic refresh on 401, single-flight token refresh
- 🚦 **Rate limiting** — Reads `Retry-After` headers (429/503) and auto-retries
- 🔄 **Safe redirects** — Prefer 307/308 (RFC 9110), 303 opt-in
- 📤 **Multipart uploads** — RFC 7578 compliant
- ⏸️ **Resume downloads** — Range requests (RFC 7233, 206/416)
- 🎯 **Content negotiation** — `either(json|xml)` branching
- 🛠️ **Multi-protocol** — HTTP/2 (ALPN), IMAP (XOAUTH2), FTP/FTPS

---

## Quick Start

```bash
pnpm add @unireq/core @unireq/http
```

### Basic HTTP client

```ts
import { client } from '@unireq/core';
import { http, headers, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  headers({ 'user-agent': 'unireq/1.0' }),
  parse.json()
);

const response = await api.get('/users/123');
console.log(response.data); // Typed response
```

### Smart HTTPS client with OAuth, retries, and content negotiation

```ts
import { client, compose, either, retry, backoff } from '@unireq/core';
import { http, headers, parse, redirectPolicy, httpRetryPredicate, rateLimitDelay } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';
import { parse as xmlParse } from '@unireq/xml';

const smartClient = client(
  http('https://api.example.com'),
  headers({ accept: 'application/json, application/xml' }),
  redirectPolicy({ allow: [307, 308] }), // Safe redirects only; strips sensitive headers cross-origin
  retry(
    httpRetryPredicate({ methods: ['GET', 'PUT', 'DELETE'], statusCodes: [429, 503] }),
    [rateLimitDelay(), backoff({ initial: 100, max: 5000 })],
    { tries: 3 }
  ),
  oauthBearer({ tokenSupplier: async () => getAccessToken() }),
  either(
    (ctx) => ctx.headers.accept?.includes('json'),
    parse.json(),
    xmlParse()
  )
);

const user = await smartClient.get('/users/me');
```

---

## The 50-Line Axios Setup → 5 Lines

With axios, a production API client requires interceptors, retry logic, error handling, and token management scattered across multiple files:

```ts
// axios: 40+ lines of setup
const instance = axios.create({ baseURL: 'https://api.example.com' });
instance.interceptors.request.use(async (config) => {
  const token = await getToken();
  config.headers.Authorization = `Bearer ${token}`;
  return config;
});
instance.interceptors.response.use(null, async (error) => {
  if (error.response?.status === 401) {
    const token = await refreshToken();
    error.config.headers.Authorization = `Bearer ${token}`;
    return instance(error.config);
  }
  if (error.response?.status === 429) {
    const retryAfter = error.response.headers['retry-after'];
    await sleep(retryAfter * 1000);
    return instance(error.config);
  }
  throw error;
});
```

With @unireq, the same behavior is declarative:

```ts
// unireq: 7 lines
const api = client(http('https://api.example.com'),
  oauthBearer({ tokenSupplier: getToken, autoRefresh: true }),
  retry(httpRetryPredicate({ statusCodes: [429, 503] }),
    [rateLimitDelay(), backoff()], { tries: 3 }),
  parse.json()
);
```

---

## Why @unireq? — Batteries Included

Most HTTP clients solve the basics well. @unireq goes further by integrating common production needs out of the box:

| Feature | @unireq | axios | ky | got | node-fetch |
|---------|:-------:|:-----:|:--:|:---:|:----------:|
| **Bundle size (min+gz)** | ~8 KB | ~40 KB | ~12 KB | ~46 KB | ~4 KB |
| **Tree-shakeable** | ✅ | ❌ | ✅ | ❌ | ✅ |
| **TypeScript-first** | ✅ | ⚠️ | ✅ | ✅ | ⚠️ |
| **Composable middleware** | ✅ Onion model | ✅ Interceptors | ✅ Hooks | ✅ Hooks | ❌ |
| **OAuth + JWT validation** | ✅ Built-in | ❌ Manual | ❌ Manual | ❌ Manual | ❌ Manual |
| **Rate limit (Retry-After)** | ✅ Automatic | ❌ Manual | ⚠️ Partial | ⚠️ Partial | ❌ |
| **Circuit breaker** | ✅ Built-in | ❌ | ❌ | ❌ | ❌ |
| **Multi-protocol** | ✅ HTTP/HTTP2/FTP/IMAP | ❌ HTTP only | ❌ HTTP only | ❌ HTTP only | ❌ HTTP only |
| **Introspection API** | ✅ Debug any request | ❌ | ❌ | ❌ | ❌ |
| **Resume downloads** | ✅ Range requests | ❌ | ❌ | ⚠️ | ❌ |
| **Safe redirects (307/308)** | ✅ By default | ⚠️ All allowed | ⚠️ All allowed | ⚠️ All allowed | ⚠️ All allowed |
| **100% test coverage** | ✅ | ❌ | ❌ | ✅ | ❌ |

### Performance

Benchmarked against axios, got, ky, and raw undici/fetch on Node v24 (local HTTP server, no TLS):

| Scenario | Result |
|----------|--------|
| Sequential GET (1000 req) | **28-33% faster** than axios/got |
| Concurrent GET (100 parallel) | **94% faster** than native fetch, **44% faster** than axios |
| POST JSON (1000 req) | **38% faster** than native fetch |
| Large payload (100KB JSON) | **19% faster** than native fetch |
| Retry with backoff (flaky server) | **2× faster** than axios/ky |
| ETag cache hits | **43-63× faster** than manual If-None-Match |
| 7-policy composition stack | Only **+7.4% overhead** over bare transport |

> Full methodology, per-library numbers, and code comparisons: **[BENCHMARKS.md](./BENCHMARKS.md)**

### What sets @unireq apart

1. **Pipe-first composition** — Build clients declaratively with `compose(...policies)`. No magic, just functions.

2. **Production-ready auth** — OAuth Bearer with JWT introspection, automatic token refresh on 401, clock skew tolerance. No boilerplate.

3. **Smart retries** — Combines multiple strategies: `rateLimitDelay()` reads `Retry-After` headers, `backoff()` handles transient failures. Works together seamlessly.

4. **Multi-protocol** — Same API for HTTP, HTTP/2, IMAP, FTP. Switch transports without rewriting business logic.

5. **Secure by default** — `redirectPolicy()` strips sensitive headers (`Authorization`, `Cookie`) on cross-origin redirects and blocks HTTPS→HTTP downgrades. `cache()` respects `Vary`, skips `Authorization`-gated responses, and never stores `Cache-Control: private` resources.

6. **Introspection** — Debug any request with `introspect()`: see exact headers, timing, retries, and policy execution order.

7. **Minimal footprint** — Import only what you use. The core is ~8 KB, and tree-shaking removes unused policies.

### When to use something else

- **Quick scripts**: `node-fetch` or native `fetch` if you just need simple GET/POST
- **Browser-only**: `ky` offers excellent browser support with smaller footprint
- **Legacy Node.js**: `axios` if you need Node < 18 support

---

## Architecture

### Packages

| Package | Description |
|---------|-------------|
| **`@unireq/core`** | Client factory, `compose`, `either`, slots, DX errors |
| **`@unireq/http`** | `http()` transport (undici), policies, body/parse, multipart, range |
| **`@unireq/http2`** | `http2()` transport via `node:http2` (ALPN) |
| **`@unireq/oauth`** | OAuth Bearer + JWT + 401 refresh (RFC 6750) |
| **`@unireq/cookies`** | `tough-cookie` + `http-cookie-agent/undici` |
| **`@unireq/xml`** | `fast-xml-parser` policy |
| **`@unireq/imap`** | IMAP transport via `imapflow` (XOAUTH2) |
| **`@unireq/ftp`** | FTP transport via `basic-ftp` |
| **`@unireq/presets`** | Pre-configured clients (httpsJsonAuthSmart, etc.) |

### Composition model

**Onion middleware** via `compose(...policies)`:

```ts
const policy = compose(
  policyA, // Pre-call (outer layer)
  policyB, // Pre-call (middle layer)
  policyC  // Pre-call (inner layer)
);
// Execution: A → B → C → transport → C → B → A
```

**Conditional branching** via `either(pred, then, else)`:

```ts
import { either } from '@unireq/core';
import { parse } from '@unireq/http';
import { parse as xmlParse } from '@unireq/xml';

either(
  (ctx) => ctx.headers.accept?.includes('json'),
  parse.json(),  // If true: parse as JSON
  xmlParse()     // If false: parse as XML
);
```

---

## HTTP Semantics References

### Redirects

- **307 Temporary Redirect** — Preserves method and body ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/307), [RFC 9110 §15.4.8](https://datatracker.ietf.org/doc/html/rfc9110#section-15.4.8))
- **308 Permanent Redirect** — Preserves method and body ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/308), [RFC 9110 §15.4.9](https://datatracker.ietf.org/doc/html/rfc9110#section-15.4.9))
- **303 See Other** — Converts to GET (opt-in via `follow303`) ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/303), [RFC 9110 §15.4.4](https://datatracker.ietf.org/doc/html/rfc9110#section-15.4.4))

```ts
redirectPolicy({ allow: [307, 308], follow303: false });
```

### Rate Limiting

- **429 Too Many Requests** + `Retry-After` ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429), [RFC 6585](https://datatracker.ietf.org/doc/html/rfc6585))
- **503 Service Unavailable** + `Retry-After` ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/503), [RFC 9110 §15.6.4](https://datatracker.ietf.org/doc/html/rfc9110#section-15.6.4))

```ts
import { retry } from '@unireq/core';
import { httpRetryPredicate, rateLimitDelay } from '@unireq/http';

retry(
  httpRetryPredicate({ statusCodes: [429, 503] }),
  [rateLimitDelay({ maxWait: 60000 })],
  { tries: 3 }
);
```

### Range Requests

- **206 Partial Content** — Server sends requested byte range ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/206), [RFC 7233](https://datatracker.ietf.org/doc/html/rfc7233))
- **416 Range Not Satisfiable** — Invalid range ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/416), [RFC 7233 §4.4](https://datatracker.ietf.org/doc/html/rfc7233#section-4.4))
- **`Accept-Ranges: bytes`** — Server supports ranges ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept-Ranges))

```ts
range({ start: 0, end: 1023 }); // Request first 1KB
resume({ downloaded: 5000 }); // Resume from byte 5000
```

### Multipart Form Data

- **RFC 7578** — `multipart/form-data` ([spec](https://datatracker.ietf.org/doc/html/rfc7578))

```ts
multipart(
  [{ name: 'file', filename: 'doc.pdf', data: blob, contentType: 'application/pdf' }],
  [{ name: 'title', value: 'My Document' }]
);
```

### OAuth 2.0 Bearer

- **RFC 6750** — Bearer token usage ([spec](https://datatracker.ietf.org/doc/html/rfc6750))

```ts
oauthBearer({
  tokenSupplier: async () => getAccessToken(),
  skew: 60, // Clock skew tolerance (seconds)
  autoRefresh: true // Refresh on 401
});
```

---

## Why undici (Node's built-in fetch)?

Starting with Node.js 18, the global `fetch` API is powered by [**undici**](https://undici.nodejs.org), a fast, spec-compliant HTTP/1.1 client. Benefits:

- ✅ **No external dependencies** for HTTP/1.1
- ✅ **Streams, AbortController, FormData** built-in
- ✅ **HTTP/2 support** via ALPN (requires explicit opt-in or `@unireq/http2`)
- ✅ **Maintained by Node.js core team**

> **Note**: `fetch` defaults to HTTP/1.1. For HTTP/2, use `@unireq/http2` (see [Why HTTP/2 transport?](#why-http2-transport)).

---

## Why HTTP/2 transport?

Node's `fetch` (undici) defaults to HTTP/1.1, even when servers support HTTP/2. While undici *can* negotiate HTTP/2 via ALPN, it requires explicit configuration not available in the global `fetch` API.

`@unireq/http2` provides:

- ✅ **Explicit HTTP/2** via `node:http2`
- ✅ **ALPN negotiation**
- ✅ **Multiplexing** over a single connection
- ✅ **Server push** (opt-in)

```ts
import { client } from '@unireq/core';
import { http2 } from '@unireq/http2';

const h2Client = client(http2('https://http2.example.com'));
```

---

## Real-World Recipes

### REST API with auth, retries, and caching

```ts
import { restApi } from '@unireq/presets';

const github = restApi()
  .bearer(process.env.GITHUB_TOKEN)
  .retry(3)
  .timeout(10_000)
  .build('https://api.github.com');

const repos = await github.get('/user/repos');
```

### Download with progress and resume

```ts
import { client } from '@unireq/core';
import { http, progress, resume } from '@unireq/http';

const state = { downloaded: 0 };
const dl = client(http('https://releases.example.com'),
  progress({ onDownloadProgress: (p) => console.log(`${p.percent}%`) }),
  resume(state)
);

await dl.get('/large-file.zip');
```

### GraphQL with automatic JSON parsing

```ts
import { client } from '@unireq/core';
import { graphql } from '@unireq/graphql';

const gql = client(graphql('https://countries.trevorblades.com'));
const { data } = await gql.post('/', {
  body: { query: '{ countries { name capital } }' }
});
```

### More examples

See [`examples/`](./examples) for 20+ runnable demos:

| Category | Examples |
|----------|----------|
| **HTTP Basics** | `http-basic.ts`, `http-verbs.ts` |
| **Authentication** | `oauth-refresh.ts` |
| **Resilience** | `retry-backoff.ts` |
| **Uploads** | `multipart-upload.ts`, `bulk-document-upload.ts`, `streaming-upload.ts` |
| **Downloads** | `streaming-download.ts` |
| **GraphQL** | `graphql-query.ts`, `graphql-mutation.ts` |
| **Real-time** | `sse-events.ts` |
| **Caching** | `conditional-etag.ts`, `conditional-lastmodified.ts`, `conditional-combined.ts` |
| **Interceptors** | `interceptors-logging.ts`, `interceptors-metrics.ts`, `interceptors-cache.ts` |
| **Validation** | `validation-demo.ts`, `validation-adapters.ts` |

Run all examples: `pnpm examples:all`

---

## Quality Gates

| Metric | Requirement |
|--------|-------------|
| **Core bundle size** | < 8 KB (min+gz, excl. peers) |
| **Test coverage** | 100% (lines/functions/branches/statements) |
| **Test suite** | 4229 tests across 14 packages |
| **Linter** | Biome (clean) |
| **ESM** | All exports pass |
| **CI** | pnpm × Node 20/22/24 |

---

## Development

```bash
# Install
pnpm install

# Build all packages
pnpm build

# Lint & format
pnpm lint
pnpm lint:fix

# Test with coverage (100% gate)
pnpm test:coverage

# Release
pnpm release
```

---

## License

MIT © [Olivier Orabona](https://github.com/oorabona)
