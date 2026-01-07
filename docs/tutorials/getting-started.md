# Getting Started with Unireq

Unireq is a modern, composable HTTP client toolkit for Node.js. It is designed to be tree-shakeable, type-safe, and easy to extend.

## Key Concepts (30 seconds)

Before we dive in, here's the mental model:

| Concept | What it does | Example |
|---------|--------------|---------|
| **Transport** | Handles the network layer | `http('https://api.example.com')` |
| **Policy** | Transforms request/response | `parse.json()`, `headers({...})` |
| **`body.*`** | Serializes **outgoing** request bodies | `body.json({ name: 'John' })` |
| **`parse.*`** | Parses **incoming** response bodies | `parse.json()` |
| **`safe.*`** | Returns `Result` instead of throwing | `api.safe.get('/users')` |

> **Tip:** Think of `body.*` as "what I send" and `parse.*` as "what I receive".

## Installation

To get started, install the core package, the HTTP package, and optionally presets:

```bash
pnpm add @unireq/core @unireq/http @unireq/presets
```

## The Quickest Way: httpClient()

For most use cases, `httpClient()` from `@unireq/presets` provides sensible defaults:

```typescript
import { httpClient } from '@unireq/presets';

const api = httpClient('https://jsonplaceholder.typicode.com');
const response = await api.get('/posts/1');
console.log(response.data);

// With options
const api = httpClient('https://api.example.com', {
  timeout: 10000,
  headers: { 'X-API-Key': 'secret' },
});
```

## Your First Custom Client

Here is how to make a simple GET request to a JSON API.

```typescript
import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';

// 1. Create a client instance
// We use the 'http' transport and a 'parse.json()' policy to automatically parse the response body.
const api = client(
  http('https://jsonplaceholder.typicode.com'),
  parse.json()
);

// 2. Make a request
// The response data is automatically typed if you provide a generic.
interface Post {
  id: number;
  title: string;
  body: string;
}

const response = await api.get<Post>('/posts/1');

console.log(response.data.title);
```

## Adding Headers

You can add headers to all requests using the `headers` policy.

```typescript
import { client } from '@unireq/core';
import { http, headers, parse } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  headers({
    'Authorization': 'Bearer my-token',
    'User-Agent': 'MyApp/1.0'
  }),
  parse.json()
);
```

## Making POST Requests

Sending data is straightforward. Use the `body` option or `body.*` serializers:

```typescript
import { httpClient } from '@unireq/presets';

const api = httpClient('https://api.example.com');

// Simplest: pass body directly (auto-serialized to JSON)
await api.post('/users', { body: { name: 'John', email: 'john@example.com' } });

// The response contains the created resource
interface User {
  id: number;
  name: string;
  email: string;
}

const response = await api.post<User>('/users', { body: { name: 'Jane' } });
console.log(`Created user with id: ${response.data.id}`);
```

### Using body serializers explicitly

For more control, use `body.*` serializers from `@unireq/http`:

```typescript
import { client } from '@unireq/core';
import { http, body, parse } from '@unireq/http';

const api = client(http('https://api.example.com'), parse.json());

// JSON body (explicit)
await api.post('/users', body.json({ name: 'John' }));

// Form-encoded body (for legacy APIs)
await api.post('/login', body.form({ username: 'john', password: 'secret' }));

// Plain text
await api.post('/notes', body.text('My note content'));

// Auto-detect body type (recommended for most cases)
await api.post('/users', body.auto({ name: 'John' }));  // → JSON
await api.post('/notes', body.auto('Plain text'));      // → text/plain
```

> **When to use what:**
> - `{ body: data }` — Quickest, auto-serializes objects to JSON
> - `body.auto(data)` — Explicit auto-detection, works with all types
> - `body.json(data)` — When you want to be explicit about JSON
> - `body.form(data)` — For `application/x-www-form-urlencoded` (legacy APIs)

## Error Handling

Unlike many other HTTP clients, **Unireq does not throw errors for non-2xx responses by default**.

A 404 or 500 response is still a valid HTTP response. Unireq only throws errors for network failures (like DNS issues) or timeouts.

You should check the `ok` property or the `status` code:

```typescript
const response = await api.get('/non-existent');

if (!response.ok) {
  console.error(`Request failed with status ${response.status}`);
  // Handle error...
} else {
  console.log('Success:', response.data);
}
```

### Functional Error Handling with Result

For a more functional approach, use `safe.*` methods that return a `Result` type:

```typescript
import { httpClient } from '@unireq/presets';

const api = httpClient('https://api.example.com');

// Returns Result<Response, Error> instead of throwing
const result = await api.safe.get('/users/1');

if (result.isOk()) {
  console.log('Success:', result.value.data);
} else {
  console.error('Failed:', result.error.message);
}

// Chain operations with map
const name = await api.safe.get<{ name: string }>('/users/1')
  .then(r => r.map(res => res.data.name));

// Pattern matching
const message = result.match({
  ok: (res) => `Got user: ${res.data.name}`,
  err: (error) => `Error: ${error.message}`,
});
```

### Throw on Error Policy

If you prefer the "throw on error" behavior, you can easily create a policy for it:

```typescript
import { policy, HttpError } from '@unireq/core';

const throwOnError = policy(async (ctx, next) => {
  const response = await next(ctx);
  if (!response.ok) {
    throw new HttpError(response);
  }
  return response;
});

const api = client(http(), throwOnError);
```

## Next Steps

- Learn about [Composition](concepts/composition.md)
- Explore [HTTP Semantics](concepts/http-semantics.md)
- Check out [Advanced Usage](tutorials/advanced.md)

---

<p align="center">
  <a href="#/README">← Home</a> · <a href="#/tutorials/advanced">Advanced Usage →</a>
</p>
