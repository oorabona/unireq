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
- ✨ **Result type** — Functional error handling with `safe.*` methods
- 🚀 **httpClient()** — Zero-config client with sensible defaults

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
| **Result type (safe methods)** | ✅ Built-in | ❌ | ❌ | ❌ | ❌ |
| **100% test coverage** | ✅ | ❌ | ❌ | ✅ | ❌ |

### What sets @unireq apart

1. **Pipe-first composition** — Build clients declaratively with `compose(...policies)`. No magic, just functions.

2. **Production-ready auth** — OAuth Bearer with JWT introspection, automatic token refresh on 401, clock skew tolerance. No boilerplate.

3. **Smart retries** — Combines multiple strategies: `rateLimitDelay()` reads `Retry-After` headers, `backoff()` handles transient failures. Works together seamlessly.

4. **Multi-protocol** — Same API for HTTP, HTTP/2, IMAP, FTP. Switch transports without rewriting business logic.

5. **Introspection** — Debug any request with `introspect()`: see exact headers, timing, retries, and policy execution order.

6. **Minimal footprint** — Import only what you use. The core is ~8 KB, and tree-shaking removes unused policies.

### When to use something else

- **Quick scripts**: `node-fetch` or native `fetch` if you just need simple GET/POST
- **Browser-only**: `ky` offers excellent browser support with smaller footprint
- **Legacy Node.js**: `axios` if you need Node < 18 support

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

```typescript
import { client } from '@unireq/core';
import { http2 } from '@unireq/http2';

const h2Client = client(http2('https://http2.example.com'));
```

<br/>

---

## Ecosystem

Unireq is modular by design. You only install what you need.

### Core Packages

| Package | Description |
| :--- | :--- |
| [`@unireq/core`](packages/core.md) | Client factory, composition, flow control, and error handling. |
| [`@unireq/http`](packages/http.md) | Standard HTTP/1.1 transport based on `undici`. |
| [`@unireq/http2`](packages/http2.md) | HTTP/2 transport with multiplexing support. |

### Middleware & Utilities

| Package | Description |
| :--- | :--- |
| [`@unireq/oauth`](packages/oauth.md) | OAuth 2.0 Bearer token management with auto-refresh. |
| [`@unireq/cookies`](packages/cookies.md) | Cookie jar support for stateful sessions. |
| [`@unireq/xml`](packages/xml.md) | XML parsing and serialization. |
| [`@unireq/graphql`](packages/graphql.md) | GraphQL query and mutation support. |

### Protocol Adapters

| Package | Description |
| :--- | :--- |
| [`@unireq/imap`](packages/imap.md) | IMAP client for email retrieval. |
| [`@unireq/ftp`](packages/ftp.md) | FTP/FTPS client for file transfer. |

---

## Next Steps

- **[Quick Start](guide/quick-start.md)**: Get up and running in minutes.
- **[Tutorials](tutorials/getting-started.md)**: Step-by-step guides for common scenarios.
- **[Examples](examples/basic.md)**: Copy-pasteable code snippets.

---

<p align="center">
  <a href="#/guide/quick-start">🚀 Get Started</a> · <a href="#/packages/core">📦 Explore Packages</a> · <a href="#/examples/basic">💻 View Examples</a>
</p>
