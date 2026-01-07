# Cheat Sheet

A quick reference for the most common Unireq patterns. Print this page!

---

## Installation

```bash
pnpm add @unireq/core @unireq/http @unireq/presets
```

---

## The Fastest Start

```ts
import { httpClient } from '@unireq/presets';

const api = httpClient('https://api.example.com');

// GET
const user = await api.get('/users/1');

// POST with JSON body (auto-detected)
const created = await api.post('/users', { body: { name: 'John' } });
```

---

## Client Methods

All clients provide these HTTP methods:

| Method | Usage | Body |
|--------|-------|------|
| `api.get(url)` | Fetch data | No |
| `api.post(url, options)` | Create resource | Yes |
| `api.put(url, options)` | Replace resource | Yes |
| `api.patch(url, options)` | Partial update | Yes |
| `api.delete(url)` | Remove resource | No |
| `api.head(url)` | Headers only | No |
| `api.options(url)` | CORS preflight | No |

### Passing Options

```ts
// Simple: body is auto-serialized to JSON
await api.post('/users', { body: { name: 'John' } });

// With abort signal
const controller = new AbortController();
await api.get('/users', { signal: controller.signal });

// With per-request policies
await api.get('/users', { policies: [customPolicy] });
```

---

## Body Serializers (`body.*`)

> **Remember:** `body.*` is for **outgoing requests** (what you send)

```ts
import { body } from '@unireq/http';

// Auto-detect (recommended for simple cases)
body.auto({ name: 'John' })     // → JSON
body.auto('plain text')          // → text/plain
body.auto(new FormData())        // → multipart/form-data
body.auto(new URLSearchParams()) // → application/x-www-form-urlencoded

// Explicit serializers
body.json({ key: 'value' })      // application/json
body.text('Hello world')         // text/plain
body.form({ user: 'john' })      // application/x-www-form-urlencoded
body.binary(buffer, 'image/png') // Binary data with MIME type

// Multipart uploads
body.multipart(
  { name: 'file', part: body.binary(blob, 'application/pdf'), filename: 'doc.pdf' },
  { name: 'meta', part: body.json({ title: 'Doc' }) }
)
```

---

## Response Parsers (`parse.*`)

> **Remember:** `parse.*` is for **incoming responses** (what you receive)

```ts
import { parse } from '@unireq/http';

// Add as policy to auto-parse responses
const api = client(http('...'), parse.json());

// Or use per-request
await api.get('/data', parse.json());
await api.get('/readme', parse.text());
await api.get('/file', parse.stream());
await api.get('/events', parse.sse());
```

---

## Error Handling

### Check response status

```ts
const response = await api.get('/users/1');

if (response.ok) {
  console.log(response.data);
} else {
  console.error(`Error: ${response.status}`);
}
```

### Safe methods (functional style, no try/catch)

```ts
// Returns Result<Response, Error> instead of throwing
const result = await api.safe.get('/users/1');

if (result.isOk()) {
  console.log(result.value.data);
} else {
  console.error(result.error.message);
}

// Or use pattern matching
result.match({
  ok: (res) => console.log(res.data),
  err: (error) => console.error(error.message),
});
```

---

## Common Patterns

### Add default headers

```ts
import { httpClient } from '@unireq/presets';

const api = httpClient('https://api.example.com', {
  headers: {
    'Authorization': 'Bearer token',
    'X-API-Key': 'secret',
  },
});
```

### Add default query parameters

```ts
const api = httpClient('https://api.example.com', {
  query: { api_key: 'secret', format: 'json' },
});

// All requests will include ?api_key=secret&format=json
await api.get('/users'); // → /users?api_key=secret&format=json
```

### Set timeout

```ts
const api = httpClient('https://api.example.com', {
  timeout: 5000, // 5 seconds
});
```

### Custom client with retry

```ts
import { client, retry, backoff } from '@unireq/core';
import { http, httpRetryPredicate, rateLimitDelay, json } from '@unireq/http';

const api = client(
  http('https://api.example.com'),
  retry(
    httpRetryPredicate({ statusCodes: [429, 503] }),
    [rateLimitDelay(), backoff()],
    { tries: 3 }
  ),
  json()
);
```

---

## Quick Comparison: body vs parse

| I want to... | Use |
|--------------|-----|
| Send JSON data | `body.json({ ... })` or `{ body: { ... } }` |
| Send form data | `body.form({ ... })` |
| Upload a file | `body.binary(blob, 'type')` |
| Receive JSON | `parse.json()` as policy |
| Receive plain text | `parse.text()` as policy |
| Stream response | `parse.stream()` as policy |

---

## TypeScript Tips

```ts
// Type your response data
interface User {
  id: number;
  name: string;
}

const response = await api.get<User>('/users/1');
console.log(response.data.name); // TypeScript knows it's a string

// Type your request body
interface CreateUserRequest {
  name: string;
  email: string;
}

await api.post('/users', { body: { name: 'John', email: 'john@example.com' } satisfies CreateUserRequest });
```

---

<p align="center">
  <a href="#/guide/quick-start">← Quick Start</a> ·
  <a href="#/tutorials/getting-started">Getting Started →</a>
</p>
