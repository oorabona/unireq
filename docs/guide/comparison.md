# Comparison with npm Alternatives

This page provides an honest comparison of @unireq against popular HTTP client libraries in the npm ecosystem.

---

## Competitive Landscape

| Library | Weekly Downloads | Positioning |
|---------|------------------|-------------|
| **axios** | ~72M | De facto standard, ubiquitous |
| **undici** | ~28M | Official Node.js client, raw performance |
| **got** | ~25M | Feature-rich, Node.js focused |
| **node-fetch** | ~22M | Fetch polyfill, legacy |
| **ky** | ~3.5M | Minimal fetch wrapper, modern |
| **ofetch** | ~2M | Nuxt ecosystem, isomorphic |
| **wretch** | ~100K | Fluent API, composition |
| **@unireq** | New | Policy-based composition, multi-transport |

---

## Architecture Comparison

| Criteria | axios | got | ky | undici | @unireq |
|----------|-------|-----|----|---------|---------|
| **Pattern** | Monolithic | Plugin-based | Wrapper | Low-level | **Policy Composition** |
| **Extensibility** | Interceptors | Hooks | Hooks | Dispatcher | **Onion Middleware** |
| **Transport** | XHR/fetch | http/https | fetch | Custom | **Multi-transport abstraction** |
| **TypeScript** | Partial | Full | Full | Full | **Full + Generics** |

### What Makes @unireq Different

@unireq uses a **policy composition** architecture, similar to Koa's middleware model. Each concern (retry, circuit breaker, logging) is an isolated, testable policy function:

```typescript
// @unireq: Each policy is a pure function
const api = client(
  http(uri),
  retry(predicate, strategies, options),
  circuitBreaker(options),
  log({}),
  parse.json()
);

// vs axios: Monolithic configuration object
const api = axios.create({
  baseURL: uri,
  timeout: 5000,
  // No built-in retry, circuit breaker, etc.
});
```

---

## Feature Comparison

| Feature | axios | got | ky | undici | @unireq |
|---------|-------|-----|----|---------|---------|
| **Automatic retry** | Plugin | ✅ Built-in | ✅ | ❌ | ✅ **+ Rate-limit aware** |
| **Circuit Breaker** | ❌ | ❌ | ❌ | ❌ | ✅ **Built-in** |
| **Throttle/Rate limit** | ❌ | ❌ | ❌ | ❌ | ✅ **Built-in** |
| **Conditional (ETag)** | ❌ | ❌ | ❌ | ❌ | ✅ **Built-in** |
| **OAuth token refresh** | ❌ | ❌ | ❌ | ❌ | ✅ **@unireq/oauth** |
| **Response validation** | ❌ | ❌ | ❌ | ❌ | ✅ **Zod/Valibot adapters** |
| **GraphQL** | ❌ | ❌ | ❌ | ❌ | ✅ **@unireq/graphql** |
| **HTTP/2** | ❌ | ✅ | ❌ | ❌ | ✅ **@unireq/http2** |
| **Streaming** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **SSE (Server-Sent Events)** | ❌ | ❌ | ❌ | ❌ | ✅ **Built-in** |
| **FTP/IMAP** | ❌ | ❌ | ❌ | ❌ | ✅ **Dedicated packages** |
| **Introspection API** | ❌ | ❌ | ❌ | ❌ | ✅ **`inspect()` for debugging** |

---

## Developer Experience Comparison

| Criteria | axios | got | ky | @unireq Core | @unireq Presets |
|----------|-------|-----|----|--------------|-----------------|
| **Verbosity** | Medium | High | Low | High | **Very Low** |
| **Learning curve** | Easy | Medium | Easy | Medium | **Easy** |
| **Sensible defaults** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **One-liner setup** | ❌ | ❌ | ✅ | ❌ | ✅ |

### One-liner Comparison

```typescript
// ky
const api = ky.create({ prefixUrl: 'https://api.example.com', retry: 3 });

// @unireq/presets (comparable!)
const api = preset.api.json.retry.timeout.build('https://api.example.com');
```

---

## Enterprise Features

### Circuit Breaker

@unireq is the only HTTP client with a built-in circuit breaker:

```typescript
import { client, circuitBreaker } from '@unireq/core';
import { http } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  circuitBreaker({
    threshold: 5,        // Open after 5 failures
    resetTimeout: 30000, // Try again after 30s
    halfOpenRequests: 1, // Allow 1 test request
  })
);
```

With other libraries, you need external packages like `opossum` or `cockatiel`.

### Rate-Limit Aware Retry

@unireq's retry system understands `Retry-After` headers:

```typescript
import { client, retry, backoff } from '@unireq/core';
import { http, httpRetryPredicate, rateLimitDelay } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  retry(
    httpRetryPredicate({ statusCodes: [429, 503] }),
    [
      rateLimitDelay({ maxWait: 60000 }), // Respect Retry-After header
      backoff({ initial: 1000, max: 30000, jitter: true }),
    ],
    { tries: 5 }
  )
);
```

### Conditional Requests (ETag/Last-Modified)

Built-in support for HTTP caching semantics:

```typescript
import { conditional } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  conditional({ etag: true, lastModified: true })
);

// Automatically sends If-None-Match / If-Modified-Since headers
// Returns cached response on 304 Not Modified
```

---

## When to Choose @unireq

### Choose @unireq if you need:

- **Policy composition** — Isolated, testable middleware
- **Enterprise features** — Circuit breaker, throttle, rate-limit handling
- **Multi-transport** — HTTP, HTTP/2, FTP, IMAP in one API
- **Type safety** — Full TypeScript generics for request/response
- **Response validation** — Zod/Valibot integration
- **OAuth refresh** — Automatic token refresh with JWKS validation

### Choose axios if you need:

- **Maximum ecosystem support** — Most tutorials use axios
- **Browser compatibility** — Works everywhere
- **Simple use cases** — Basic REST API calls

### Choose got if you need:

- **Node.js only** — Optimized for server-side
- **HTTP/2 today** — Mature HTTP/2 support
- **Pagination** — Built-in pagination helpers

### Choose ky if you need:

- **Minimal bundle** — ~2KB gzipped
- **Browser-first** — Built on fetch
- **Simple API** — Just a fetch wrapper

### Choose undici if you need:

- **Raw performance** — Fastest Node.js client
- **Low-level control** — Direct socket access
- **Official support** — Maintained by Node.js team

---

## Migration from Other Libraries

See our migration guides:
- [Migrating from axios](guides/migrate-axios.md)
- [Migrating from got](guides/migrate-got.md)
- [Migrating from ky](guides/migrate-ky.md)

---

## Benchmark Considerations

Performance benchmarks vary significantly based on:
- Network conditions
- Payload sizes
- Concurrency levels
- Feature usage (retry, logging, etc.)

@unireq prioritizes **correctness and composability** over raw speed. For most applications, the difference is negligible. If you need maximum throughput with minimal features, consider `undici` directly.

@unireq's `http()` transport uses `undici` under the hood, so you get excellent performance with added policy composition.
