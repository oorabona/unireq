# @unireq/http2

Dedicated HTTP/2 transport powered by Node's `http2` module. Use it when you need strict HTTP/2 semantics (multiplexing, server push experiments, explicit ALPN) instead of the default Undici-based HTTP/1.1 transport.

## Installation

```bash
pnpm add @unireq/http2
```

## Export overview

| Export | Description |
| --- | --- |
| `http2(uri?, connector?)` | Returns a `TransportWithCapabilities` (`streams`, `http2`, `serverPush`). Optional base `uri` pre-establishes a session for relative paths. |
| `Http2Connector` | Default connector backed by `node:http2`, handles ALPN negotiation, session caching, and graceful teardown. |
| `Http2ConnectorOptions` | `{ enablePush?: boolean; sessionTimeout?: number }`. Today `enablePush` is reserved for future push handling; `sessionTimeout` controls idle session cleanup. |

## Minimal client

```ts
import { client, retry, backoff } from '@unireq/core';
import { http2, Http2Connector } from '@unireq/http2';

const h2 = client(
  http2('https://h2.example.com', new Http2Connector({ sessionTimeout: 45_000 })),
  retry(undefined, [backoff()], { tries: 3 })
);

const resp = await h2.get('/products'); // Relative path joins with the base URI
```

- If you omit the base `uri`, call the client with absolute URLs so the connector can derive the origin.
- The first request lazily establishes a session; subsequent requests reuse it until the server sends `GOAWAY` or the timeout elapses.

## How URLs are resolved

- When you pass `http2('https://api.example.com')`, every request whose URL starts with `/` is prefixed with that base. Passing a fully qualified URL (e.g., `https://other.example.com/foo`) skips the base and creates a new session for that origin.
- Without a base URI, all URLs must be absolute because the transport cannot infer the host.

## Custom connectors

Bring your own connector when you need custom TLS settings, connection pooling, or instrumentation:

```ts
class InstrumentedConnector extends Http2Connector {
  async request(client, ctx) {
    const start = performance.now();
    try {
      return await super.request(client, ctx);
    } finally {
      metrics.timing('http2.duration', performance.now() - start, { method: ctx.method });
    }
  }
}

const api = client(http2('https://api.internal', new InstrumentedConnector()));
```

Connectors must implement the `Connector` interface (`connect()`, `request()`, optional `disconnect()`), which lets you plug in alternative session managers (for example, nghttp2 bindings or a proxy).

## Server push & streaming

- The transport exposes the `streams: true` capability so downstream policies (e.g., streaming body parsers) know they can operate on chunked data.
- Server push is negotiated at the HTTP/2 level, but the default connector currently ignores PUSH_PROMISE frames. If you need push, extend the connector and handle `session.on('stream', handler)` yourself.

## Error handling

- Connection failures, GOAWAY frames, and request timeouts bubble up as rejected promises; wrap the transport with `retry`/`backoff` if you need resilience.
- The connector automatically removes broken sessions from its cache so retries build a new session. You can call `connector.disconnect()` (or keep a reference to `Http2Connector`) during shutdown to close all sessions.
- Responses include `ok`, `status`, `headers`, and a best-effort `data` parsing step: JSON for `application/json`, string for `text/*`, otherwise an `ArrayBuffer` slice so binary payloads stay intact.

---

<p align="center">
  <a href="#/packages/http">← HTTP</a> · <a href="#/packages/oauth">OAuth →</a>
</p>