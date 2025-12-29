# @unireq/otel

OpenTelemetry instrumentation for unireq HTTP clients. Provides automatic tracing with W3C Trace Context propagation following OpenTelemetry semantic conventions.

## Installation

```bash
pnpm add @unireq/otel

# Peer dependencies
pnpm add @opentelemetry/api @opentelemetry/semantic-conventions
```

## Export Overview

| Category | Symbols | Purpose |
| --- | --- | --- |
| Policy | `otel(options)` | Creates a tracing policy that wraps HTTP requests in spans. |
| Types | `OtelOptions`, `SpanNameFormatter` | Configuration and customization interfaces. |

## Quick Start

```typescript
import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';
import { otel } from '@unireq/otel';
import { trace } from '@opentelemetry/api';

// Get a tracer from your OpenTelemetry setup
const tracer = trace.getTracer('my-service', '1.0.0');

// Create a traced client
const api = client(
  http('https://api.example.com'),
  otel({ tracer }),
  parse.json()
);

// All requests will now create spans
const response = await api.get('/users');
```

## Configuration Options

```typescript
interface OtelOptions {
  /** OpenTelemetry tracer instance (required) */
  readonly tracer: Tracer;

  /** Custom span name formatter (default: `HTTP ${method}`) */
  readonly spanNameFormatter?: (ctx: RequestContext) => string;

  /** Record request body size in span attributes (default: false) */
  readonly recordRequestBodySize?: boolean;

  /** Record response body size in span attributes (default: false) */
  readonly recordResponseBodySize?: boolean;

  /** Custom attributes to add to every span */
  readonly customAttributes?: Record<string, string | number | boolean>;

  /** Propagate trace context to downstream services (default: true) */
  readonly propagateContext?: boolean;
}
```

## Span Attributes

The policy sets the following OpenTelemetry semantic convention attributes:

| Attribute | Description |
| --- | --- |
| `http.request.method` | HTTP method (GET, POST, etc.) |
| `url.full` | Full request URL |
| `server.address` | Server hostname |
| `server.port` | Server port |
| `http.response.status_code` | Response status code |
| `http.request.body.size` | Request body size (if enabled) |
| `http.response.body.size` | Response body size (if enabled) |
| `error.type` | Error type on failure |

## Custom Span Names

```typescript
const api = client(
  http('https://api.example.com'),
  otel({
    tracer,
    spanNameFormatter: (ctx) => {
      const path = new URL(ctx.url).pathname;
      return `${ctx.method} ${path}`;
    },
  }),
  parse.json()
);

// Spans will be named like "GET /users/123"
```

## Adding Custom Attributes

```typescript
const api = client(
  http('https://api.example.com'),
  otel({
    tracer,
    customAttributes: {
      'service.name': 'user-service',
      'service.version': '1.0.0',
      'deployment.environment': 'production',
    },
  }),
  parse.json()
);
```

## Body Size Recording

For debugging or performance analysis, enable body size recording:

```typescript
const api = client(
  http('https://api.example.com'),
  otel({
    tracer,
    recordRequestBodySize: true,
    recordResponseBodySize: true,
  }),
  parse.json()
);
```

> **Note**: Body size calculation may have performance implications for large payloads.

## Trace Context Propagation

By default, W3C Trace Context headers are injected into outgoing requests:

- `traceparent` - Trace ID and span ID
- `tracestate` - Vendor-specific trace data

This enables distributed tracing across services:

```typescript
// Service A
const api = client(
  http('https://service-b.internal'),
  otel({ tracer, propagateContext: true }), // default
  parse.json()
);

// Request to Service B will include trace headers
// Service B can continue the trace
```

To disable propagation:

```typescript
const api = client(
  http('https://external-api.com'),
  otel({ tracer, propagateContext: false }),
  parse.json()
);
```

## Complete Example with SDK Setup

```typescript
import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';
import { otel } from '@unireq/otel';

// OpenTelemetry SDK setup
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { trace } from '@opentelemetry/api';

// Initialize the SDK
const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: 'my-service',
  }),
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  }),
});

sdk.start();

// Get tracer after SDK is started
const tracer = trace.getTracer('my-service', '1.0.0');

// Create instrumented client
const api = client(
  http('https://api.example.com'),
  otel({
    tracer,
    spanNameFormatter: (ctx) => `HTTP ${ctx.method} ${new URL(ctx.url).pathname}`,
    customAttributes: {
      'service.version': '1.0.0',
    },
  }),
  parse.json()
);

// All requests create spans exported to your collector
const users = await api.get('/users');

// Graceful shutdown
process.on('SIGTERM', async () => {
  await sdk.shutdown();
});
```

## Error Handling

Errors are automatically recorded in spans:

- Span status is set to `ERROR`
- Exception is recorded with `span.recordException()`
- `error.type` attribute is set to the error name

```typescript
try {
  await api.get('/failing-endpoint');
} catch (error) {
  // Span already has error info recorded
}
```

## HTTP Status Codes

- **2xx-3xx**: Span status = `OK`
- **4xx-5xx**: Span status = `ERROR`, `error.type` = status code

## Integration with Other Policies

Place `otel()` early in the policy chain to capture the full request lifecycle:

```typescript
const api = client(
  http('https://api.example.com'),
  otel({ tracer }),           // Trace everything below
  retry(...),                 // Retries are included in span
  timeout(5000),              // Timeout is included in span
  parse.json()
);
```

## Lazy Loading

The OpenTelemetry API is lazily imported on first request. If `@opentelemetry/api` is not available, the policy gracefully passes through without tracing.

---

<p align="center">
  <a href="#/packages/presets">&larr; Presets</a> &middot; <a href="#/packages/config">Config &rarr;</a>
</p>
