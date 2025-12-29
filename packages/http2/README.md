# @unireq/http2

[![npm version](https://img.shields.io/npm/v/@unireq/http2.svg)](https://www.npmjs.com/package/@unireq/http2)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Dedicated HTTP/2 transport powered by Node's `http2` module. Use it when you need strict HTTP/2 semantics (multiplexing, server push, explicit ALPN) instead of the default Undici-based HTTP/1.1 transport.

## Installation

```bash
pnpm add @unireq/http2
```

## Quick Start

```typescript
import { client, retry, backoff } from '@unireq/core';
import { http2, Http2Connector } from '@unireq/http2';

const h2 = client(
  http2('https://h2.example.com', new Http2Connector({ sessionTimeout: 45_000 })),
  retry(undefined, [backoff()], { tries: 3 }),
);

const resp = await h2.get('/products');
```

## Features

| Export | Description |
| --- | --- |
| `http2(uri?, connector?)` | Returns a transport with `streams`, `http2`, `serverPush` capabilities |
| `Http2Connector` | Default connector with ALPN negotiation, session caching, graceful teardown |
| `Http2ConnectorOptions` | `{ enablePush?, sessionTimeout? }` configuration |

## URL Resolution

- Pass `http2('https://api.example.com')` to prefix relative paths with the base
- Without a base URI, all URLs must be absolute
- The first request lazily establishes a session; subsequent requests reuse it

## Custom Connectors

```typescript
class InstrumentedConnector extends Http2Connector {
  async request(client, ctx) {
    const start = performance.now();
    try {
      return await super.request(client, ctx);
    } finally {
      metrics.timing('http2.duration', performance.now() - start);
    }
  }
}

const api = client(http2('https://api.internal', new InstrumentedConnector()));
```

## Error Handling

- Connection failures, GOAWAY frames, and request timeouts bubble up as rejected promises
- Wrap the transport with `retry`/`backoff` for resilience
- The connector automatically removes broken sessions from cache

## Documentation

Full documentation available at [unireq.dev](https://oorabona.github.io/unireq/)

## License

MIT
