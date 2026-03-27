# Testing with MSW

This guide covers testing @unireq clients using [Mock Service Worker (MSW)](https://mswjs.io/).

The project has **4285+ tests across 184 files** covering unit, integration, and security scenarios.

## Setup

### Install MSW

```bash
pnpm add -D msw
```

### Create Handlers

```typescript
// mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('https://api.example.com/users', () => {
    return HttpResponse.json([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ]);
  }),

  http.post('https://api.example.com/users', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 3, ...body }, { status: 201 });
  }),

  http.get('https://api.example.com/error', () => {
    return HttpResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }),
];
```

### Setup Server

```typescript
// mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### Vitest Setup

```typescript
// vitest.setup.ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Basic Tests

### Testing GET Requests

```typescript
import { describe, it, expect } from 'vitest';
import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';

describe('UserAPI', () => {
  const api = client(
    http('https://api.example.com'),
    parse.json()
  );

  it('fetches users', async () => {
    const response = await api.get<{ id: number; name: string }[]>('/users');

    expect(response.status).toBe(200);
    expect(response.data).toHaveLength(2);
    expect(response.data[0].name).toBe('Alice');
  });

  it('creates a user', async () => {
    const response = await api.post<{ id: number; name: string }>('/users', {
      name: 'Charlie',
    });

    expect(response.status).toBe(201);
    expect(response.data.id).toBe(3);
    expect(response.data.name).toBe('Charlie');
  });
});
```

## Testing Retry Logic

```typescript
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './mocks/server';
import { client, retry, backoff } from '@unireq/core';
import { http as httpTransport, httpRetryPredicate, parse } from '@unireq/http';

describe('Retry', () => {
  it('retries on 503', async () => {
    let attempts = 0;

    server.use(
      http.get('https://api.example.com/flaky', () => {
        attempts++;
        if (attempts < 3) {
          return HttpResponse.json({ error: 'Service Unavailable' }, { status: 503 });
        }
        return HttpResponse.json({ success: true });
      })
    );

    const api = client(
      httpTransport('https://api.example.com'),
      retry(
        httpRetryPredicate({ statusCodes: [503] }),
        [backoff({ initial: 10, max: 100 })],
        { tries: 5 }
      ),
      parse.json()
    );

    const response = await api.get('/flaky');

    expect(attempts).toBe(3);
    expect(response.data).toEqual({ success: true });
  });

  it('respects Retry-After header', async () => {
    let attempts = 0;

    server.use(
      http.get('https://api.example.com/rate-limited', () => {
        attempts++;
        if (attempts === 1) {
          return HttpResponse.json(
            { error: 'Too Many Requests' },
            {
              status: 429,
              headers: { 'Retry-After': '1' },
            }
          );
        }
        return HttpResponse.json({ success: true });
      })
    );

    const api = client(
      httpTransport('https://api.example.com'),
      retry(
        httpRetryPredicate({ statusCodes: [429] }),
        [rateLimitDelay({ maxWait: 5000 })],
        { tries: 3 }
      ),
      parse.json()
    );

    const start = Date.now();
    await api.get('/rate-limited');
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(1000);
  });
});
```

## Testing Circuit Breaker

```typescript
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './mocks/server';
import { client, circuitBreaker, CircuitOpenError } from '@unireq/core';
import { http as httpTransport, parse } from '@unireq/http';

describe('Circuit Breaker', () => {
  it('opens after threshold failures', async () => {
    server.use(
      http.get('https://api.example.com/failing', () => {
        return HttpResponse.json({ error: 'Error' }, { status: 500 });
      })
    );

    const api = client(
      httpTransport('https://api.example.com'),
      circuitBreaker({
        threshold: 3,
        resetTimeout: 1000,
        halfOpenRequests: 1,
      }),
      parse.json()
    );

    // Fail 3 times to open the circuit
    for (let i = 0; i < 3; i++) {
      await expect(api.get('/failing')).rejects.toThrow();
    }

    // Next request should fail fast with CircuitOpenError
    await expect(api.get('/failing')).rejects.toThrow(CircuitOpenError);
  });

  it('half-opens after reset timeout', async () => {
    let shouldFail = true;

    server.use(
      http.get('https://api.example.com/recovering', () => {
        if (shouldFail) {
          return HttpResponse.json({ error: 'Error' }, { status: 500 });
        }
        return HttpResponse.json({ success: true });
      })
    );

    const api = client(
      httpTransport('https://api.example.com'),
      circuitBreaker({
        threshold: 2,
        resetTimeout: 100, // Short timeout for testing
        halfOpenRequests: 1,
      }),
      parse.json()
    );

    // Open the circuit
    await expect(api.get('/recovering')).rejects.toThrow();
    await expect(api.get('/recovering')).rejects.toThrow();

    // Wait for reset timeout
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Fix the service
    shouldFail = false;

    // Should succeed and close the circuit
    const response = await api.get('/recovering');
    expect(response.data).toEqual({ success: true });
  });
});
```

## Testing OAuth

```typescript
import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './mocks/server';
import { client } from '@unireq/core';
import { http as httpTransport, parse } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

describe('OAuth', () => {
  it('adds bearer token to requests', async () => {
    let capturedAuth: string | null = null;

    server.use(
      http.get('https://api.example.com/protected', ({ request }) => {
        capturedAuth = request.headers.get('Authorization');
        return HttpResponse.json({ secret: 'data' });
      })
    );

    const api = client(
      httpTransport('https://api.example.com'),
      oauthBearer({
        tokenSupplier: () => 'test-token',
        allowUnsafeMode: true, // Skip JWT validation in tests
      }),
      parse.json()
    );

    await api.get('/protected');

    expect(capturedAuth).toBe('Bearer test-token');
  });

  it('refreshes token on 401', async () => {
    let callCount = 0;
    const refreshToken = vi.fn().mockResolvedValue('new-token');

    server.use(
      http.get('https://api.example.com/protected', ({ request }) => {
        callCount++;
        const auth = request.headers.get('Authorization');

        if (auth === 'Bearer old-token') {
          return HttpResponse.json({ error: 'Unauthorized' }, {
            status: 401,
            headers: { 'WWW-Authenticate': 'Bearer' },
          });
        }

        return HttpResponse.json({ success: true });
      })
    );

    const api = client(
      httpTransport('https://api.example.com'),
      oauthBearer({
        tokenSupplier: () => callCount === 1 ? 'old-token' : 'new-token',
        onRefresh: refreshToken,
        allowUnsafeMode: true,
      }),
      parse.json()
    );

    const response = await api.get('/protected');

    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(response.data).toEqual({ success: true });
  });
});
```

## Testing Error Handling

```typescript
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './mocks/server';
import { client, isHttpError, HttpError } from '@unireq/core';
import { http as httpTransport, parse } from '@unireq/http';

describe('Error Handling', () => {
  it('handles 404 errors', async () => {
    server.use(
      http.get('https://api.example.com/not-found', () => {
        return HttpResponse.json(
          { error: 'Not Found' },
          { status: 404 }
        );
      })
    );

    const api = client(
      httpTransport('https://api.example.com'),
      parse.json()
    );

    try {
      await api.get('/not-found');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(isHttpError(error)).toBe(true);
      expect((error as HttpError).response?.status).toBe(404);
    }
  });

  it('handles network errors', async () => {
    server.use(
      http.get('https://api.example.com/network-error', () => {
        return HttpResponse.error();
      })
    );

    const api = client(
      httpTransport('https://api.example.com'),
      parse.json()
    );

    await expect(api.get('/network-error')).rejects.toThrow();
  });
});
```

## Testing Streaming

```typescript
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './mocks/server';
import { client } from '@unireq/core';
import { http as httpTransport, parse } from '@unireq/http';

describe('Streaming', () => {
  it('parses SSE events', async () => {
    const sseData = `event: message
data: {"id": 1}

event: message
data: {"id": 2}

`;

    server.use(
      http.get('https://api.example.com/events', () => {
        return new HttpResponse(sseData, {
          headers: { 'Content-Type': 'text/event-stream' },
        });
      })
    );

    const api = client(
      httpTransport('https://api.example.com'),
      parse.sse()
    );

    const response = await api.get('/events');
    const events = [];

    for await (const event of response.data) {
      events.push(event);
    }

    expect(events).toHaveLength(2);
    expect(events[0].data).toBe('{"id": 1}');
  });
});
```

## Cross-Package Integration Testing

Unit tests per package verify individual policies in isolation. They do not catch bugs that arise from policy interactions — for example:

- A cache hit returning a stale response when auth has expired
- Auth credentials leaking onto a redirected request to a different origin
- A retry loop not invalidating a cached 503

Integration tests compose multiple packages into a realistic pipeline and verify the combined behavior.

### Why MSW for Integration Tests

MSW intercepts at the network boundary (Node.js `http` module), so every policy in the chain — auth, retry, cache, redirect — executes exactly as it would in production. There is no mocking of internal modules.

### Example: Auth + Retry + Cache in One Pipeline

```typescript
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { client, retry, cache } from '@unireq/core';
import { http as httpTransport, httpRetryPredicate, parse } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

const server = setupServer(
  http.get('https://api.test/data', ({ request }) => {
    if (!request.headers.get('authorization')) {
      return new HttpResponse(null, { status: 401 });
    }
    return HttpResponse.json({ ok: true });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('auth + retry + cache pipeline', () => {
  const api = client(
    httpTransport('https://api.test'),
    oauthBearer({ tokenSupplier: async () => 'test-token', allowUnsafeMode: true }),
    retry(httpRetryPredicate({ statusCodes: [503] }), [], { tries: 3 }),
    cache({ ttl: 5000 }),
    parse.json()
  );

  it('injects auth, retries on transient errors, caches successful responses', async () => {
    let callCount = 0;

    server.use(
      http.get('https://api.test/data', ({ request }) => {
        callCount++;
        if (!request.headers.get('authorization')) {
          return new HttpResponse(null, { status: 401 });
        }
        if (callCount === 1) {
          return new HttpResponse(null, { status: 503 });
        }
        return HttpResponse.json({ ok: true });
      })
    );

    const response = await api.get('/data');

    expect(response.data).toEqual({ ok: true });
    expect(callCount).toBe(2); // 1 retry, then success

    // Second request should be served from cache (no new network calls)
    await api.get('/data');
    expect(callCount).toBe(2);
  });
});
```

### Anatomy of a Cross-Package Test

| Layer | What it verifies |
|-------|-----------------|
| MSW handler checks `authorization` | Auth policy injects the header before the request leaves |
| Handler returns 503 on first call | Retry policy re-sends the request |
| `callCount` assertion | Retry fired exactly once |
| Second `api.get('/data')` without incrementing count | Cache policy served the response |

---

## Security Testing

Security properties must be tested as explicitly as functional ones. The policies described below enforce constraints that are invisible in normal operation — they only appear when an attacker-controlled scenario arises.

### Cross-Origin Redirect: Auth Header Stripping

When a redirect leads to a different origin, `Authorization` and `Cookie` headers must be stripped. Sending credentials to an unexpected host is a credential-leakage vulnerability.

```typescript
it('strips Authorization on cross-origin redirect', async () => {
  const capturedHeaders: Record<string, string | null> = {};

  server.use(
    http.get('https://api.test/redirect', () => {
      return new HttpResponse(null, {
        status: 302,
        headers: { Location: 'https://other-origin.test/landing' },
      });
    }),
    http.get('https://other-origin.test/landing', ({ request }) => {
      capturedHeaders.authorization = request.headers.get('authorization');
      capturedHeaders.cookie = request.headers.get('cookie');
      return HttpResponse.json({ ok: true });
    })
  );

  const api = client(
    httpTransport('https://api.test'),
    oauthBearer({ tokenSupplier: async () => 'secret', allowUnsafeMode: true }),
    parse.json()
  );

  await api.get('/redirect');

  expect(capturedHeaders.authorization).toBeNull();
  expect(capturedHeaders.cookie).toBeNull();
});
```

### HTTPS Downgrade Blocking

A redirect from `https://` to `http://` must be rejected. Allowing it would silently transmit credentials and data over plaintext.

```typescript
it('rejects redirect from HTTPS to HTTP', async () => {
  server.use(
    http.get('https://api.test/downgrade', () => {
      return new HttpResponse(null, {
        status: 301,
        headers: { Location: 'http://api.test/plaintext' },
      });
    })
  );

  const api = client(httpTransport('https://api.test'), parse.json());

  await expect(api.get('/downgrade')).rejects.toThrow(/downgrade|insecure/i);
});
```

### Cache Isolation for Authenticated Requests

A cached response for user A must never be served to user B. The cache key must include `Authorization` (via the `Vary` header or explicit key derivation).

```typescript
it('does not serve cached response across different Authorization tokens', async () => {
  let callCount = 0;

  server.use(
    http.get('https://api.test/profile', ({ request }) => {
      callCount++;
      const token = request.headers.get('authorization');
      return HttpResponse.json({ user: token });
    })
  );

  const makeApi = (token: string) =>
    client(
      httpTransport('https://api.test'),
      oauthBearer({ tokenSupplier: async () => token, allowUnsafeMode: true }),
      cache({ ttl: 60_000 }),
      parse.json()
    );

  const r1 = await makeApi('token-alice').get('/profile');
  const r2 = await makeApi('token-bob').get('/profile');

  expect(r1.data.user).toContain('token-alice');
  expect(r2.data.user).toContain('token-bob');
  expect(callCount).toBe(2); // Each identity hits the network
});
```

### Proxy Credential Isolation

Proxy credentials (set via `UNIREQ_PROXY_USER` / `UNIREQ_PROXY_PASS`) must never appear in `Authorization` headers sent to the target server, and must not be logged.

```typescript
it('does not forward proxy credentials to target host', async () => {
  let targetAuth: string | null = null;

  server.use(
    http.get('https://api.test/resource', ({ request }) => {
      targetAuth = request.headers.get('authorization');
      return HttpResponse.json({ ok: true });
    })
  );

  vi.stubEnv('UNIREQ_PROXY_USER', 'proxy-user');
  vi.stubEnv('UNIREQ_PROXY_PASS', 'proxy-pass');

  const api = client(httpTransport('https://api.test'), parse.json());
  await api.get('/resource');

  expect(targetAuth).toBeNull();
});
```

### Vault File Permissions

The secrets vault must be created with mode `0o600` so that only the owning process can read it.

```typescript
import { stat } from 'node:fs/promises';

it('creates vault file with permissions 0o600', async () => {
  const vaultPath = join(tmpdir(), `vault-${Date.now()}.json`);
  const vault = new SecretsVault(vaultPath);

  await vault.set('key', 'value');

  const { mode } = await stat(vaultPath);
  expect(mode & 0o777).toBe(0o600);
});
```

---

## Best Practices

1. **Reset handlers after each test** - Prevents test pollution
2. **Use `onUnhandledRequest: 'error'`** - Catches unhandled requests
3. **Test edge cases** - Network errors, timeouts, malformed responses
4. **Mock realistic responses** - Use actual API response shapes
5. **Test retry logic** - Verify exponential backoff works correctly
6. **Test circuit breaker states** - Closed, open, half-open
7. **Write integration tests for policy combinations** - Unit tests alone miss interaction bugs
8. **Test every security property explicitly** - Redirect stripping, downgrade blocking, cache isolation
