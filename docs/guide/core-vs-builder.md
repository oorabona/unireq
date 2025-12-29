# Core vs Preset Builder

@unireq offers two ways to configure HTTP clients:

1. **Core API** — Maximum control, compose policies manually
2. **Preset Builder** — Fluent chainable API with sensible defaults

Both approaches produce the same result. Choose based on your needs:

| Aspect | Core API | Preset Builder |
|--------|----------|----------------|
| **Control** | Full control over policy order | Pre-defined order, can escape via `.with()` |
| **Verbosity** | More explicit | More concise |
| **Defaults** | None, you configure everything | Sensible defaults |
| **Learning curve** | Need to know each policy | Just chain what you need |
| **Best for** | Advanced use cases, libraries | Application code, quick setup |

---

## Comparison Table

| Feature | Core API | Preset Builder |
|---------|----------|----------------|
| JSON parsing | `parse.json()` | `.json` |
| Retry | `retry(predicate, strategies, opts)` | `.retry` or `.withRetry({ tries: 5 })` |
| Timeout | `timeout(ms)` | `.timeout` or `.withTimeout(5000)` |
| Caching | `cache(options)` | `.cache` or `.withCache({ defaultTtl: 60000 })` |
| Logging | `log({ logger })` | `.logging` or `.withLogging(logger)` |
| Redirect | `redirectPolicy({ allow })` | `.redirect` or `.withRedirect({ allow: [301] })` |
| Circuit Breaker | `circuitBreaker(options)` | `.circuitBreaker` or `.withCircuitBreaker({ threshold: 10 })` |
| Throttle | `throttle(options)` | `.throttle` or `.withThrottle({ requestsPerSecond: 5 })` |
| Conditional | `conditional(options)` | `.conditional` or `.withConditional({ etag: true })` |
| Headers | `headers({ ... })` | `.withHeaders({ ... })` |
| Query params | `query({ ... })` | `.withQuery({ ... })` |
| OAuth | `oauthBearer({ ... })` | `.oauth({ ... })` |
| Validation | `validate(adapter)` | `.withValidation(adapter)` |
| Interceptors | `interceptRequest()`, `interceptResponse()` | `.withInterceptors({ request, response })` |

---

## Examples

### Simple JSON API

**Core API:**
```typescript
import { client, retry, backoff, log } from '@unireq/core';
import { http, httpRetryPredicate, parse, timeout, rateLimitDelay } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  timeout(30000),
  retry(
    httpRetryPredicate({ methods: ['GET', 'PUT', 'DELETE'] }),
    [rateLimitDelay({ maxWait: 60000 }), backoff({ initial: 1000, max: 30000, jitter: true })],
    { tries: 3 }
  ),
  log({}),
  parse.json()
);
```

**Preset Builder:**
```typescript
import { preset } from '@unireq/presets';

const api = preset.api.json.retry.timeout.logging.build('https://api.example.com');
```

---

### API with OAuth and Custom Headers

**Core API:**
```typescript
import { client, retry, backoff, log } from '@unireq/core';
import { http, httpRetryPredicate, parse, timeout, headers, rateLimitDelay } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

const api = client(
  http('https://api.example.com'),
  headers({ 'X-API-Version': 'v2' }),
  timeout(10000),
  retry(
    httpRetryPredicate({ methods: ['GET'], statusCodes: [429, 500, 502, 503, 504] }),
    [rateLimitDelay({ maxWait: 60000 }), backoff({ initial: 500, max: 10000, jitter: true })],
    { tries: 5 }
  ),
  oauthBearer({
    tokenSupplier: () => getAccessToken(),
    jwks: { type: 'url', url: 'https://auth.example.com/.well-known/jwks.json' },
  }),
  log({}),
  parse.json()
);
```

**Preset Builder:**
```typescript
import { preset } from '@unireq/presets';
import { jwksFromUrl } from '@unireq/oauth';

const api = preset.api
  .json
  .withHeaders({ 'X-API-Version': 'v2' })
  .withRetry({ tries: 5, methods: ['GET'] })
  .withTimeout(10000)
  .oauth({
    tokenSupplier: () => getAccessToken(),
    jwks: jwksFromUrl('https://auth.example.com/.well-known/jwks.json'),
  })
  .logging
  .build('https://api.example.com');
```

---

### Full-Featured Production API

**Core API:**
```typescript
import { client, retry, backoff, circuitBreaker, throttle, log, validate } from '@unireq/core';
import {
  http, httpRetryPredicate, parse, timeout, headers, query,
  cache, conditional, redirectPolicy, rateLimitDelay
} from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

const api = client(
  http('https://api.example.com'),
  headers({ 'X-API-Key': process.env.API_KEY }),
  query({ version: 'v2' }),
  timeout(30000),
  throttle({ requestsPerSecond: 10, burst: 5 }),
  circuitBreaker({ threshold: 5, resetTimeout: 30000, halfOpenRequests: 1 }),
  redirectPolicy({ allow: [307, 308] }),
  retry(
    httpRetryPredicate({ methods: ['GET', 'PUT', 'DELETE'], statusCodes: [408, 429, 500, 502, 503, 504] }),
    [rateLimitDelay({ maxWait: 60000 }), backoff({ initial: 1000, max: 30000, jitter: true })],
    { tries: 3 }
  ),
  conditional({ etag: true, lastModified: true }),
  cache({ defaultTtl: 300000 }),
  oauthBearer({ tokenSupplier: () => getToken(), allowUnsafeMode: true }),
  log({}),
  validate(zodAdapter(UserSchema)),
  parse.json()
);
```

**Preset Builder:**
```typescript
import { preset } from '@unireq/presets';

const api = preset.api
  .json
  .withHeaders({ 'X-API-Key': process.env.API_KEY })
  .withQuery({ version: 'v2' })
  .timeout
  .throttle
  .circuitBreaker
  .redirect
  .retry
  .conditional
  .cache
  .oauth({ tokenSupplier: () => getToken(), allowUnsafeMode: true })
  .logging
  .withValidation(zodAdapter(UserSchema))
  .build('https://api.example.com');
```

---

## When to Use Core API

Use the Core API when you need:

- **Custom policy order** — Policies execute in the order you specify
- **Custom policies** — Write your own middleware
- **Non-HTTP transports** — FTP, IMAP, etc.
- **Library development** — Maximum flexibility for consumers

```typescript
// Custom policy example
const customMetrics = (ctx, next) => {
  const start = Date.now();
  try {
    return await next();
  } finally {
    recordMetric('api_latency', Date.now() - start);
  }
};

const api = client(
  http('https://api.example.com'),
  customMetrics,  // Your custom policy
  retry(...),
  parse.json()
);
```

---

## When to Use Preset Builder

Use the Preset Builder when you need:

- **Quick setup** — Get started in one line
- **Sensible defaults** — Don't worry about configuration
- **Readability** — Chain what you need, ignore what you don't
- **Application code** — Most use cases covered

```typescript
// One line setup
const api = preset.api.json.retry.timeout.build('https://api.example.com');

// Still composable
const data = await api.get<User[]>('/users');
```

---

## Escape Hatch: `.with()`

The builder provides `.with()` to add custom policies:

```typescript
import { preset } from '@unireq/presets';
import { myCustomPolicy } from './policies';

const api = preset.api
  .json
  .retry
  .with(myCustomPolicy)  // Add custom policy
  .build('https://api.example.com');
```

---

## Default Values Reference

| Property | Default Value |
|----------|---------------|
| `.timeout` | 30,000 ms (30s) |
| `.retry` | 3 tries, methods: GET/PUT/DELETE, codes: 408/429/500/502/503/504 |
| `.cache` | 5 minute TTL |
| `.circuitBreaker` | 5 failures, 30s reset, 1 half-open request |
| `.throttle` | 10 requests/second, burst of 5 |
| `.conditional` | ETag + Last-Modified both enabled |
| `.redirect` | Allow 307/308 only (safe redirects) |
