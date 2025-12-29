# Migrating from ky

This guide helps you migrate from ky to @unireq. Both libraries share a modern, fetch-based approach with fluent APIs.

## Quick Reference

| ky | @unireq |
|----|---------|
| `ky.create({ prefixUrl })` | `client(http(prefixUrl))` |
| `ky.get(url)` | `api.get(url)` |
| `ky.post(url, { json })` | `api.post(url, body)` |
| `response.json()` | `response.data` (auto-parsed) |
| `hooks.beforeRequest` | `interceptRequest()` |
| `hooks.afterResponse` | `interceptResponse()` |
| `retry: 3` | `retry(..., { tries: 3 })` |
| `timeout: 5000` | `timeout(5000)` |

## Basic Migration

### ky

```typescript
import ky from 'ky';

const api = ky.create({
  prefixUrl: 'https://api.example.com',
  timeout: 5000,
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  retry: 3,
});

const response = await api.get('users').json();
console.log(response);
```

### @unireq - Direct equivalent

```typescript
import { client, retry, backoff } from '@unireq/core';
import { http, parse, timeout, headers, httpRetryPredicate } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  timeout(5000),
  headers({ 'Authorization': `Bearer ${token}` }),
  retry(httpRetryPredicate(), [backoff()], { tries: 3 }),
  parse.json()
);

const response = await api.get('/users');
console.log(response.data); // Already parsed!
```

### @unireq - With Preset Builder ✨

```typescript
import { preset } from '@unireq/presets';

const api = preset.http
  .uri('https://api.example.com')
  .json
  .timeout
  .retry
  .withHeaders({ 'Authorization': `Bearer ${token}` })
  .build();

const response = await api.get('/users');
console.log(response.data);
```

> 💡 **Why use presets?** Less boilerplate, sensible defaults, fluent API.

## Hooks to Policies

### ky hooks

```typescript
const api = ky.create({
  hooks: {
    beforeRequest: [
      (request) => {
        request.headers.set('Authorization', `Bearer ${getToken()}`);
      },
    ],
    afterResponse: [
      async (request, options, response) => {
        if (response.status === 401) {
          const token = await refreshToken();
          request.headers.set('Authorization', `Bearer ${token}`);
          return ky(request);
        }
        return response;
      },
    ],
  },
});
```

### @unireq - Direct equivalent

```typescript
import { client } from '@unireq/core';
import { http, interceptRequest, interceptResponse, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  interceptRequest((ctx) => ({
    ...ctx,
    headers: {
      ...ctx.headers,
      Authorization: `Bearer ${getToken()}`,
    },
  })),
  interceptResponse(async (response, ctx) => {
    if (response.status === 401) {
      const token = await refreshToken();
      // Retry with new token (manual implementation)
      return fetch(ctx.url, {
        ...ctx,
        headers: { ...ctx.headers, Authorization: `Bearer ${token}` },
      });
    }
    return response;
  }),
  parse.json()
);
```

### @unireq - Idiomatic solution ✨

The `oauthBearer()` policy handles all of this automatically:

```typescript
import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

const api = client(
  http('https://api.example.com'),
  oauthBearer({
    tokenSupplier: () => getToken(),
    onRefresh: async () => {
      const newToken = await refreshToken();
      return newToken;
    },
  }),
  parse.json()
);
```

> 💡 **Why use `oauthBearer()`?**
> - **Automatic 401 handling**: Refresh and retry transparently
> - **No manual retry logic**: The policy handles everything
> - **JWT validation**: Optional token validation before requests

## Error Handling

### ky

```typescript
import ky, { HTTPError } from 'ky';

try {
  await ky.get('https://api.example.com/users');
} catch (error) {
  if (error instanceof HTTPError) {
    console.log(error.response.status);
    const body = await error.response.json();
    console.log(body);
  }
}
```

### @unireq

```typescript
import { isHttpError, HttpError } from '@unireq/core';

try {
  await api.get('/users');
} catch (error) {
  if (isHttpError(error)) {
    console.log(error.response?.status);
    console.log(error.response?.data); // Already parsed
  }
}
```

## Search Params

### ky

```typescript
const response = await ky.get('users', {
  searchParams: {
    page: 1,
    limit: 10,
    filter: ['active', 'verified'],
  },
});
```

### @unireq

```typescript
import { query } from '@unireq/http';

const response = await api.get(
  '/users',
  query({
    page: '1',
    limit: '10',
    filter: ['active', 'verified'],
  })
);
```

## JSON Body

### ky

```typescript
const response = await ky.post('users', {
  json: {
    name: 'John',
    email: 'john@example.com',
  },
});
```

### @unireq

```typescript
import { body } from '@unireq/http';

const response = await api.post(
  '/users',
  body.json({ name: 'John', email: 'john@example.com' })
);

// Or simply pass the object (auto-serialized with parse.json())
const response = await api.post('/users', {
  name: 'John',
  email: 'john@example.com',
});
```

## Form Data

### ky

```typescript
const formData = new FormData();
formData.append('name', 'John');
formData.append('avatar', file);

await ky.post('users', { body: formData });
```

### @unireq

```typescript
import { body } from '@unireq/http';

await api.post(
  '/users',
  body.multipart(
    [{ name: 'avatar', data: file }],
    [{ name: 'name', value: 'John' }]
  )
);
```

## Extended Options

### ky

```typescript
const api = ky.extend({
  prefixUrl: 'https://api.example.com',
  timeout: 10000,
  retry: {
    limit: 3,
    methods: ['get'],
    statusCodes: [408, 429, 500, 502, 503, 504],
  },
});
```

### @unireq (Preset Builder)

```typescript
import { preset } from '@unireq/presets';

const api = preset.api
  .json
  .withTimeout(10000)
  .withRetry({ tries: 3, methods: ['GET'] })
  .build('https://api.example.com');
```

## Feature Comparison

| Feature | ky | @unireq |
|---------|-----|---------|
| **Bundle size** | ~2KB | ~8KB |
| **Browser support** | ✅ Excellent | ✅ Good |
| **Node.js** | ✅ | ✅ |
| **Retry** | ✅ | ✅ + Rate-limit aware |
| **Timeout** | ✅ | ✅ + Phase timeouts |
| **Hooks** | ✅ | ✅ Policies |
| **Circuit Breaker** | ❌ | ✅ Built-in |
| **Throttle** | ❌ | ✅ Built-in |
| **OAuth** | ❌ | ✅ Built-in |
| **Validation** | ❌ | ✅ Zod/Valibot |
| **HTTP/2** | ❌ | ✅ @unireq/http2 |
| **GraphQL** | ❌ | ✅ @unireq/graphql |
| **Introspection** | ❌ | ✅ `inspect()` |

## When to Stay with ky

- **Browser-only apps**: ky's 2KB bundle is hard to beat
- **Simple use cases**: If you only need basic fetch wrapper
- **Minimal dependencies**: ky has zero dependencies

## When to Migrate to @unireq

- **Enterprise apps**: Need circuit breaker, throttle, OAuth
- **Node.js servers**: Need HTTP/2, FTP, IMAP support
- **Type safety**: Need strong TypeScript generics
- **Validation**: Need Zod/Valibot response validation
- **Debugging**: Need request introspection

## Side-by-Side Comparison

### Simple GET

```typescript
// ky
const data = await ky.get('https://api.example.com/users').json();

// @unireq
const response = await api.get('/users');
const data = response.data;
```

### POST with JSON

```typescript
// ky
await ky.post('https://api.example.com/users', {
  json: { name: 'John' },
});

// @unireq
await api.post('/users', { name: 'John' });
```

### With All Options

```typescript
// ky
const api = ky.create({
  prefixUrl: 'https://api.example.com',
  timeout: 5000,
  retry: 3,
  headers: { 'X-API-Key': key },
});

// @unireq
const api = preset.api
  .json
  .timeout
  .retry
  .withHeaders({ 'X-API-Key': key })
  .build('https://api.example.com');
```
