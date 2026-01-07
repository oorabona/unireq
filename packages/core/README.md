# @unireq/core

[![npm version](https://img.shields.io/npm/v/@unireq/core.svg)](https://www.npmjs.com/package/@unireq/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The core package provides the foundational building blocks for the Unireq ecosystem: client creation, policy composition, flow-control primitives, introspection, validation, and the DX-focused error catalog.

## Installation

```bash
pnpm add @unireq/core
```

## Quick Start

```typescript
import { client, retry, backoff } from '@unireq/core';
import { http, headers, timeout, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  headers({ 'x-api-key': 'secret' }),
  timeout(10_000),
  retry(httpRetryPredicate(), [backoff()], { tries: 3 }),
  parse.json(),
);

const user = await api.get('/users/42');
```

## Features

| Category | Symbols | Purpose |
| --- | --- | --- |
| Client factory | `client`, `Policy`, `Transport` | Create clients by composing transports + policies |
| Composition | `compose`, `either`, `match`, `policy`, `slot` | Build reusable middleware stacks |
| Flow control | `retry`, `backoff`, `circuitBreaker`, `throttle` | Resilience with retries, backoff, circuit breaking |
| Introspection | `inspect`, `inspectable`, `getHandlerGraph`, `log` | Trace policy graphs and structured logging |
| Validation | `validate`, `ValidationAdapter` | Guarantee typed responses with any schema library |
| Errors | `HttpError`, `TimeoutError`, `NetworkError` | Consistent error surface |

## Policy Composition

```typescript
import { compose, either } from '@unireq/core';
import { parse } from '@unireq/http';
import { xml } from '@unireq/xml';

const smartParser = compose(
  either(
    (ctx) => ctx.headers.accept?.includes('application/json') ?? false,
    parse.json(),
    xml(),
  ),
);
```

## Validation with Zod

```typescript
import { client, validate } from '@unireq/core';
import { http, parse } from '@unireq/http';
import { z } from 'zod';

const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
});

const zodAdapter = {
  validate: (schema, data) => schema.parse(data),
};

const api = client(
  http('https://api.example.com'),
  parse.json(),
  validate(UserSchema, zodAdapter),
);
```

## Error Handling

Every error extends `UnireqError` with a stable `code` string:

- `NetworkError` - DNS failures, connection resets, TLS issues
- `TimeoutError` - Request timeout exceeded
- `HttpError` - HTTP error responses
- `SerializationError` - Body parsing/encoding issues
- `DuplicatePolicyError` - Slot conflicts
- `MissingCapabilityError` - Transport lacks required capability

## Header Utilities

Convert between `Record<string, string>` and native `Headers`:

```typescript
import { toNativeHeaders, fromNativeHeaders } from '@unireq/core';

const nativeHeaders = toNativeHeaders({ 'content-type': 'application/json' });
const record = fromNativeHeaders(response.headers);
```

## Documentation

Full documentation available at [unireq.dev](https://oorabona.github.io/unireq/)

## License

MIT
