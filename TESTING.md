# Testing Guide

This document describes the testing architecture, patterns, and best practices for the unireq project.

## Overview

- **Test Framework**: [Vitest](https://vitest.dev/)
- **Coverage Provider**: V8
- **Total Tests**: 54 test files across 12 packages
- **Coverage Threshold**: 100% (lines, functions, branches, statements)

## Running Tests

### Unit Tests

```bash
# Run all unit tests
pnpm -r test

# Run tests for a specific package
pnpm --filter @unireq/core test

# Run tests in watch mode
pnpm --filter @unireq/core test -- --watch

# Run with coverage
pnpm -r test -- --coverage
```

### Integration Tests

```bash
# Run integration tests (requires mock server)
pnpm test:integration
```

### Type Checking

```bash
# Type check all packages
pnpm type-check
```

## Test Structure

Each package follows this structure:

```
packages/
  core/
    src/
      __tests__/
        helpers.ts      # Test utilities (shared)
        client.test.ts  # Unit tests for client.ts
        retry.test.ts   # Unit tests for retry.ts
        ...
```

## Test Helpers Library

The `@unireq/core` package provides a comprehensive test helpers library at `packages/core/src/__tests__/helpers.ts`. Import these utilities in your tests:

```typescript
import {
  createMockContext,
  createMockResponse,
  createMockTransport,
  createFlakyTransport,
  createSequentialTransport,
  createSlowTransport,
  createAbortableTransport,
  createMockLogger,
  createMockStream,
  createErrorStream,
  collectStream,
  createTrackingPolicy,
  createSSEStream,
  waitFor,
} from './helpers.js';
```

### Available Helpers

#### Request/Response Mocks

```typescript
// Create a mock request context
const ctx = createMockContext({
  url: 'https://api.example.com/users',
  method: 'POST',
  body: { name: 'John' },
});

// Create a mock response
const response = createMockResponse({
  status: 201,
  data: { id: 1, name: 'John' },
});
```

#### Transport Mocks

```typescript
// Simple mock transport
const transport = createMockTransport(response);

// Flaky transport (fails N times before succeeding)
const { transport, getAttempts } = createFlakyTransport(
  3,                          // Fail 3 times
  new Error('Connection failed'),
  createMockResponse(),       // Then succeed
);

// Sequential responses
const { transport } = createSequentialTransport([
  new Error('First attempt fails'),
  createMockResponse({ status: 503 }),
  createMockResponse({ status: 200 }),
]);

// Slow transport (for timeout testing)
const transport = createSlowTransport(5000, response);

// Abortable transport (respects AbortSignal)
const transport = createAbortableTransport(1000, response);
```

#### Stream Mocks

```typescript
// Create a mock stream from chunks
const stream = createMockStream([
  new Uint8Array([1, 2, 3]),
  new Uint8Array([4, 5, 6]),
], 10); // 10ms delay between chunks

// Create a stream that errors
const errorStream = createErrorStream(
  [new Uint8Array([1, 2])],
  new Error('Stream interrupted'),
);

// Collect all chunks from a stream
const chunks = await collectStream(stream);

// Create SSE stream
const sseStream = createSSEStream([
  { event: 'message', data: '{"id": 1}' },
  { event: 'update', data: '{"status": "done"}', id: '2' },
]);
```

#### Other Utilities

```typescript
// Mock logger that captures all calls
const logger = createMockLogger();
logger.info('test message', { key: 'value' });
console.log(logger.calls); // [{ level: 'info', message: 'test message', meta: {...} }]

// Policy that tracks execution order
const tracker: string[] = [];
const policy = createTrackingPolicy('auth', tracker);
// After execution: ['auth-before', 'auth-after']

// Wait for async condition
await waitFor(() => someAsyncCondition, 5000, 10);
```

## Writing Tests

### Test Naming Convention

Use descriptive names that explain the behavior:

```typescript
describe('@unireq/core - retry', () => {
  describe('retry policy', () => {
    it('should retry failed requests up to max attempts', async () => {
      // ...
    });

    it('should not retry when predicate returns false', async () => {
      // ...
    });
  });
});
```

### Testing Policies

Policies are middleware functions. Test them by composing with a mock transport:

```typescript
import { client } from '@unireq/core';

it('should add authorization header', async () => {
  let capturedHeaders: Record<string, string> = {};

  const mockTransport = async (ctx: RequestContext) => {
    capturedHeaders = ctx.headers;
    return createMockResponse();
  };

  const api = client(mockTransport, authPolicy());
  await api.get('/test');

  expect(capturedHeaders['Authorization']).toBe('Bearer token');
});
```

### Testing Async Behavior

Use Vitest's fake timers for time-dependent tests:

```typescript
import { vi } from 'vitest';

it('should cache token for TTL duration', async () => {
  vi.useFakeTimers();

  let callCount = 0;
  const supplier = async () => `token-${++callCount}`;
  const cached = tokenWithCache(supplier, 1000);

  await cached(); // First call
  expect(callCount).toBe(1);

  vi.advanceTimersByTime(500);
  await cached(); // Within TTL - cached
  expect(callCount).toBe(1);

  vi.advanceTimersByTime(501);
  await cached(); // After TTL - refresh
  expect(callCount).toBe(2);

  vi.useRealTimers();
});
```

### Testing Error Handling

```typescript
it('should throw on network error', async () => {
  const transport = createMockTransport(() => {
    throw new Error('Network error');
  });

  const api = client(transport);

  await expect(api.get('/test')).rejects.toThrow('Network error');
});
```

### Testing Environment Variables

Use `vi.stubEnv()` for safe environment variable testing:

```typescript
import { vi, afterEach } from 'vitest';

describe('environment-based config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should read token from environment', () => {
    vi.stubEnv('API_TOKEN', 'secret-token');

    const config = loadConfig();
    expect(config.token).toBe('secret-token');
  });

  it('should throw when env var missing', () => {
    vi.stubEnv('API_TOKEN', undefined);

    expect(() => loadConfig()).toThrow('API_TOKEN is not set');
  });
});
```

## Coverage Requirements

The project enforces 100% coverage thresholds:

```typescript
// vitest.config.ts
coverage: {
  thresholds: {
    lines: 100,
    functions: 100,
    branches: 100,
    statements: 100,
  },
}
```

### Exclusions

Some code is excluded from coverage requirements:

- **`src/index.ts`**: Re-export files (tested indirectly)
- **`src/types.ts`**: Type-only files (no executable code)
- **`packages/ftp/src/**`**: FTP protocol (requires real server)
- **`packages/http2/src/**`**: HTTP/2 (requires server setup)
- **`packages/imap/src/**`**: IMAP protocol (requires real server)

## Integration Tests

Integration tests are in `tests/integration/` and run against a mock server.

```typescript
// tests/integration/retry.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { client } from '@unireq/core';
import { http } from '@unireq/http';

describe('Retry integration', () => {
  let server: MockServer;

  beforeAll(async () => {
    server = await startMockServer();
  });

  afterAll(async () => {
    await server.close();
  });

  it('should retry on 503 and succeed', async () => {
    server.respondWith([
      { status: 503 },
      { status: 503 },
      { status: 200, body: { ok: true } },
    ]);

    const api = client(http(server.url), retry(3));
    const result = await api.get('/test');

    expect(result.ok).toBe(true);
    expect(server.requestCount).toBe(3);
  });
});
```

## Mocking Strategies

### Mock External Modules

```typescript
import { vi } from 'vitest';

vi.mock('@opentelemetry/api', () => ({
  SpanKind: { CLIENT: 2 },
  SpanStatusCode: { OK: 1, ERROR: 2 },
  context: { active: vi.fn().mockReturnValue({}) },
  propagation: { inject: vi.fn() },
  trace: { setSpan: vi.fn().mockReturnValue({}) },
}));
```

### Mock Fetch

For tests that need to intercept fetch calls:

```typescript
import { vi, beforeEach, afterEach } from 'vitest';

describe('fetch-based tests', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should call fetch with correct options', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('{}', { status: 200 })
    );

    await someFunction();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.example.com/endpoint',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
```

## Best Practices

1. **Use test helpers**: Don't recreate mocks - use the shared helpers library
2. **Avoid flaky tests**: Use fake timers for time-dependent tests, avoid hardcoded timing assertions
3. **Test edge cases**: Include tests for error paths, empty inputs, and boundary conditions
4. **Keep tests isolated**: Each test should be independent - use `beforeEach` to reset state
5. **Use descriptive names**: Test names should describe the expected behavior
6. **Mock at the right level**: Mock external dependencies, not internal implementation
7. **Prefer `vi.stubEnv` over direct `process.env` manipulation**: Safer and auto-cleanup
8. **Test async properly**: Use `async/await` and proper error assertions

## Common Patterns

### Testing Retry Logic

```typescript
it('should retry with exponential backoff', async () => {
  vi.useFakeTimers();

  const { transport, getAttempts } = createFlakyTransport(2);
  const api = client(transport, retry(3, backoff({ initial: 100, max: 1000 })));

  const promise = api.get('/test');

  // First attempt fails immediately
  await vi.advanceTimersByTimeAsync(0);
  expect(getAttempts()).toBe(1);

  // Wait for first backoff (100ms)
  await vi.advanceTimersByTimeAsync(100);
  expect(getAttempts()).toBe(2);

  // Wait for second backoff (200ms)
  await vi.advanceTimersByTimeAsync(200);
  expect(getAttempts()).toBe(3);

  await promise; // Should succeed now

  vi.useRealTimers();
});
```

### Testing Cancellation

```typescript
it('should abort request when signal is aborted', async () => {
  const controller = new AbortController();
  const transport = createAbortableTransport(1000);
  const api = client(transport);

  const promise = api.get('/test', { signal: controller.signal });

  controller.abort();

  await expect(promise).rejects.toThrow('AbortError');
});
```

### Testing Concurrent Requests

```typescript
it('should handle concurrent requests correctly', async () => {
  const transport = createSlowTransport(50);
  const api = client(transport, dedupe());

  // Start 3 concurrent requests to same endpoint
  const results = await Promise.all([
    api.get('/same-endpoint'),
    api.get('/same-endpoint'),
    api.get('/same-endpoint'),
  ]);

  // All should succeed with same response
  expect(results).toHaveLength(3);
  results.forEach(r => expect(r.status).toBe(200));
});
```

## Debugging Tests

### Run a Single Test

```bash
pnpm --filter @unireq/core test -- --grep "should retry failed requests"
```

### Run with Verbose Output

```bash
pnpm --filter @unireq/core test -- --reporter=verbose
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
  "args": ["run", "--reporter=verbose"],
  "cwd": "${workspaceFolder}/packages/core"
}
```
