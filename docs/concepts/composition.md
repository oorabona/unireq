# Composition Model

## Onion Middleware

Unireq uses an "onion" middleware model via `compose(...policies)`. Requests flow through policies from outer to inner, reach the transport, and then responses flow back from inner to outer.

```ts
const policy = compose(
  policyA, // Pre-call (outer layer)
  policyB, // Pre-call (middle layer)
  policyC  // Pre-call (inner layer)
);
// Execution: A → B → C → transport → C → B → A
```

## Flow Direction & Ordering

- Policies are executed **in the order they are passed** before the transport, then unwind in reverse on the way out.
- Global policies declared in `client(transport, ...policies)` wrap every request. Per-call policies passed to `client.request(url, init, ...once)` are appended afterward, so they sit closest to the transport.
- Because the chain is deterministic, the relative order decides who sees the request/response first for cross-cutting concerns.

| Goal | Recommended placement | Rationale |
| --- | --- | --- |
| Observability (logging, tracing, metrics) | Outermost | Captures the full latency envelope and every retry attempt. |
| Resilience (`retry`, circuit breaker) | Just inside observability | Needs to see failures before lower layers swallow them, but should wrap auth/parsing. |
| Authentication (`oauthBearer`, `cookies`, `sign`) | Near the transport | Must run for every retry and see responses (401, 419) before resilience decides to propagate. |
| Serialization (`body.*`, `multipart`, request validators) | Inner | Prepares the final payload once per attempt. |
| Parsing / deserialization (`parse.*`, validators) | Innermost (just outside transport) | Needs access to the raw response before other policies transform it. |

### Retry vs OAuth example

```ts
import { client, retry } from '@unireq/core';
import { http, parse, httpRetryPredicate, rateLimitDelay } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

const api = client(
  http('https://api.example.com'),
  retry(httpRetryPredicate(), [rateLimitDelay({ maxWait: 60_000 })]), // outer
  oauthBearer({ tokenSupplier: fetchToken }),                           // inner
  parse.json(),                                                         // closest to transport
);
```

Placing `retry` outside `oauthBearer` lets the OAuth policy observe `401 Unauthorized` responses first. It can refresh the access token and replay the call without the retry layer intervening. Only if the refreshed attempt still fails (timeout, 5xx, exhausted refresh) does the `retry` predicate run. If you inverted the order, the retry handler could reissue the request with the stale token multiple times before OAuth has a chance to refresh, amplifying failures.

The same reasoning applies to other stacks:

- Put request signing or mTLS closer to the transport so each replay is fully authenticated.
- Keep parsers last so they always see the definitive response body, even if a retry replays the attempt.
- If you need to mutate headers after OAuth (for example to add a `traceparent`), ensure that policy sits *outside* the auth layer so refreshed requests still carry your custom header.

## Conditional Branching

You can use `either(pred, then, else)` to create conditional branches in your policy chain. This is useful for content negotiation or handling different scenarios based on request context.

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

<p align="center">
  <a href="#/README">← Home</a> · <a href="#/concepts/body-parsing">Body & Parsing →</a>
</p>