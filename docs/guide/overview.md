# What is Unireq?

Unireq is a pipe-first, tree-shakeable I/O toolkit for Node.js. Every behavior — retry, auth, caching, rate-limiting, observability — is a composable **Policy** function that you plug into a pipeline. There is no monolithic options object, no magic configuration key, no hidden interceptor queue.

If you know how middleware works in Koa or Express, you already understand the model.

---

## The Problem

Every major HTTP client eventually grows an interceptor system. And interceptors work — until you have six of them, three packages adding their own, scattered state shared through a mutable instance, and a retry that fires *after* your token refresh but *before* your logger has seen the error.

Debugging that means reading source code for the library, not your own. Testing it means mocking the instance and hoping nothing else touched it first.

---

## The Solution

```ts
import { client, retry, backoff, throttle } from '@unireq/core';
import { http, headers, parse, httpRetryPredicate, rateLimitDelay } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

const api = client(
  http('https://api.example.com'),          // transport
  headers({ 'user-agent': 'myapp/1.0' }),   // outbound
  throttle({ rps: 50 }),                    // rate-limit
  retry(
    httpRetryPredicate({ statusCodes: [429, 503] }),
    [rateLimitDelay(), backoff({ initial: 100, max: 5000 })],
    { tries: 3 }
  ),
  oauthBearer({ tokenSupplier: getToken }), // auth
  parse.json()                              // inbound
);

const user = await api.get<User>('/users/42');
```

The order is explicit and readable. Each line is a pure, independent, unit-testable function. Move a line — change the behavior. No surprises.

---

## Key Ideas

### Everything is a Policy

```ts
type Policy = (ctx: RequestContext, next: Next) => Promise<Response>
```

A Policy intercepts the request going in, calls `next()` to hand off to the rest of the chain, and intercepts the response coming back. That contract is identical whether you are retrying, injecting a Bearer token, writing a cache layer, or emitting an OpenTelemetry span.

Writing a custom policy is four lines:

```ts
import { policy } from '@unireq/core';

export const requestId = policy(async (ctx, next) => {
  return next({ ...ctx, headers: { ...ctx.headers, 'x-request-id': crypto.randomUUID() } });
}, { name: 'requestId', kind: 'observability' });
```

### Compose, Don't Configure

`client()` is a thin wrapper around `compose()`. Policies run **outside-in** on the request and **inside-out** on the response — exactly like an onion:

```
request →
  [headers]
    [throttle]
      [retry]
        [oauthBearer]
          [parse.json]
            [transport]         ← actual I/O
          [parse.json]
        [oauthBearer]
      [retry]
    [throttle]
  [headers]
← response
```

This means `retry` wraps `oauthBearer`: if the token is expired, auth refreshes it, then retry replays the request with the fresh token — in the right order, every time, with zero configuration.

### Multi-Protocol, One API

The transport is just another argument. Swap it and the same policies apply:

```ts
import { client } from '@unireq/core';
import { http }  from '@unireq/http';
import { http2 } from '@unireq/http2';
import { imap }  from '@unireq/imap';
import { ftp }   from '@unireq/ftp';

const rest  = client(http('https://api.example.com'),  parse.json());
const fast  = client(http2('https://grpc.example.com'), parse.json());
const mail  = client(imap({ host: 'imap.example.com', auth }));
const files = client(ftp({ host: 'ftp.example.com', user, password }));
```

Auth policies, retry logic, observability — all reusable across transports.

### Type-Safe Results

Unireq ships a `Result<T, E>` type (Ok | Err union) so you never have to write a try/catch for recoverable failures:

```ts
const result = await api.safe.get<User[]>('/users');

if (result.isOk()) {
  return result.value.data;   // TypeScript knows this is User[]
}

// Functional style
const names = result.map(res => res.data.map(u => u.name));

// With a default
const count = result.unwrapOr([]).length;
```

`api.safe.*` mirrors every method on the normal client. There is no separate class — just a namespace.

---

## Performance

Unireq's `http()` transport is built on [undici](https://github.com/nodejs/undici) — the same engine powering Node.js's built-in `fetch`. You get native connection pooling and HTTP/1.1 pipelining by default.

| Scenario | Throughput |
|----------|-----------|
| Single request, no policies | ≈ native fetch |
| 100 concurrent requests | 26–32 % faster than axios / got |
| 7-policy stack (retry + auth + parse + otel) | +12 % overhead vs zero policies |

> For methodology and raw numbers, see [BENCHMARKS.md](../BENCHMARKS.md).

The overhead of the policy pipeline is negligible compared to network latency. The win comes from not paying for features you never compose in.

---

## What's in the Box

| Package | What it does |
|---------|-------------|
| **`@unireq/core`** | `client`, `compose`, `retry`, `backoff`, `throttle`, `circuitBreaker`, `Result` |
| **`@unireq/http`** | `http()` transport (undici), `parse`, `body`, `headers`, SSE, multipart, range |
| **`@unireq/http2`** | `http2()` transport with ALPN + session pooling |
| **`@unireq/oauth`** | Bearer token injection, automatic refresh, JWKS validation |
| **`@unireq/cookies`** | Cookie jar with `http-cookie-agent` integration |
| **`@unireq/xml`** | XML parsing / serialization via `fast-xml-parser` |
| **`@unireq/graphql`** | Typed GraphQL requests over HTTP |
| **`@unireq/imap`** | IMAP transport via `imapflow` (XOAUTH2 ready) |
| **`@unireq/ftp`** | FTP/S transport via `basic-ftp` |
| **`@unireq/smtp`** | SMTP transport for outbound mail |
| **`@unireq/otel`** | OpenTelemetry traces and metrics as a policy |
| **`@unireq/config`** | Shared constants, security defaults, `UNIREQ_*` env vars |
| **`@unireq/presets`** | Fluent builder + batteries-included clients (`httpClient`, `preset.api.*`) |
| **`@unireq/cli`** | Interactive REPL + one-shot mode — curl-like, OpenAPI-aware |

Every package is tree-shakeable. Import only what you compose.

---

## Ready?

```bash
pnpm add @unireq/core @unireq/http @unireq/presets
```

- **[Quick Start](guide/quick-start.md)** — First client in under two minutes.
- **[Architecture](guide/architecture.md)** — Package layout and layering rules.
- **[Comparison](guide/comparison.md)** — Honest comparison with axios, got, ky, undici.

---

<p align="center">
  <a href="#/README">← Home</a> · <a href="#/guide/quick-start">Quick Start →</a>
</p>
