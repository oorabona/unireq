# Basic HTTP Requests

Basic HTTP requests using the body/parse system.

- Simple client configuration with `httpClient()`
- Typed GET request with `parse.json()`
- POST with `body.json()`
- PUT, PATCH, DELETE operations
- Base URL handling
- Safe methods with `Result` type

## Quick Start with httpClient()

The simplest way to make HTTP requests:

```typescript
import { httpClient } from '@unireq/presets';

// Create client with sensible defaults
const api = httpClient('https://jsonplaceholder.typicode.com');

// Make requests
const response = await api.get('/posts/1');
console.log(response.data);

// With options
const api = httpClient('https://api.example.com', {
  timeout: 10000,
  headers: { 'X-API-Key': 'secret' },
  json: true,           // default: true
  followRedirects: true, // default: true
});
```

## Safe Methods with Result

Use `safe.*` methods for functional error handling without try/catch:

```typescript
import { httpClient } from '@unireq/presets';

const api = httpClient('https://jsonplaceholder.typicode.com');

// Returns Result<Response, Error> instead of throwing
const result = await api.safe.get('/posts/1');

if (result.isOk()) {
  console.log('Success:', result.value.data);
} else {
  console.error('Failed:', result.error.message);
}

// Chain operations with map
const title = await api.safe.get<{ title: string }>('/posts/1')
  .then(r => r.map(res => res.data.title));

if (title.isOk()) {
  console.log('Title:', title.value);
}
```

## GET Request

```typescript
/**
 * Basic HTTP GET example
 * Usage: pnpm example:http
 */

import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';

// Create client with HTTP transport and JSON parser
const api = client(http('https://jsonplaceholder.typicode.com'), parse.json());

// Make a GET request
const response = await api.get<{ id: number; title: string }>('/posts/1');

console.log('GET successful!');
console.log(`Status: ${response.status}`);
console.log(`Title: ${response.data.title}`);
```

## POST Request (Create)

```typescript
import { client } from '@unireq/core';
import { http, body, parse } from '@unireq/http';

const api = client(http('https://jsonplaceholder.typicode.com'), parse.json());

interface Post {
  id: number;
  title: string;
  body: string;
  userId: number;
}

// Create a new post
const response = await api.post<Post>(
  '/posts',
  body.json({
    title: 'New Post',
    body: 'This is the content.',
    userId: 1,
  })
);

console.log('POST successful!');
console.log(`Created post ID: ${response.data.id}`);
```

## PUT Request (Full Update)

```typescript
import { client } from '@unireq/core';
import { http, body, parse } from '@unireq/http';

const api = client(http('https://jsonplaceholder.typicode.com'), parse.json());

// Replace an entire resource
const response = await api.put<Post>(
  '/posts/1',
  body.json({
    id: 1,
    title: 'Updated Title',
    body: 'Completely new content.',
    userId: 1,
  })
);

console.log('PUT successful!');
console.log(`Updated: ${response.data.title}`);
```

## PATCH Request (Partial Update)

```typescript
import { client } from '@unireq/core';
import { http, body, parse } from '@unireq/http';

const api = client(http('https://jsonplaceholder.typicode.com'), parse.json());

// Update only specific fields
const response = await api.patch<Post>(
  '/posts/1',
  body.json({
    title: 'Only Title Changed',
  })
);

console.log('PATCH successful!');
console.log(`Updated title: ${response.data.title}`);
```

## DELETE Request

```typescript
import { client } from '@unireq/core';
import { http, parse } from '@unireq/http';

const api = client(http('https://jsonplaceholder.typicode.com'), parse.json());

// Delete a resource
const response = await api.delete('/posts/1');

console.log('DELETE successful!');
console.log(`Status: ${response.status}`);
console.log(`Deleted: ${response.ok}`);
```

## Complete CRUD Example

```typescript
import { client } from '@unireq/core';
import { http, body, parse } from '@unireq/http';

interface User {
  id: number;
  name: string;
  email: string;
}

// Create a reusable API client
const api = client(http('https://jsonplaceholder.typicode.com'), parse.json());

// CREATE
async function createUser(data: Omit<User, 'id'>): Promise<User> {
  const response = await api.post<User>('/users', body.json(data));
  if (!response.ok) throw new Error(`Failed: ${response.status}`);
  return response.data;
}

// READ
async function getUser(id: number): Promise<User | null> {
  const response = await api.get<User>(`/users/${id}`);
  return response.ok ? response.data : null;
}

// UPDATE
async function updateUser(id: number, data: Partial<User>): Promise<User> {
  const response = await api.patch<User>(`/users/${id}`, body.json(data));
  if (!response.ok) throw new Error(`Failed: ${response.status}`);
  return response.data;
}

// DELETE
async function deleteUser(id: number): Promise<boolean> {
  const response = await api.delete(`/users/${id}`);
  return response.ok;
}

// Usage
const user = await createUser({ name: 'John', email: 'john@example.com' });
console.log('Created:', user);

const fetched = await getUser(user.id);
console.log('Fetched:', fetched);

const updated = await updateUser(user.id, { name: 'John Doe' });
console.log('Updated:', updated);

const deleted = await deleteUser(user.id);
console.log('Deleted:', deleted);
```

---

<p align="center">
  <a href="#/README">&larr; Home</a> &middot; <a href="#/examples/auth">Authentication &rarr;</a>
</p>
