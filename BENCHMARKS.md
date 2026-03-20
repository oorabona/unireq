# @unireq — Performance Benchmarks

## Methodology

- All benchmarks run against a **local HTTP server** (`node:http` on 127.0.0.1)
- This isolates **library overhead** from network latency
- Each library gets 3 warmup iterations (discarded) before measurement
- Libraries run **sequentially** (no event loop contention between libraries)
- Measured with `performance.now()` (high-resolution timer)

### Limitations

- Results reflect localhost only — no TLS termination, no real network RTT
- WSL2 adds slight virtualization overhead vs bare Linux (conservative estimate: +5%)
- The ETag scenario measures in-memory cache hits; real-world gains depend on server-side 304 latency

### Environment

| Key | Value |
|-----|-------|
| Node | v24.11.0 |
| OS | Linux 6.6 (WSL2) |
| CPU | 13th Gen Intel(R) Core(TM) i9-13980HX |

### Reproduce

```bash
pnpm bench            # Basic: GET/POST sequential + concurrent
pnpm bench:scenarios  # Real-world: large payload, retry, ETag, composition
```

---

## Basic Benchmarks

### Simple GET (1000 sequential)

| Library | Time (ms) | req/s | vs baseline |
|---------|-----------|-------|-------------|
| native fetch | 527 | 1897 | baseline |
| undici.request | 436 | 2292 | -17.3% faster |
| **@unireq/http** | **377** | **2654** | **-28.5% faster** |
| **@unireq/presets** | **355** | **2816** | **-32.6% faster** |
| axios | 565 | 1771 | +7.2% slower |
| got | 567 | 1764 | +7.6% slower |
| ky | 555 | 1803 | +5.3% slower |

### Concurrent GET (100 parallel)

| Library | Time (ms) | req/s | vs baseline |
|---------|-----------|-------|-------------|
| native fetch | 94 | 1059 | baseline |
| undici.request | 5 | 19987 | -94.7% faster |
| **@unireq/http** | **5** | **21955** | **-94.7% faster** |
| **@unireq/presets** | **5** | **20672** | **-94.7% faster** |
| axios | 52 | 1916 | -44.7% faster |
| got | 11 | 9357 | -88.3% faster |
| ky | 11 | 9281 | -88.3% faster |

The concurrent gap is large because native `fetch` and ky use browser-compatible connection pooling (limited by default), while undici — and unireq's HTTP connector — use a per-origin pool that saturates connection capacity.

### POST JSON (1000 sequential)

| Library | Time (ms) | req/s | vs baseline |
|---------|-----------|-------|-------------|
| native fetch | 611 | 1636 | baseline |
| undici.request | 380 | 2631 | -37.8% faster |
| **@unireq/http** | **380** | **2634** | **-37.8% faster** |
| **@unireq/presets** | **374** | **2677** | **-38.8% faster** |
| axios | 555 | 1803 | -9.2% faster |
| got | 522 | 1915 | -14.6% faster |
| ky | 647 | 1546 | +5.9% slower |

### Policy Overhead (@unireq only, 1000 sequential)

| Configuration | Time (ms) | Overhead |
|---------------|-----------|----------|
| bare (no policies) | 389 | baseline |
| retry(3) + timeout(5000) + throttle(1000/s) | 383 | ±1.5% |

Three policies active simultaneously add no measurable overhead — within noise of the baseline.

---

## Real-World Scenarios

### Scenario 1: Large Payload (100KB JSON, 100 iterations)

| Library | Time (ms) | req/s | vs baseline |
|---------|-----------|-------|-------------|
| native fetch | 197 | 508 | baseline |
| undici.request | 159 | 629 | -19.3% faster |
| **@unireq/http** | **160** | **625** | **-18.8% faster** |
| axios | 187 | 535 | -5.1% faster |
| got | 201 | 498 | +2.0% slower |
| ky | 197 | 508 | baseline |

unireq matches raw undici throughput on large payloads. The overhead vs native fetch comes from undici's more efficient body handling relative to the Fetch API's stream abstraction.

---

### Scenario 2: Retry with Backoff (Flaky Server)

The server returns 503 on the first attempt, then succeeds. Each library retries up to 3 times with exponential backoff starting at 10ms. 100 requests total.

| Library | Time (ms) | req/s | vs baseline | Notes |
|---------|-----------|-------|-------------|-------|
| **@unireq/http** | **1529** | **65** | **baseline** | declarative `retry()` policy |
| native fetch | 3254 | 31 | +112.8% slower | manual loop + setTimeout |
| ky | 3281 | 30 | +114.6% slower | `retry: { limit: 3, statusCodes: [503] }` |
| axios | 3370 | 30 | +120.4% slower | manual loop + setTimeout |
| got | 6335 | 16 | +314.3% slower | `retry: { limit: 3, statusCodes: [503] }` |

unireq is 2× faster because its retry policy integrates directly into the policy pipeline — no promise re-creation overhead, no interceptor re-entry cost.

Here is what the same behavior looks like across libraries:

#### unireq (3 lines, declarative)

```ts
const api = client(
  http(baseUrl),
  retry(httpRetryPredicate({ statusCodes: [503] }), [backoff({ initial: 10 })], { tries: 3 }),
  parse.json()
);
const data = await api.get('/endpoint');
```

#### axios (~25 lines, imperative)

```ts
const instance = axios.create({ baseURL });
const retryCounts = new WeakMap();

instance.interceptors.response.use(null, async (error) => {
  const config = error.config;
  const count = retryCounts.get(config) ?? 0;
  if (error.response?.status === 503 && count < 3) {
    retryCounts.set(config, count + 1);
    const delay = 10 * Math.pow(2, count);
    await new Promise(r => setTimeout(r, delay));
    return instance(config);
  }
  throw error;
});
// Note: retryCounts must be WeakMap (not a simple counter) to handle concurrent requests
// correctly — a single counter variable would mis-track retries across parallel calls.
const { data } = await instance.get('/endpoint');
```

---

### Scenario 3: ETag Conditional Caching

The server sets an `ETag` header. On repeated requests, the client sends `If-None-Match` and the server responds with 304 (no body). 100 iterations after the first warm request.

| Library | Time (ms) | req/s | vs baseline | Notes |
|---------|-----------|-------|-------------|-------|
| **@unireq/http** | **1** | **100000** | **baseline** | declarative `etag()` policy |
| native fetch | 43 | 2326 | +4200% slower | manual `If-None-Match` header |
| ky | 49 | 2041 | +4800% slower | manual `If-None-Match` header |
| axios | 61 | 1639 | +6000% slower | manual `If-None-Match` header |
| got | 63 | 1587 | +6200% slower | manual `If-None-Match` header |

unireq's `etag()` policy caches responses in-memory and serves from cache on 304, skipping body parsing entirely. The other libraries still make a network round-trip to get the 304, then require manual cache lookup in application code.

Here is the comparison:

#### unireq (1 line per client, zero application code)

```ts
const api = client(http(baseUrl), etag(), parse.json());
// First call: fetches and caches. Subsequent calls: served from memory if ETag matches.
const data = await api.get('/resource');
```

#### axios (manual header management in every call site)

```ts
const etagCache = new Map<string, { etag: string; data: unknown }>();

async function fetchWithETag(url: string) {
  const cached = etagCache.get(url);
  const headers: Record<string, string> = {};
  if (cached) headers['If-None-Match'] = cached.etag;

  const response = await axios.get(url, {
    headers,
    validateStatus: s => s === 200 || s === 304,
  });

  if (response.status === 304 && cached) return cached.data;

  const etag = response.headers['etag'];
  if (etag) etagCache.set(url, { etag, data: response.data });
  return response.data;
}
```

This must be replicated at every call site (or wrapped in a utility), and the cache is not shared across axios instances.

---

### Scenario 4: Composition Scaling — 7 Policies

Overhead of adding policies to a unireq client, measured across 1000 sequential requests.

| Policies | Time (ms) | req/s | Overhead vs bare |
|----------|-----------|-------|-----------------|
| 0 (bare transport) | 394 | 2538 | baseline |
| 1 | 399 | 2506 | +1.3% |
| 3 | 413 | 2421 | +4.8% |
| 5 | 392 | 2551 | -0.5% (noise) |
| 7 | 423 | 2364 | +7.4% |

Each additional policy costs roughly 4ms over 1000 requests, or ~0.004ms per request per policy. A 7-policy stack adds 7.4% total overhead.

Here is what a 7-policy client looks like in unireq versus the equivalent in axios:

#### unireq (7 lines, composable)

```ts
const api = client(
  http(baseUrl),
  headers({ 'user-agent': 'myapp/1.0' }),
  parse.json(),
  retry(
    httpRetryPredicate({ statusCodes: [429, 503] }),
    [rateLimitDelay(), backoff({ initial: 100 })],
    { tries: 3 }
  ),
  timeout(10_000),
  throttle({ limit: 100, interval: 1000 }),
  audit({ events: ['request', 'response', 'error'] }),
  etag()
);
```

Each policy is a pure function: independently testable, reusable across clients, and removable without touching other behaviors.

#### axios (80+ lines, imperative interceptors)

```ts
const instance = axios.create({
  baseURL,
  timeout: 10_000,
  headers: { 'user-agent': 'myapp/1.0' },
});

// Retry with Retry-After + exponential backoff
const retryCounts = new WeakMap();
instance.interceptors.response.use(null, async (error) => {
  const config = error.config;
  const count = retryCounts.get(config) ?? 0;
  const status = error.response?.status;
  if ([429, 503].includes(status) && count < 3) {
    retryCounts.set(config, count + 1);
    const retryAfter = error.response.headers['retry-after'];
    const delay = retryAfter
      ? parseInt(retryAfter, 10) * 1000
      : 100 * Math.pow(2, count);
    await new Promise(r => setTimeout(r, delay));
    return instance(config);
  }
  throw error;
});

// Token-bucket throttle (100 req/s) — no built-in, manual implementation
let tokens = 100;
const queue: Array<() => void> = [];
const processQueue = () => {
  while (tokens > 0 && queue.length > 0) {
    tokens--;
    queue.shift()!();
  }
};
setInterval(() => { tokens = Math.min(100, tokens + 100); processQueue(); }, 1000);
instance.interceptors.request.use((config) =>
  tokens > 0
    ? (tokens--, config)
    : new Promise(resolve => queue.push(() => resolve(config)))
);

// Audit logging
instance.interceptors.request.use((config) => {
  (config as any)._startTime = Date.now();
  console.log(`[audit] ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});
instance.interceptors.response.use(
  (response) => {
    const elapsed = Date.now() - (response.config as any)._startTime;
    console.log(`[audit] ${response.status} ${elapsed}ms`);
    return response;
  },
  (error) => {
    console.error(`[audit] ERROR ${error.message}`);
    throw error;
  }
);

// ETag caching — manual per-instance Map
const etagCache = new Map<string, { etag: string; data: unknown }>();
instance.interceptors.request.use((config) => {
  const cached = etagCache.get(config.url ?? '');
  if (cached) {
    config.headers['If-None-Match'] = cached.etag;
    (config as any)._etagCached = cached;
  }
  return config;
});
instance.interceptors.response.use((response) => {
  const etag = response.headers['etag'];
  if (etag) etagCache.set(response.config.url ?? '', { etag, data: response.data });
  if (response.status === 304) {
    const cached = (response.config as any)._etagCached;
    return { ...response, data: cached?.data };
  }
  return response;
});
```

The interceptor model makes behaviors stateful, ordered by registration sequence, and tightly coupled — removing or reordering one risks breaking another.

---

## Summary

| Metric | Result |
|--------|--------|
| Sequential GET | 28-33% faster than axios/got |
| Concurrent GET | 94% faster than native fetch, 44% faster than axios |
| POST JSON | 38% faster than native fetch |
| Large payload (100KB) | 19% faster than native fetch |
| Retry scenarios | 2× faster than axios/ky, 4× faster than got |
| ETag cache hits | 43-63× faster than manual implementations |
| Per-policy overhead | ~0.004ms per request per policy |
| 7-policy stack | +7.4% total overhead over bare transport |
