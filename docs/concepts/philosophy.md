# Philosophy & Comparison

Unireq is designed with a specific philosophy: **Composition over Configuration**.

## The "Kitchen Sink" Problem

Traditional HTTP clients like Axios or the native `fetch` API often suffer from the "kitchen sink" problem. They try to do everything via a massive configuration object.

### The Axios Way (Object-Oriented / Config)

```javascript
// Axios: Everything is a config option
const client = axios.create({
  baseURL: 'https://api.example.com',
  timeout: 1000,
  headers: { 'X-Custom': 'foobar' },
  validateStatus: (status) => status < 500, // Config callback
  transformResponse: [ ... ], // Array of hooks
});
```

This works well for simple cases, but it becomes difficult to extend. Adding a new feature (like OAuth rotation or complex retry logic) often requires wrapping the client or using "interceptors" that mutate global state.

## The Unireq Way (Functional / Composition)

Unireq takes a different approach. A client is just a **transport** (the thing that sends bytes) wrapped in layers of **policies** (functions that modify the request or response).

```typescript
import { client } from '@unireq/core';
import { http, headers, timeout } from '@unireq/http';

// Unireq: Everything is a function
const api = client(
  http('https://api.example.com'), // 1. Transport
  headers({ 'X-Custom': 'foobar' }), // 2. Policy
  timeout(1000)                      // 3. Policy
);
```

### Key Differences

| Feature | Axios / Traditional | Unireq |
|---------|---------------------|--------|
| **Configuration** | Giant options object | Composable functions (Policies) |
| **Extensibility** | Interceptors / Hooks | Write your own Policy function |
| **State** | Often mutable (interceptors stack) | Immutable policy chain |
| **Error Handling** | Throws on non-2xx by default | **Does not throw** (returns `ok: false`) |
| **Bundle Size** | Monolithic (all features included) | Tree-shakeable (import only what you use) |

## Why "No Throw" by Default?

Unireq treats HTTP responses as *values*, not exceptions. A 404 Not Found is a valid HTTP response, not a runtime exception like a network failure.

- **Network Error (DNS, Offline):** Throws `NetworkError`.
- **Timeout:** Throws `TimeoutError`.
- **4xx/5xx Responses:** Returns the response object.

This forces you to handle the response explicitly, which leads to more robust code.

```typescript
const response = await api.get('/users/123');

if (!response.ok) {
  // Handle 404, 500, etc. gracefully
  if (response.status === 404) return null;
  // Or throw manually if you really want to
  throw new Error(`API Error: ${response.status}`);
}

// TypeScript knows response.data is safe here if you use a parser
console.log(response.data);
```

## The Onion Model

Unireq uses an "onion" middleware model. Requests go *in* through the layers, and responses come *out* through the layers.

1. **Request starts**
2. `retry` policy (starts tracking)
3. `headers` policy (adds headers)
4. `http` transport (sends request)
5. **Response received**
6. `headers` policy (sees response, does nothing)
7. `retry` policy (checks status, maybe retries)
8. **Result returned**

This makes it easy to reason about complex behaviors like "retry this request, but refresh the auth token if it fails with 401".

---

<p align="center">
  <a href="#/guide/quick-start">← Quick Start</a> · <a href="#/concepts/composition">Composition →</a>
</p>
