# Architecture

## Package catalog

| Package | Description |
|---------|-------------|
| **`@unireq/core`** | Client factory, `compose`, `either`, retry/backoff slots, DX errors |
| **`@unireq/http`** | `http()` transport (undici), HTTP policies, serializers/parsers, multipart, range, SSE |
| **`@unireq/http2`** | `http2()` transport powered by `node:http2` with ALPN + session pooling |
| **`@unireq/oauth`** | OAuth Bearer policy with JWT validation and automatic refresh |
| **`@unireq/cookies`** | Cookie jar + `http-cookie-agent/undici` integration |
| **`@unireq/xml`** | XML parsing/serialization via `fast-xml-parser` |
| **`@unireq/graphql`** | Helpers for GraphQL documents and typed responses |
| **`@unireq/imap`** | IMAP transport via `imapflow` (XOAUTH2 ready) |
| **`@unireq/ftp`** | FTP/S transport via `basic-ftp` |
| **`@unireq/presets`** | Opinionated bundles (e.g., `httpsJsonAuthSmart()`) built from the above |

Each package stays focused: transports expose capability flags (`ctx.capabilities.http`, `imap`, …); higher-level policies read those flags to ensure they only run when the transport supports the feature set.

> **Looking for hands-on code?** Jump back to the [Quick Start](guide/quick-start.md) for a guided walkthrough, then return here when you need to understand where each feature lives. For deeper rules about policy ordering, see [Composition](concepts/composition.md).

## Layered view

```
┌───────────────────────────────┐
│  Apps / presets (@unireq/presets) │  ← ready-made clients
├───────────────────────────────┤
│  Policies (oauth, cookies, xml) │  ← auth, parsing, observability
├───────────────────────────────┤
│  Core pipeline (@unireq/core)    │  ← compose, retry, slots, telemetry
├───────────────────────────────┤
│  Transports (http, http2, imap)  │  ← actual I/O + connectors
└───────────────────────────────┘
```

- **Transports** encapsulate real network stacks (Undici, `node:http2`, `imapflow`, `basic-ftp`). They surface capabilities so policies can gate behavior (`if (!ctx.capabilities.http) throw new Error('HTTP-only policy');`).
- **Core** provides deterministic composition, contextual slots (for trace IDs, metrics), async error types, and resilience primitives (`retry`, `backoff`, `timeout`).
- **Policies** stay side-effect free: they describe desired headers, parsing rules, caching, etc. Because they receive `{ ctx, next }`, they can short-circuit, branch (`either`), or fan out observers (`interceptRequest`).
- **Presets** simply call `client(transport, ...policies)` to ship batteries-included clients. You can inspect them in [packages/presets/src](../packages/presets/src) and clone the setup into your own codebase.

## Dependency flow

- High-level packages depend on `@unireq/core` plus whichever transports/policies they wrap. There are **no** circular dependencies; transports never import higher layers.
- All optional integrations (`oauth`, `cookies`, `xml`, `graphql`) are tree-shakeable because they expose plain functions and re-export types.
- Examples and docs mirror the same layering: any snippet from `/examples` can be pasted inside `docs` without extra glue.

## Writing custom policies

```ts
import { policy } from '@unireq/core';

export const trace = policy(async (ctx, next) => {
  const start = performance.now();
  const response = await next({
    ...ctx,
    headers: { ...ctx.headers, 'traceparent': ctx.slots.traceId },
  });
  console.log('elapsed', performance.now() - start);
  return response;
}, { name: 'trace', kind: 'observability' });
```

Guidelines:

1. **Stay pure** – policies describe transformations, they should not mutate shared state outside their closure.
2. **Use metadata** – the optional second argument (`{ name, kind }`) feeds developer tooling and inspector UIs.
3. **Respect order** – place observability outside, resilience next, auth near the transport, parsing last (see [composition](../concepts/composition.md)).

## Repository map

- `packages/*/src` → source for each publishable package (all TypeScript, bundled via `tsup`).
- `examples/*.ts` → runnable scripts that exercise transports/policies exactly as documented.
- `docs/` → Docsify site (mirrors `docs/fr` for French localization).
- `scripts/` → shared tooling (sidebar validator, example runner).

Understanding this layout helps answer “where does this feature live?” quickly and keeps contributions consistent.

## Design Philosophy

Unireq is built on a pipe-first, composable architecture. Instead of a monolithic client with many configuration options, functionality is built up by composing small, focused policies.

This approach offers several benefits:

- **Tree-shakeable**: You only import and bundle the code you actually use.
- **Flexible**: Policies can be reordered and combined in powerful ways.
- **Extensible**: It's easy to write custom policies that integrate seamlessly.
- **Testable**: Individual policies are easier to test in isolation.

Most importantly, **ordering is explicit**. Instead of magical configuration flags, every feature is just a policy in the onion stack. If something needs to happen earlier/later, you move it in the array.

---

<p align="center">
  <a href="#/guide/quick-start">← Quick Start</a> · <a href="#/tutorials/getting-started">Getting Started →</a>
</p>