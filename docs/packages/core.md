# @unireq/core

The core package provides the foundational building blocks for the Unireq ecosystem: client creation, policy composition, flow-control primitives, introspection, validation, and the DX-focused error catalog.

## Installation

```bash
pnpm add @unireq/core
```

## Export Overview

| Category | Symbols | Purpose |
| --- | --- | --- |
| Client factory | `client`, `Policy`, `Transport` | Create clients by composing transports + policies with per-request overrides. |
| Composition | `compose`, `either`, `match`, `policy`, `slot`, `validatePolicyChain` | Build reusable middleware stacks with slot/capability safety. |
| Flow control | `retry`, `backoff`, `circuitBreaker`, `throttle` | Keep calls resilient with retries, backoff, circuit breaking, and rate limiting. |
| Introspection | `inspect`, `inspectable`, `getHandlerGraph`, `log`, `assertHas`, `hasSlotType` | Trace policy graphs, produce structured logs, and expose DX tooling. |
| Validation & serialization | `serializationPolicy`, `isBodyDescriptor`, `validate`, `ValidationAdapter` | Normalize bodies automatically and guarantee typed responses. |
| Errors & utilities | `HttpError`, `TimeoutError`, `appendQueryParams`, `normalizeHeaders`, etc. | Consistent error surface and URL/header helpers. |

## Client Factory & Per-request Policies

`client(transport, ...policies)` wires a transport (HTTP, FTP, IMAP, …) with a deterministic policy chain. Policies passed to the factory become the **global** middleware stack; you may also supply per-request policies:

```typescript
import { client } from '@unireq/core';
import { http, headers, timeout } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  headers({ 'x-api-key': 'secret' }),
  timeout(10_000),
);

// Add a one-off parser just for this call
const user = await api.get('/users/42', parse.json());
```

Behind the scenes the factory automatically inserts `serializationPolicy()` (so `body.*` and `parse.*` work without manual wiring) and validates slot ordering/capabilities via `validatePolicyChain`.

### RequestOptions API

For cleaner code, you can pass a single options object instead of variadic policies:

```typescript
// Traditional variadic API
await api.post('/users', body.json(payload), customPolicy);

// New RequestOptions API
await api.post('/users', {
  body: payload,           // Automatically wrapped in body.json()
  policies: [customPolicy],
  signal: abortController.signal,
});

// Empty options are valid (no body, no extra policies)
await api.get('/users', {});
```

Both APIs are fully supported and can be mixed within the same codebase.

## Result Type & Safe Methods

For functional error handling without try/catch, use the `Result<T, E>` type and `client.safe.*` methods:

### Result<T, E> Type

```typescript
import { ok, err, fromPromise, fromTry, type Result } from '@unireq/core';

// Create results
const success: Result<number, Error> = ok(42);
const failure: Result<number, Error> = err(new Error('failed'));

// Transform with map/flatMap
const doubled = success.map(n => n * 2);           // ok(84)
const chained = success.flatMap(n => ok(n + 1));   // ok(43)

// Extract values safely
success.unwrap();           // 42
failure.unwrapOr(0);        // 0 (default value)
success.unwrapErr();        // throws (it's Ok)

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
const syncResult = fromTry(() => JSON.parse(data));
```

### Safe Client Methods

Every client has a `safe` namespace that returns `Result` instead of throwing:

```typescript
const api = client(http('https://api.example.com'), parse.json());

// Throwing API (traditional)
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

All HTTP methods are available: `safe.get`, `safe.post`, `safe.put`, `safe.delete`, `safe.patch`, `safe.head`, `safe.options`.

## Policy Composition & Slots

- `compose(...policies)` lets you package small policies into higher-level bundles (e.g., an `authPolicy`).
- `policy(fn, meta)` tags a policy with introspection metadata (`name`, `kind`, `options`).
- `slot({ type, name, requiredCapabilities })` marks a policy as occupying a transport/auth/parser slot so duplicate/conflicting middleware can be caught at build time.
- `either` and `match` express branching middleware (content negotiation, protocol routing, feature flags, etc.).

```typescript
import { compose, either } from '@unireq/core';
import { parse } from '@unireq/http';
import { parse as parseXml } from '@unireq/xml';

const smartParser = compose(
  either(
    (ctx) => ctx.headers.accept?.includes('application/json') ?? false,
    parse.json(),
    parseXml(),
  ),
);
```

## Flow-control & Resilience Toolkit

### `retry(predicate, strategies, options)`

- Transport-agnostic retry loop. The predicate receives `(result, error, attempt, ctx)` and decides whether to retry.
- Combine multiple delay strategies; the first that returns a value wins.
- `options.tries` defaults to `3`; `onRetry` lets you report attempts.

```typescript
import { retry, backoff } from '@unireq/core';
import { httpRetryPredicate } from '@unireq/http';

const resilient = retry(
  httpRetryPredicate({ statusCodes: [408, 429, 500, 502, 503, 504] }),
  [backoff({ initial: 200, max: 2_000, jitter: true })],
  { tries: 4 },
);
```

### `backoff({ initial = 1000, max = 30000, multiplier = 2, jitter = true })`

Creates an inspectable delay strategy that caps exponential growth and optionally adds jitter.

### `circuitBreaker` & `throttle`

Both policies export the same inspectable metadata surface, enabling observability dashboards. Use them to protect upstream services or comply with vendor QPS limits.

## Introspection, Logging, and DX

- `inspect(handler, options)` walks the handler graph (built from `policy` metadata) and produces a serializable tree for docs, unit tests, or CLI tooling.
- `log(options)` emits structured events (`start`, `success`, `error`) with duration, request metadata, and redacted secrets.
- `inspectable` and `getInspectableMeta` let you tag custom predicates/strategies so they show up in the graph alongside built-ins.
- `assertHas(handler, kind)` is a guard to ensure a composed client actually contains the expected policies (great for integration tests).
- `hasSlotType(policy, type)` checks whether a policy occupies a specific slot (`'transport'`, `'auth'`, `'parser'`). Useful for runtime inspection or conditional composition:

```typescript
import { hasSlotType } from '@unireq/core';

if (hasSlotType(myPolicy, 'parser')) {
  console.log('This policy is a parser');
}
```

### Audit Logging (OWASP A09:2021)

`audit(options)` creates a structured security logging policy with correlation IDs, user context, and sensitive data redaction:

```typescript
import { audit, createConsoleAuditLogger } from '@unireq/core';

const api = client(
  http('https://api.example.com'),
  audit({
    logger: createConsoleAuditLogger(),
    getUserId: (ctx) => ctx.headers['x-user-id'],
    getSessionId: (ctx) => ctx.headers['x-session-id'],
    getClientIp: (ctx) => ctx.headers['x-forwarded-for'],
    detectSuspiciousActivity: (ctx, response) =>
      response !== undefined && (response.status === 401 || response.status === 403),
  }),
  parse.json(),
);
```

**`createLoggerAdapter(logger)`** bridges a standard `Logger` (used by `log()`) into an `AuditLogger` (used by `audit()`). This lets you reuse the same logger instance for both policies:

```typescript
import { audit, createLoggerAdapter, log } from '@unireq/core';

// Same logger for both log() and audit()
const logger: Logger = { debug: ..., info: ..., warn: ..., error: ... };

const api = client(
  http('https://api.example.com'),
  log({ logger }),
  audit({ logger: createLoggerAdapter(logger) }),
  parse.json(),
);
```

The adapter maps audit severity levels: `critical`/`error` → `logger.error()`, `warn` → `logger.warn()`, default → `logger.info()`.

See [`examples/audit-with-logger.ts`](https://github.com/nicmusic/unireq/blob/main/examples/audit-with-logger.ts) for a full runnable example.

## Validation & Serialization

- `serializationPolicy()` detects `body.*` descriptors and sets the right headers; `isBodyDescriptor` lets you build custom serializers.
- `validate(schema, adapter)` transforms any schema library into a policy. Ship Zod, Valibot, ArkType, or your own adapter — all via the `ValidationAdapter` interface.

### Zod adapter inlined in the client

```typescript
import { client, validate } from '@unireq/core';
import { http, parse } from '@unireq/http';
import { z } from 'zod';

const UserResponse = z.object({
  id: z.number(),
  email: z.string().email(),
  username: z.string(),
});

const zodAdapter = {
  validate: (schema: typeof UserResponse, data: unknown) => schema.parse(data),
};

const api = client(
  http('https://jsonplaceholder.typicode.com'),
  parse.json(),
  validate(UserResponse, zodAdapter),
);

const user = await api.get('/users/1');
```

- The adapter object only needs a `validate(schema, data)` method. Embed it inline for small projects or export a reusable helper the way [examples/validation-adapters.ts](examples/validation-adapters.ts) does.
- Because validation sits after the parser, the `data` input already contains parsed JSON/XML/etc. You can safely return enriched/typed data (e.g., `schema.parse(data)` or `schema.parseAsync(data)`).

### Valibot guarding both request and response

```typescript
import { client, validate } from '@unireq/core';
import { body, http, parse } from '@unireq/http';
import * as v from 'valibot';

const CreateUserInput = v.object({
  email: v.pipe(v.string(), v.email()),
  name: v.string(),
});

const CreateUserResponse = v.object({
  id: v.number(),
  email: v.pipe(v.string(), v.email()),
  name: v.string(),
  createdAt: v.string(),
});

const valibotAdapter = {
  async validate(schema: typeof CreateUserResponse, data: unknown) {
    return v.parseAsync(schema, data);
  },
};

const api = client(
  http('https://api.example.com'),
  parse.json(),
  validate(CreateUserResponse, valibotAdapter),
);

export async function createUser(input: v.Input<typeof CreateUserInput>) {
  // Validate the outgoing payload before serialization
  const payload = v.parse(CreateUserInput, input);
  return api.post('/users', body.json(payload));
}
```

- Incoming responses are validated by the global policy, while request payloads reuse the same schema before calling `body.json`. This keeps serialization + validation colocated inside the same module.
- For a runnable demo that compares Zod vs Valibot (including failure cases), check [examples/validation-demo.ts](examples/validation-demo.ts).
- If you prefer to avoid calling `v.parse` at every call site, wrap the pattern in a helper/policy and reuse it everywhere:

```typescript
// Helper that validates input and returns a body descriptor ready for serialization
const validatedJson = <TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(schema: TSchema) =>
  (input: v.Input<TSchema>) => body.json(v.parse(schema, input));

await api.post('/users', validatedJson(CreateUserInput)(input));
```

- The helper can just as well be a policy created via `compose()` that inspects `ctx.body` before `serializationPolicy()` runs. Both approaches centralize request validation while keeping call sites terse.
- Combine the helper with the response validator to build an "onion" stack: edge helpers guard outgoing payloads, inner policies guard responses.

```typescript
const guardedApi = client(
  http('https://api.example.com'),
  parse.json(),
  validate(CreateUserResponse, valibotAdapter), // inner layer: responses
);

export async function createUser(input: v.Input<typeof CreateUserInput>) {
  const response = await guardedApi.post('/users', validatedJson(CreateUserInput)(input));
  return response.data; // already typed by Valibot
}
```

- Callers only pass plain inputs; the helper produces a validated body descriptor, while the policy ensures the returned payload matches `CreateUserResponse`. Both directions reuse the same schemas without scattering `v.parse` calls.

## Error Catalogue

Every error extends `UnireqError` (with a stable `code` string) so you can branch on either `instanceof` or `error.code`:

- `NetworkError` – DNS failures, connection resets, TLS issues.
- `TimeoutError` – The policy `timeout` expired (`timeoutMs` is exposed).
- `HttpError` – Opt-in error if you add a throw-on-error policy.
- `SerializationError` – Body parsing/encoding issues.
- `DuplicatePolicyError` – Two policies attempted to occupy the same slot.
- `MissingCapabilityError` – Transport lacks a capability required by a policy.
- `InvalidSlotError` – Slot ordering/constraints violated (e.g., parser before auth).
- `NotAcceptableError` / `UnsupportedMediaTypeError` – Negotiation failures.
- `UnsupportedAuthForTransport` – Tried to install OAuth on a non-supporting transport.
- `URLNormalizationError` – Input URL failed validation.

Use these errors to drive toast messages, telemetry, or feature toggles with confidence.

## Handy Utilities

- URL helpers: `appendQueryParams`, `normalizeURL`, `getHeader`, `setHeader`.
- Header conversion: `toNativeHeaders`, `fromNativeHeaders` for interop with native `Headers` API.
- Type exports (`Client`, `Policy`, `RequestContext`, `Response`, …) make it easy to type your own transports or policies.
- Slots & capabilities allow ecosystem packages to declare what they need without tight coupling.

### Header Conversion Helpers

Convert between `Record<string, string>` (used internally by unireq) and native `Headers`:

```typescript
import { toNativeHeaders, fromNativeHeaders } from '@unireq/core';

// Record → native Headers (for fetch or other APIs)
const record = { 'content-type': 'application/json', 'x-api-key': 'secret' };
const nativeHeaders = toNativeHeaders(record);

// native Headers → Record (for unireq policies)
const fetchResponse = await fetch('/api');
const responseHeaders = fromNativeHeaders(fetchResponse.headers);
```

**Why keep `Record<string, string>`?** Native `Headers` objects are slower and not JSON-serializable. Unireq uses plain objects internally for performance and debugging. These helpers bridge to native APIs when needed.

## Troubleshooting

### "DuplicatePolicyError: Slot 'parser' is already occupied"

**Cause:** You added multiple parsers (e.g., `parse.json()` twice or both globally and per-request).

**Fix:** Remove duplicate parsers. Per-request parsers override global ones:

```typescript
// Global parser
const api = client(http('...'), parse.json());

// This will fail - duplicate parser
await api.get('/users', parse.json()); // DuplicatePolicyError!

// This works - parser is already set globally
await api.get('/users');
```

### "MissingCapabilityError: Transport does not support 'streaming'"

**Cause:** You're using a policy that requires a capability your transport doesn't provide.

**Fix:** Check transport capabilities or use a different transport:

```typescript
import { inspect } from '@unireq/core';

const graph = inspect(api);
console.log(graph.transport.capabilities); // { http: true, streaming: false, ... }
```

### Retry not working

**Cause:** Common issues include wrong policy order or missing predicate.

**Fix:** Ensure retry wraps auth policies and uses the correct predicate:

```typescript
// Correct order - retry outside auth
const api = client(
  http('...'),
  retry(httpRetryPredicate(), [backoff()], { tries: 3 }),
  oauthBearer({ tokenSupplier }),
  parse.json()
);
```

### Circuit breaker immediately open

**Cause:** Threshold reached too quickly due to startup failures.

**Fix:** Increase threshold or add warmup logic:

```typescript
circuitBreaker({
  threshold: 5,        // Failures before opening
  resetTimeout: 30000, // Time before trying again
  halfOpenRequests: 2, // Probes before closing
})
```

### "TimeoutError" on every request

**Cause:** Timeout too short or network latency issues.

**Fix:** Increase timeout or add per-phase timeouts:

```typescript
import { timeout } from '@unireq/http';

timeout({
  connect: 5000,  // Connection establishment
  headers: 10000, // Waiting for headers
  body: 60000,    // Receiving body
  total: 120000,  // Overall limit
})
```

### Response data is undefined

**Cause:** Missing parser policy.

**Fix:** Add `parse.json()` or appropriate parser:

```typescript
// Wrong - no parser
const api = client(http('...'));
const res = await api.get('/users');
console.log(res.data); // undefined!

// Correct
const api = client(http('...'), parse.json());
const res = await api.get('/users');
console.log(res.data); // { users: [...] }
```

---

<p align="center">
  <a href="#/README">&larr; Home</a> &middot; <a href="#/packages/http">HTTP &rarr;</a>
</p>