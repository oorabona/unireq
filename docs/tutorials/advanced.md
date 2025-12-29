# Advanced Usage

This guide covers advanced patterns and techniques for building robust applications with Unireq.

## Table of Contents

- [Custom Policies](#custom-policies)
- [Error Handling Patterns](#error-handling-patterns)
- [TypeScript Best Practices](#typescript-best-practices)
- [Debugging with Inspect](#debugging-with-inspect)
- [Testing Strategies](#testing-strategies)
- [Performance Patterns](#performance-patterns)
- [Real-World Architectures](#real-world-architectures)

---

## Custom Policies

Policies are the core extensibility mechanism in Unireq. A policy is a function that wraps the request/response cycle.

### Basic Policy Structure

```typescript
import { Policy, policy } from '@unireq/core';

// Simple policy using the policy() wrapper for metadata
const timing = policy(
  async (ctx, next) => {
    const start = Date.now();
    const response = await next(ctx);
    const duration = Date.now() - start;

    console.log(`${ctx.method} ${ctx.url} took ${duration}ms`);
    return response;
  },
  { name: 'timing', kind: 'interceptor' }
);
```

### Request Modification

```typescript
const addCorrelationId = policy(
  async (ctx, next) => {
    const correlationId = crypto.randomUUID();

    return next({
      ...ctx,
      headers: {
        ...ctx.headers,
        'X-Correlation-ID': correlationId,
      },
    });
  },
  { name: 'correlationId', kind: 'interceptor' }
);
```

### Response Transformation

```typescript
const unwrapData = policy(
  async (ctx, next) => {
    const response = await next(ctx);

    // Unwrap common API envelope pattern
    if (response.data?.data) {
      return { ...response, data: response.data.data };
    }
    return response;
  },
  { name: 'unwrapData', kind: 'transformer' }
);
```

### Conditional Policies

```typescript
import { either, match } from '@unireq/core';

// Binary condition
const conditionalParser = either(
  (ctx) => ctx.headers.accept?.includes('application/xml'),
  parseXml(),
  parse.json()
);

// Multiple conditions with match()
const protocolRouter = match(
  [(ctx) => ctx.url.startsWith('ftp://'), ftpTransport()],
  [(ctx) => ctx.url.startsWith('sftp://'), sftpTransport()],
  [() => true, httpTransport()] // default
);
```

### Composable Policy Bundles

```typescript
import { compose } from '@unireq/core';

// Bundle related policies together
const securityBundle = compose(
  oauthBearer({ tokenSupplier }),
  headers({ 'X-Request-ID': () => crypto.randomUUID() }),
  interceptRequest((ctx) => {
    // Sanitize sensitive data in logs
    return ctx;
  })
);

// Use in client
const api = client(
  http('https://api.example.com'),
  securityBundle,
  parse.json()
);
```

---

## Error Handling Patterns

Unireq does not throw on non-2xx responses by default. Here are patterns for handling errors gracefully.

### Pattern 1: Check Response Status

```typescript
const response = await api.get('/users/123');

if (!response.ok) {
  switch (response.status) {
    case 404:
      return null; // Not found is often expected
    case 401:
      await refreshAuth();
      return api.get('/users/123'); // Retry
    case 429:
      throw new RateLimitError(response.headers['retry-after']);
    default:
      throw new ApiError(response.status, response.data);
  }
}

return response.data;
```

### Pattern 2: Result Type (Either Pattern)

```typescript
import { Either, left, right } from '@unireq/core';

type ApiResult<T> = Either<ApiError, T>;

async function fetchUser(id: string): Promise<ApiResult<User>> {
  const response = await api.get<User>(`/users/${id}`);

  if (!response.ok) {
    return left(new ApiError(response.status, response.data));
  }

  return right(response.data);
}

// Usage
const result = await fetchUser('123');

result.match({
  left: (error) => console.error('Failed:', error.message),
  right: (user) => console.log('User:', user.name),
});
```

### Pattern 3: Throw-on-Error Policy

```typescript
import { policy, HttpError } from '@unireq/core';

const throwOnError = policy(
  async (ctx, next) => {
    const response = await next(ctx);

    if (!response.ok) {
      const error = new HttpError(response.status, response.statusText);
      error.response = response;
      throw error;
    }

    return response;
  },
  { name: 'throwOnError', kind: 'guard' }
);

// Now behaves like axios
const api = client(http('...'), throwOnError, parse.json());

try {
  const data = await api.get('/users');
} catch (error) {
  if (isHttpError(error)) {
    console.log(error.response.status);
  }
}
```

### Pattern 4: Domain-Specific Errors

```typescript
class UserNotFoundError extends Error {
  constructor(public userId: string) {
    super(`User ${userId} not found`);
    this.name = 'UserNotFoundError';
  }
}

class ValidationError extends Error {
  constructor(public errors: Record<string, string[]>) {
    super('Validation failed');
    this.name = 'ValidationError';
  }
}

async function getUser(id: string): Promise<User> {
  const response = await api.get<User>(`/users/${id}`);

  if (response.status === 404) {
    throw new UserNotFoundError(id);
  }

  if (response.status === 422) {
    throw new ValidationError(response.data.errors);
  }

  if (!response.ok) {
    throw new Error(`Unexpected error: ${response.status}`);
  }

  return response.data;
}
```

---

## TypeScript Best Practices

### Typed Response Data

```typescript
interface User {
  id: number;
  email: string;
  name: string;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    perPage: number;
  };
}

// Type the response
const response = await api.get<PaginatedResponse<User>>('/users');

// response.data is now PaginatedResponse<User>
console.log(response.data.meta.total);
```

### Runtime Validation with Zod

```typescript
import { z } from 'zod';
import { validate } from '@unireq/core';

const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string().min(1),
  createdAt: z.string().datetime(),
});

type User = z.infer<typeof UserSchema>;

const zodAdapter = {
  validate: <T>(schema: z.ZodType<T>, data: unknown) => schema.parse(data),
};

const api = client(
  http('https://api.example.com'),
  parse.json(),
  validate(UserSchema, zodAdapter)
);

// response.data is validated at runtime AND typed at compile time
const response = await api.get<User>('/users/1');
```

### Generic API Client Factory

```typescript
function createTypedClient<TBase extends string>(baseUrl: TBase) {
  const api = client(
    http(baseUrl),
    oauthBearer({ tokenSupplier }),
    parse.json()
  );

  return {
    get: <T>(path: string) => api.get<T>(path),
    post: <T, B>(path: string, body: B) => api.post<T>(path, body.json(body)),
    put: <T, B>(path: string, body: B) => api.put<T>(path, body.json(body)),
    delete: <T>(path: string) => api.delete<T>(path),
  };
}

const userApi = createTypedClient('https://users.api.example.com');
const orderApi = createTypedClient('https://orders.api.example.com');
```

---

## Debugging with Inspect

The `inspect()` function provides deep visibility into your client configuration.

### Viewing the Policy Graph

```typescript
import { client, inspect } from '@unireq/core';
import { http, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  retry(httpRetryPredicate(), [backoff()], { tries: 3 }),
  oauthBearer({ tokenSupplier }),
  parse.json()
);

// Get a structured representation of the policy chain
const graph = inspect(api);

console.log(JSON.stringify(graph, null, 2));
// {
//   "type": "client",
//   "transport": { "name": "http", "baseUrl": "https://api.example.com" },
//   "policies": [
//     { "name": "retry", "options": { "tries": 3 } },
//     { "name": "oauthBearer", "kind": "auth" },
//     { "name": "json-parser", "kind": "parser" }
//   ]
// }
```

### Runtime Assertions

```typescript
import { assertHas } from '@unireq/core';

// Ensure the client has required policies before making requests
function ensureSecureClient(client: Client) {
  assertHas(client, 'auth');  // Has some auth policy
  assertHas(client, 'retry'); // Has retry configured
}

ensureSecureClient(api); // Throws if missing required policies
```

### Structured Logging

```typescript
import { log } from '@unireq/core';

const api = client(
  http('https://api.example.com'),
  log({
    logger: {
      debug: (msg, meta) => console.debug(msg, meta),
      info: (msg, meta) => console.info(msg, meta),
      warn: (msg, meta) => console.warn(msg, meta),
      error: (msg, meta) => console.error(msg, meta),
    },
    redactHeaders: ['authorization', 'x-api-key'],
    includeBody: process.env.NODE_ENV === 'development',
  }),
  parse.json()
);
```

---

## Testing Strategies

### Unit Testing with MSW

```typescript
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { beforeAll, afterEach, afterAll, it, expect } from 'vitest';

const server = setupServer(
  http.get('https://api.example.com/users', () => {
    return HttpResponse.json([{ id: 1, name: 'Alice' }]);
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it('fetches users', async () => {
  const api = client(http('https://api.example.com'), parse.json());

  const response = await api.get('/users');

  expect(response.status).toBe(200);
  expect(response.data).toEqual([{ id: 1, name: 'Alice' }]);
});
```

### Testing Retry Logic

```typescript
it('retries on 503', async () => {
  let attempts = 0;

  server.use(
    http.get('https://api.example.com/flaky', () => {
      attempts++;
      if (attempts < 3) {
        return HttpResponse.json({ error: 'Unavailable' }, { status: 503 });
      }
      return HttpResponse.json({ success: true });
    })
  );

  const api = client(
    http('https://api.example.com'),
    retry(httpRetryPredicate(), [backoff({ initial: 10 })], { tries: 5 }),
    parse.json()
  );

  const response = await api.get('/flaky');

  expect(attempts).toBe(3);
  expect(response.data).toEqual({ success: true });
});
```

### Testing OAuth Token Refresh

```typescript
it('refreshes token on 401', async () => {
  let tokenVersion = 1;

  server.use(
    http.get('https://api.example.com/protected', ({ request }) => {
      const auth = request.headers.get('Authorization');
      if (auth === 'Bearer old-token') {
        return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return HttpResponse.json({ secret: 'data' });
    })
  );

  const api = client(
    http('https://api.example.com'),
    oauthBearer({
      tokenSupplier: () => tokenVersion === 1 ? 'old-token' : 'new-token',
      onRefresh: async () => { tokenVersion++; },
      allowUnsafeMode: true,
    }),
    parse.json()
  );

  const response = await api.get('/protected');

  expect(response.data).toEqual({ secret: 'data' });
  expect(tokenVersion).toBe(2);
});
```

---

## Performance Patterns

### Connection Pooling

```typescript
import { UndiciConnector } from '@unireq/http';

const connector = new UndiciConnector({
  connections: 100,      // Max connections per origin
  pipelining: 10,        // HTTP/1.1 pipelining depth
  keepAliveTimeout: 30000,
});

const api = client(
  http('https://api.example.com', { connector }),
  parse.json()
);
```

### Request Deduplication

```typescript
import { dedupe } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  dedupe({
    ttl: 100,           // Dedupe window in ms
    methods: ['GET'],   // Only dedupe safe methods
  }),
  parse.json()
);

// These 3 requests result in only 1 network call
const [r1, r2, r3] = await Promise.all([
  api.get('/users'),
  api.get('/users'),
  api.get('/users'),
]);
```

### HTTP/2 Multiplexing

```typescript
import { http2 } from '@unireq/http2';

const api = client(http2('https://api.example.com'), parse.json());

// All requests share a single connection
await Promise.all([
  api.get('/resource1'),
  api.get('/resource2'),
  api.get('/resource3'),
]);
```

---

## Real-World Architectures

### Service Layer Pattern

```typescript
// services/api.ts
import { client, retry, backoff } from '@unireq/core';
import { http, httpRetryPredicate, parse } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

export const api = client(
  http(process.env.API_URL!),
  retry(httpRetryPredicate(), [backoff()], { tries: 3 }),
  oauthBearer({ tokenSupplier: () => getToken() }),
  parse.json()
);

// services/users.ts
import { api } from './api';

export const userService = {
  async getById(id: string): Promise<User | null> {
    const response = await api.get<User>(`/users/${id}`);
    return response.ok ? response.data : null;
  },

  async create(data: CreateUserDto): Promise<User> {
    const response = await api.post<User>('/users', body.json(data));
    if (!response.ok) throw new ApiError(response);
    return response.data;
  },

  async update(id: string, data: UpdateUserDto): Promise<User> {
    const response = await api.put<User>(`/users/${id}`, body.json(data));
    if (!response.ok) throw new ApiError(response);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    const response = await api.delete(`/users/${id}`);
    if (!response.ok) throw new ApiError(response);
  },
};
```

### Multi-Tenant API Client

```typescript
function createTenantClient(tenantId: string) {
  return client(
    http(process.env.API_URL!),
    headers({ 'X-Tenant-ID': tenantId }),
    oauthBearer({ tokenSupplier: () => getTenantToken(tenantId) }),
    log({ context: { tenantId } }),
    parse.json()
  );
}

// Usage
const acmeApi = createTenantClient('acme-corp');
const globexApi = createTenantClient('globex-inc');
```

### Microservice Communication

```typescript
// Shared client configuration
const internalClient = (serviceName: string) => client(
  http(`http://${serviceName}.internal:8080`),
  headers({
    'X-Service-Name': 'my-service',
    'X-Request-ID': () => getRequestContext().requestId,
  }),
  circuitBreaker({
    threshold: 5,
    resetTimeout: 30000,
  }),
  retry(httpRetryPredicate(), [backoff({ initial: 100 })], { tries: 2 }),
  parse.json()
);

// Service clients
export const userService = internalClient('user-service');
export const orderService = internalClient('order-service');
export const paymentService = internalClient('payment-service');
```

---

## Next Steps

- **[Composition Deep Dive](concepts/composition.md)** — Policy ordering and branching
- **[Testing Guide](guides/testing.md)** — Complete testing strategies with MSW
- **[Performance Guide](guides/performance.md)** — Optimization techniques
- **[Custom Connectors](guides/custom-connectors.md)** — BYOC pattern implementation

---

<p align="center">
  <a href="#/tutorials/getting-started">← Getting Started</a> · <a href="#/concepts/composition">Composition →</a>
</p>
