# Migrating from axios

This guide helps you migrate from axios to @unireq. While the APIs are different, most axios patterns have direct @unireq equivalents.

## Quick Reference

| axios | @unireq |
|-------|---------|
| `axios.create({ baseURL })` | `client(http(baseURL))` |
| `axios.get(url)` | `api.get(url)` |
| `axios.post(url, data)` | `api.post(url, data)` |
| `response.data` | `response.data` |
| `response.status` | `response.status` |
| `interceptors.request.use` | `interceptRequest()` |
| `interceptors.response.use` | `interceptResponse()` |
| `timeout: 5000` | `timeout(5000)` |

## Basic Migration

### axios

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
});

const response = await api.get('/users');
console.log(response.data);
```

### @unireq - Direct equivalent

```typescript
import { client } from '@unireq/core';
import { http, parse, timeout, headers } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  timeout(5000),
  headers({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }),
  parse.json()
);

const response = await api.get('/users');
console.log(response.data);
```

### @unireq - With Preset Builder ✨

For common configurations, the preset builder provides a fluent API:

```typescript
import { preset } from '@unireq/presets';

const api = preset.http
  .uri('https://api.example.com')
  .json                           // Auto JSON parsing
  .timeout                        // Default timeout
  .withHeaders({ 'Authorization': `Bearer ${token}` })
  .build();

const response = await api.get('/users');
console.log(response.data);
```

> 💡 **Why use presets?** Less boilerplate, sensible defaults, fluent API.

## Request Interceptors

### axios

```typescript
axios.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${getToken()}`;
  return config;
});
```

### @unireq - Direct equivalent

```typescript
import { interceptRequest } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  interceptRequest((ctx) => ({
    ...ctx,
    headers: {
      ...ctx.headers,
      Authorization: `Bearer ${getToken()}`,
    },
  })),
  parse.json()
);
```

### @unireq - Idiomatic solution ✨

For Bearer token authentication, unireq provides a dedicated policy that handles more than just header injection:

```typescript
import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

const api = client(
  http('https://api.example.com'),
  oauthBearer({
    tokenSupplier: () => getToken(),     // Async token provider
    onRefresh: async () => refreshToken(), // Auto-refresh on 401
  }),
  parse.json()
);
```

> 💡 **Why use `oauthBearer()`?**
> - **Automatic refresh**: Handles 401 responses and retries with new token
> - **Async token provider**: Fetch token from secure storage
> - **Centralized auth**: One place for all authentication logic
> - **Testable**: Easy to mock in tests

## Response Interceptors

### axios

```typescript
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      logout();
    }
    return Promise.reject(error);
  }
);
```

### @unireq

```typescript
import { interceptResponse, interceptError } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  interceptResponse((response) => {
    // Transform successful responses
    return response;
  }),
  interceptError((error, ctx) => {
    if (error.status === 401) {
      logout();
    }
    throw error;
  }),
  parse.json()
);
```

## Error Handling

### axios

```typescript
try {
  await axios.get('/users');
} catch (error) {
  if (axios.isAxiosError(error)) {
    console.log(error.response?.status);
    console.log(error.response?.data);
  }
}
```

### @unireq

```typescript
import { isHttpError } from '@unireq/core';

try {
  await api.get('/users');
} catch (error) {
  if (isHttpError(error)) {
    console.log(error.response?.status);
    console.log(error.response?.data);
  }
}
```

## Retry Logic

### axios (with axios-retry)

```typescript
import axios from 'axios';
import axiosRetry from 'axios-retry';

const api = axios.create({ baseURL: 'https://api.example.com' });
axiosRetry(api, { retries: 3 });
```

### @unireq - Direct equivalent

```typescript
import { client, retry, backoff } from '@unireq/core';
import { http, httpRetryPredicate, rateLimitDelay, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  retry(
    httpRetryPredicate({ statusCodes: [429, 500, 502, 503, 504] }),
    [rateLimitDelay(), backoff({ initial: 1000, max: 30000, jitter: true })],
    { tries: 3 }
  ),
  parse.json()
);
```

### @unireq - With Preset Builder ✨

```typescript
import { preset } from '@unireq/presets';

const api = preset.http
  .uri('https://api.example.com')
  .json
  .retry  // Built-in retry with sensible defaults
  .build();
```

> 💡 **unireq advantages over axios-retry:**
> - **No extra package**: Built-in, tree-shakeable
> - **Rate-limit aware**: Respects `Retry-After` header automatically
> - **Exponential backoff**: With jitter to prevent thundering herd
> - **Circuit breaker**: Add `.circuitBreaker` for complete resilience

## File Uploads

### axios

```typescript
const formData = new FormData();
formData.append('file', file);

await axios.post('/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
  onUploadProgress: (e) => console.log(e.loaded / e.total * 100),
});
```

### @unireq

```typescript
import { body, progress } from '@unireq/http';

await api.post(
  '/upload',
  body.multipart([{ name: 'file', data: file }]),
  progress({
    onUploadProgress: ({ percent }) => console.log(percent),
  })
);
```

## Cancellation

### axios

```typescript
const controller = new AbortController();

axios.get('/users', { signal: controller.signal });

// Cancel the request
controller.abort();
```

### @unireq

```typescript
const controller = new AbortController();

api.get('/users', { signal: controller.signal });

// Cancel the request
controller.abort();
```

## Why Migrate?

1. **Built-in features**: Circuit breaker, throttle, rate-limit handling without extra packages
2. **Type safety**: Full TypeScript generics for request/response types
3. **Composable**: Policy-based architecture for clean, testable code
4. **OAuth support**: Built-in JWT validation and token refresh
5. **Multi-protocol**: HTTP, HTTP/2, FTP, IMAP with same API
6. **Smaller bundle**: Tree-shakeable, import only what you need

## Gradual Migration

You don't need to migrate everything at once. Both libraries can coexist:

```typescript
// Keep using axios for legacy code
import axios from 'axios';

// Use @unireq for new code
import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';

// Legacy endpoint
const legacyResponse = await axios.get('/v1/users');

// New endpoint with @unireq features
const newApi = client(http('/v2'), circuitBreaker(), parse.json());
const newResponse = await newApi.get('/users');
```
