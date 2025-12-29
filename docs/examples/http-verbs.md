# HTTP Verbs Walkthrough

Practical tour of `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, and `OPTIONS` using the same Unireq client. Each snippet mirrors the runnable script `examples/http-verbs.ts`.

## Highlights

- ✅ One client, multiple verbs with per-request policies
- ✅ Shows when to add `body.*`, idempotency keys, and conditional headers
- ✅ Demonstrates `options()` preflights without leaving the JSON comfort zone

## Run it locally

```bash
pnpm example:http-verbs
```

## Setup once

```typescript
import { client } from '@unireq/core';
import { body, headers, http, parse } from '@unireq/http';

type HttpBinEcho<T = unknown> = {
  args: Record<string, string>;
  headers: Record<string, string>;
  json: T;
  method: string;
  url: string;
};

const api = client(http('https://httpbin.org'), headers({ 'user-agent': 'unireq-http-verbs/1.0' }));
```

## HEAD — inspect metadata before fetching

```typescript
const head = await api.head('/bytes/1024', parse.raw());
const expectedLength = Number(head.headers['content-length'] ?? 0);

const download = await api.get<ArrayBuffer>('/bytes/1024', parse.binary());
console.log('Bytes downloaded vs expected:', download.data.byteLength, expectedLength);
```

- HEAD returns headers only, so `parse.raw()` avoids attempts to decode a non-existent body.
- The follow-up GET can leverage the previously observed headers (`Content-Length`, `ETag`, etc.) for conditional requests.

## GET — read data

```typescript
const response = await api.get<HttpBinEcho>('/get', headers({ 'x-trace-id': crypto.randomUUID() }), parse.json());
console.log(response.data.args);
```

- `headers()` can run per request to add tracing IDs without recompiling the client.
- Safe to pair with `retry(httpRetryPredicate())` because `GET` stays idempotent.

## POST — create resources

```typescript
const payload = { email: 'jane@example.com', name: 'Jane' };
const response = await api.post<HttpBinEcho<typeof payload>>(
  '/anything',
  body.json(payload),
  headers({ 'x-idempotency-key': crypto.randomUUID() }),
  parse.json(),
);
```

- `body.json()` sets the `Content-Type` header and serializes the payload.
- Idempotency keys let servers deduplicate accidental retries.

## PUT — replace entirely

```typescript
await api.put<HttpBinEcho<{ id: number; role: string }>>(
  '/anything/profile',
  body.json({ id: 42, role: 'admin' }),
  headers({ 'if-match': 'W/"profile-v1"' }),
  parse.json(),
);
```

- Combine with `etag()` or a manual `If-Match` header to block lost updates.
- PUT stays idempotent, so retrying is usually acceptable.

## PATCH — mutate partially

```typescript
await api.patch<HttpBinEcho<{ role: string }>>('/anything/profile', body.json({ role: 'editor' }), parse.json());
```

- Use `headers({ 'content-type': 'application/merge-patch+json' })` if your API distinguishes patch formats.
- Great place to plug validation helpers (e.g., Valibot) before sending.

## DELETE — remove resources

```typescript
await api.delete<HttpBinEcho>('/anything/session', headers({ 'x-confirm-delete': 'true' }), parse.json());
```

- Some APIs return `204 No Content`; in that case you can skip the parser or use `parse.raw()`.
- Explicit confirmation headers help avoid accidental deletes.

## OPTIONS — discover capabilities

```typescript
const response = await api.options('/anything', headers({ Origin: 'https://docs.unireq.dev' }), parse.raw());
console.log(response.headers['allow']);
console.log(response.headers['access-control-allow-methods']);
```

- Perfect for CORS preflights or checking which verbs an endpoint supports before issuing a mutating call.
- Most servers return an empty body for `OPTIONS`, so `parse.raw()` prevents JSON parsing errors; inspect headers instead.
- Cache these responses with `conditional()` when the server advertises long-lived metadata.

## Full script

```typescript
import { client } from '@unireq/core';
import { body, headers, http, parse } from '@unireq/http';

type HttpBinEcho<T = unknown> = {
  args: Record<string, string>;
  headers: Record<string, string>;
  json: T;
  method: string;
  url: string;
};

const api = client(http('https://httpbin.org'), headers({ 'user-agent': 'unireq-http-verbs/1.0' }));

async function demoHeadBeforeGet() {
  console.log('\n=== HEAD + GET /bytes/1024 ===');
  const headResponse = await api.head('/bytes/1024', parse.raw());
  const expectedLength = Number(headResponse.headers['content-length'] ?? 0);
  console.log('HEAD Content-Length:', expectedLength);

  const download = await api.get<ArrayBuffer>('/bytes/1024', parse.binary());
  console.log('GET downloaded bytes:', download.data.byteLength);
}

async function demoGet() {
  console.log('\n=== GET /get ===');
  const response = await api.get<HttpBinEcho>('/get', headers({ 'x-trace-id': crypto.randomUUID() }), parse.json());
  console.log('Status:', response.status);
  console.log('Args:', response.data.args);
}

async function demoPost() {
  console.log('\n=== POST /anything ===');
  const payload = { email: 'jane@example.com', name: 'Jane' };
  const response = await api.post<HttpBinEcho<typeof payload>>(
    '/anything',
    body.json(payload),
    headers({ 'x-idempotency-key': crypto.randomUUID() }),
    parse.json(),
  );
  console.log('Status:', response.status);
  console.log('Echoed JSON:', response.data.json);
}

async function demoPut() {
  console.log('\n=== PUT /anything/profile ===');
  const response = await api.put<HttpBinEcho<{ id: number; role: string }>>(
    '/anything/profile',
    body.json({ id: 42, role: 'admin' }),
    headers({ 'if-match': 'W/"profile-v1"' }),
    parse.json(),
  );
  console.log('Status:', response.status);
  console.log('Headers sent:', response.data.headers);
}

async function demoPatch() {
  console.log('\n=== PATCH /anything/profile ===');
  const response = await api.patch<HttpBinEcho<{ role: string }>>(
    '/anything/profile',
    body.json({ role: 'editor' }),
    parse.json(),
  );
  console.log('Status:', response.status);
  console.log('JSON delta:', response.data.json);
}

async function demoDelete() {
  console.log('\n=== DELETE /anything/session ===');
  const response = await api.delete<HttpBinEcho>(
    '/anything/session',
    headers({ 'x-confirm-delete': 'true' }),
    parse.json(),
  );
  console.log('Status:', response.status);
  console.log('Was JSON returned?', Boolean(response.data.json));
}

async function demoOptions() {
  console.log('\n=== OPTIONS /anything ===');
  const response = await api.options('/anything', headers({ Origin: 'https://docs.unireq.dev' }), parse.raw());
  console.log('Status:', response.status);
  console.log('Allow header:', response.headers['allow']);
  console.log('CORS methods:', response.headers['access-control-allow-methods']);
}

async function main() {
  await demoHeadBeforeGet();
  await demoGet();
  await demoPost();
  await demoPut();
  await demoPatch();
  await demoDelete();
  await demoOptions();
}

main().catch((error) => {
  console.error('❌ HTTP verbs demo failed:', error);
  process.exitCode = 1;
});
```

---

<p align="center">
  <a href="#/examples/interceptors">← Interceptors</a> · <a href="#/examples/streaming">Streaming →</a>
</p>
