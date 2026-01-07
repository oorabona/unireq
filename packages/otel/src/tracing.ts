/**
 * OpenTelemetry tracing policy for unireq
 *
 * Creates spans for HTTP requests following OpenTelemetry semantic conventions.
 * Propagates trace context via W3C Trace Context headers.
 */

import type { Context, Tracer } from '@opentelemetry/api';
import type { Policy, RequestContext, Response } from '@unireq/core';

// Use stable semantic convention attribute names (as of 1.28.0)
// These are the stable HTTP client span attribute names per OpenTelemetry spec
const ATTR_HTTP_REQUEST_METHOD = 'http.request.method';
const ATTR_URL_FULL = 'url.full';
const ATTR_HTTP_RESPONSE_STATUS_CODE = 'http.response.status_code';
const ATTR_SERVER_ADDRESS = 'server.address';
const ATTR_SERVER_PORT = 'server.port';
const ATTR_ERROR_TYPE = 'error.type';
const ATTR_HTTP_REQUEST_BODY_SIZE = 'http.request.body.size';
const ATTR_HTTP_RESPONSE_BODY_SIZE = 'http.response.body.size';

/**
 * Function to format span names
 */
export type SpanNameFormatter = (ctx: RequestContext) => string;

/**
 * Configuration options for OpenTelemetry tracing
 */
export interface OtelOptions {
  /**
   * OpenTelemetry tracer instance
   */
  readonly tracer: Tracer;

  /**
   * Custom span name formatter
   * @default (ctx) => `HTTP ${ctx.method}`
   */
  readonly spanNameFormatter?: SpanNameFormatter;

  /**
   * Record request body size in span attributes
   * @default false
   */
  readonly recordRequestBodySize?: boolean;

  /**
   * Record response body size in span attributes
   * @default false
   */
  readonly recordResponseBodySize?: boolean;

  /**
   * Custom attributes to add to every span
   */
  readonly customAttributes?: Record<string, string | number | boolean>;

  /**
   * Propagate trace context to downstream services
   * @default true
   */
  readonly propagateContext?: boolean;
}

/**
 * Default span name formatter
 */
const defaultSpanNameFormatter: SpanNameFormatter = (ctx) => `HTTP ${ctx.method}`;

/**
 * Parse URL to extract host and port
 */
function parseUrl(url: string): { host: string; port: number | undefined; protocol: string } {
  try {
    const parsed = new URL(url);
    /* v8 ignore next -- @preserve ternary branch: https tests use http mock server */
    const defaultPort = parsed.protocol === 'https:' ? 443 : 80;
    const port = parsed.port ? Number.parseInt(parsed.port, 10) : defaultPort;
    return {
      host: parsed.hostname,
      port,
      protocol: parsed.protocol.replace(':', ''),
    };
  } catch {
    return { host: 'unknown', port: undefined, protocol: 'http' };
  }
}

/**
 * Calculate body size for various body types
 */
function calculateBodySize(body: unknown): number | undefined {
  /* v8 ignore next -- @preserve defensive: body is checked before calling this function */
  if (!body) return undefined;

  if (typeof body === 'string') {
    return new TextEncoder().encode(body).length;
  }

  if (body instanceof ArrayBuffer) {
    return body.byteLength;
  }

  if (body instanceof Uint8Array) {
    return body.length;
  }

  if (typeof body === 'object') {
    try {
      return new TextEncoder().encode(JSON.stringify(body)).length;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

/**
 * Create an OpenTelemetry tracing policy
 *
 * @example
 * ```typescript
 * import { client } from '@unireq/core';
 * import { http } from '@unireq/http';
 * import { otel } from '@unireq/otel';
 * import { trace } from '@opentelemetry/api';
 *
 * const tracer = trace.getTracer('my-service', '1.0.0');
 *
 * const api = client(
 *   http('https://api.example.com'),
 *   otel({
 *     tracer,
 *     spanNameFormatter: (ctx) => `${ctx.method} ${new URL(ctx.url).pathname}`,
 *     customAttributes: { 'service.version': '1.0.0' },
 *   }),
 *   parse.json()
 * );
 * ```
 */
export function otel(options: OtelOptions): Policy {
  const {
    tracer,
    spanNameFormatter = defaultSpanNameFormatter,
    recordRequestBodySize = false,
    recordResponseBodySize = false,
    customAttributes = {},
    propagateContext = true,
  } = options;

  // Lazy import to avoid issues when OpenTelemetry is not available
  let api: typeof import('@opentelemetry/api') | undefined;
  let contextApi: { active: () => Context } | undefined;
  let propagation: { inject: (context: Context, carrier: Record<string, string>) => void } | undefined;

  return async (ctx: RequestContext, next): Promise<Response> => {
    // Lazy load OpenTelemetry API
    if (!api) {
      try {
        api = await import('@opentelemetry/api');
        contextApi = api.context;
        propagation = api.propagation;
      } catch {
        /* v8 ignore next 2 -- @preserve fallback when @opentelemetry/api is not installed */
        return next(ctx);
      }
    }

    const { host, port } = parseUrl(ctx.url);
    const spanName = spanNameFormatter(ctx);

    // Create span with HTTP client kind
    const span = tracer.startSpan(spanName, {
      kind: api.SpanKind.CLIENT,
      attributes: {
        [ATTR_HTTP_REQUEST_METHOD]: ctx.method,
        [ATTR_URL_FULL]: ctx.url,
        [ATTR_SERVER_ADDRESS]: host,
        ...(port !== undefined && { [ATTR_SERVER_PORT]: port }),
        ...customAttributes,
      },
    });

    // Record request body size if enabled
    if (recordRequestBodySize && ctx.body) {
      const size = calculateBodySize(ctx.body);
      /* v8 ignore next 3 -- @preserve defensive: size can be undefined for exotic body types */
      if (size !== undefined) {
        span.setAttribute(ATTR_HTTP_REQUEST_BODY_SIZE, size);
      }
    }

    // Inject trace context into request headers
    const headers = { ...ctx.headers };
    if (propagateContext && propagation && contextApi) {
      const activeContext = contextApi.active();
      propagation.inject(api.trace.setSpan(activeContext, span), headers);
    }

    const enrichedCtx: RequestContext = {
      ...ctx,
      headers,
    };

    try {
      const response = await next(enrichedCtx);

      // Record response attributes
      span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, response.status);

      // Record response body size if enabled
      if (recordResponseBodySize && response.data) {
        const size = calculateBodySize(response.data);
        /* v8 ignore next 3 -- @preserve defensive: size can be undefined for exotic body types */
        if (size !== undefined) {
          span.setAttribute(ATTR_HTTP_RESPONSE_BODY_SIZE, size);
        }
      }

      // Set span status based on response
      if (response.status >= 400) {
        span.setStatus({
          code: api.SpanStatusCode.ERROR,
          message: `HTTP ${response.status} ${response.statusText}`,
        });
        span.setAttribute(ATTR_ERROR_TYPE, `${response.status}`);
      } else {
        span.setStatus({ code: api.SpanStatusCode.OK });
      }

      return response;
    } catch (error) {
      // Record error
      span.setStatus({
        code: api.SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof Error) {
        span.recordException(error);
        span.setAttribute(ATTR_ERROR_TYPE, error.name);
      }

      throw error;
    } finally {
      span.end();
    }
  };
}
