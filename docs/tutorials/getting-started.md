# Getting Started with Unireq

Unireq is a modern, composable HTTP client toolkit for Node.js. It is designed to be tree-shakeable, type-safe, and easy to extend.

## Installation

To get started, install the core package and the HTTP package:

```bash
pnpm add @unireq/core @unireq/http
```

## Your First Request

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
