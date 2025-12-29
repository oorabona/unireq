# @unireq/otel

[![npm version](https://img.shields.io/npm/v/@unireq/otel.svg)](https://www.npmjs.com/package/@unireq/otel)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

OpenTelemetry instrumentation for Unireq HTTP clients. Automatic tracing with W3C Trace Context propagation following OpenTelemetry semantic conventions.

## Installation

```bash
pnpm add @unireq/otel

# Peer dependencies
pnpm add @opentelemetry/api @opentelemetry/semantic-conventions
```

## Quick Start

```typescript
import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';
import { otel } from '@unireq/otel';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('my-service', '1.0.0');

const api = client(
  http('https://api.example.com'),
  otel({ tracer }),
  parse.json(),
);

// All requests create spans
const response = await api.get('/users');
```

## Features

| Symbol | Description |
| --- | --- |
| `otel(options)` | Creates a tracing policy for HTTP requests |
| `OtelOptions` | Tracer, span name formatter, custom attributes |

## Configuration

```typescript
otel({
  tracer,
  spanNameFormatter: (ctx) => `${ctx.method} ${new URL(ctx.url).pathname}`,
  recordRequestBodySize: true,
  recordResponseBodySize: true,
  customAttributes: {
    'service.name': 'user-service',
    'deployment.environment': 'production',
  },
  propagateContext: true, // W3C Trace Context headers
});
```

## Span Attributes

| Attribute | Description |
| --- | --- |
| `http.request.method` | HTTP method |
| `url.full` | Full request URL |
| `server.address` | Server hostname |
| `http.response.status_code` | Response status |
| `error.type` | Error type on failure |

## Trace Context Propagation

Automatically injects `traceparent` and `tracestate` headers for distributed tracing.

## Documentation

Full documentation available at [unireq.dev](https://oorabona.github.io/unireq/)

## License

MIT
