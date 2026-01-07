# Quick Start

```bash
pnpm add @unireq/core @unireq/http @unireq/presets
```

## The simplest way: httpClient()

For quick prototyping or simple API calls, use `httpClient()` from `@unireq/presets`:

```ts
import { httpClient } from '@unireq/presets';

// Create a client with sensible defaults
const api = httpClient('https://api.example.com');
const user = await api.get('/users/42');

// With options
const api = httpClient('https://api.example.com', {
  timeout: 10000,
  headers: { 'X-API-Key': 'secret' },
});

// Safe methods (returns Result instead of throwing)
const result = await api.safe.get('/users/42');
if (result.isOk()) {
  console.log(result.value.data);
} else {
  console.error(result.error.message);
}
```

## Building a custom client

Unireq is functional and composable. You build a client by passing a **transport** (HTTP, FTP, IMAP, …) and a list of **policies** (middleware). Policies run in the order you provide them on the way **in**, then unwind in reverse on the way **out**.

```ts
import { client } from '@unireq/core';
import { http, headers, parse } from '@unireq/http';

// Create a client with a base URL and some default policies
const api = client(
  http('https://api.example.com'),
  headers({ 'user-agent': 'unireq/1.0' }),
  parse.json() // Automatically parse JSON responses
);

const response = await api.get('/users/123');

if (response.ok) {
  console.log(response.data); // Typed response
} else {
  console.error('Request failed:', response.status);
}
```

> **Note:** Unlike some other libraries, Unireq does **not** throw errors for non-2xx responses by default. Inspect `response.ok` / `response.status`, or plug a policy such as `throwOnError()` if you prefer exceptions.

### Per-request overrides

Global policies keep your client DRY, but you can append one-off policies per call:

```ts
import { body, parse } from '@unireq/http';

// Variadic API (append policies)
await api.post('/users', body.json(payload), parse.json());

// RequestOptions API (more explicit)
await api.post('/users', {
  body: payload,            // Automatically wrapped in body.json()
  policies: [customPolicy],
  signal: abortController.signal,
});
```

Per-request policies are appended after the client-level stack, so they sit closest to the transport. Use them for ad-hoc parsing, conditional retries, or temporary headers without mutating the shared client.

## Functional error handling with Result

Instead of try/catch, use the `Result<T, E>` type for functional error handling:

```ts
import { ok, err, fromPromise, type Result } from '@unireq/core';

// Create results
const success: Result<number, Error> = ok(42);
const failure: Result<number, Error> = err(new Error('failed'));

// Transform with map/flatMap
const doubled = success.map(n => n * 2);           // ok(84)
const chained = success.flatMap(n => ok(n + 1));   // ok(43)

// Extract values safely
success.unwrap();           // 42
failure.unwrapOr(0);        // 0 (default value)

// Pattern matching
const message = success.match({
  ok: (value) => `Got ${value}`,
  err: (error) => `Error: ${error.message}`,
});

// Type guards
if (success.isOk()) {
  console.log(success.value);  // TypeScript knows it's Ok
}

// From async operations
const result = await fromPromise(fetch('/api'));
```

### Safe client methods

Every client has a `safe` namespace that returns `Result` instead of throwing:

```ts
const api = client(http('https://api.example.com'), parse.json());

// Traditional API (throws on network errors)
try {
  const res = await api.get('/users');
} catch (error) {
  handleError(error);
}

// Safe API (functional)
const result = await api.safe.get<User[]>('/users');

if (result.isOk()) {
  console.log(result.value.data);
} else {
  console.error(result.error.message);
}

// Chain operations
const names = await api.safe.get<User[]>('/users')
  .then(r => r.map(res => res.data.map(u => u.name)));
```

## Smart HTTPS client with OAuth, retries, and content negotiation

```ts
import { client, compose, either, retry, backoff } from '@unireq/core';
import { http, headers, parse, redirectPolicy, httpRetryPredicate, rateLimitDelay } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';
import { parse as xmlParse } from '@unireq/xml';

const smartClient = client(
  http('https://api.example.com'),
  headers({ accept: 'application/json, application/xml' }),
  redirectPolicy({ allow: [307, 308] }), // Safe redirects only
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

**Why this order?**

- `headers` and redirect policies wrap everything—they run first on the way in.
- `retry` must stay **outside** `oauthBearer` so the auth layer can inspect `401` responses and refresh tokens before the retry predicate decides to replay.
- Parsing (`parse.json` / XML) belongs closest to the transport to see the raw response from the final attempt (after any retries).

const user = await smartClient.get('/users/me');
```

---

## Next steps

- **[Philosophy](concepts/philosophy.md)** — Why Unireq differs from Axios/Fetch.
- **[Composition](concepts/composition.md)** — Deep dive on policy ordering and conditional branches.
- **[Architecture](guide/architecture.md)** — Package layout and layering guidelines.
- **[Examples](examples/basic.md)** — Ready-to-run scripts matching this guide.

<p align="center">
  <a href="#/README">← Home</a> · <a href="#/concepts/philosophy">Philosophy →</a>
</p>