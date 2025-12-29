/**
 * OpenTelemetry Tracing Example
 *
 * Demonstrates automatic request tracing with OpenTelemetry
 * for observability in distributed systems.
 *
 * Run: pnpm tsx examples/otel-tracing.ts
 */

import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';
import { otel } from '@unireq/otel';

// Mock tracer for demonstration (in real use, use @opentelemetry/sdk-node)
const mockTracer = {
  startSpan: (name: string, options?: { kind?: number; attributes?: Record<string, unknown> }) => {
    console.log(`[SPAN START] ${name}`);
    if (options?.attributes) {
      console.log('  Attributes:', JSON.stringify(options.attributes, null, 2));
    }

    return {
      setAttribute: (key: string, value: unknown) => {
        console.log(`  [ATTR] ${key}: ${value}`);
      },
      setStatus: (status: { code: number; message?: string }) => {
        console.log(`  [STATUS] ${status.code === 1 ? 'OK' : 'ERROR'}: ${status.message || ''}`);
      },
      recordException: (error: Error) => {
        console.log(`  [EXCEPTION] ${error.message}`);
      },
      end: () => {
        console.log(`[SPAN END] ${name}\n`);
      },
    };
  },
};

async function main() {
  console.log('=== OpenTelemetry Tracing Example ===\n');

  // Create client with OpenTelemetry tracing
  const api = client(
    http('https://jsonplaceholder.typicode.com'),
    otel({
      tracer: mockTracer as never,
      spanNameFormatter: (ctx) => `${ctx.method} ${new URL(ctx.url).pathname}`,
      recordRequestBodySize: true,
      recordResponseBodySize: true,
      customAttributes: {
        'service.name': 'example-service',
        'service.version': '1.0.0',
      },
    }),
    parse.json(),
  );

  // Example 1: Successful GET request
  console.log('--- Example 1: Successful GET ---');
  try {
    const response = await api.get<{ id: number; title: string }>('/posts/1');
    console.log('Response:', { id: response.data.id, title: `${response.data.title.slice(0, 30)}...` });
  } catch (error) {
    console.error('Error:', error);
  }

  // Example 2: POST request with body
  console.log('--- Example 2: POST with Body ---');
  try {
    const response = await api.post<{ id: number }>('/posts', {
      title: 'New Post',
      body: 'This is the post content',
      userId: 1,
    });
    console.log('Created post ID:', response.data.id);
  } catch (error) {
    console.error('Error:', error);
  }

  // Example 3: 404 error (traced with error status)
  console.log('--- Example 3: 404 Error ---');
  try {
    await api.get('/posts/99999999');
  } catch {
    console.log('Caught expected 404 error');
  }

  console.log('\n=== Tracing Example Complete ===');
  console.log('In production, use @opentelemetry/sdk-node with exporters like:');
  console.log('- Jaeger: @opentelemetry/exporter-jaeger');
  console.log('- OTLP: @opentelemetry/exporter-trace-otlp-http');
  console.log('- Zipkin: @opentelemetry/exporter-zipkin');
}

main().catch(console.error);
