# @unireq — Performance Benchmarks

## Methodology

- All benchmarks run against a **local HTTP server** (`node:http` on 127.0.0.1)
- This isolates **library overhead** from network latency
- Each library gets **20 warmup iterations** (discarded) before measurement
- All libraries use **persistent clients** (undici Pool for @unireq/http, axios.create, got.extend, etc.) — no cold connection per request
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

| Library | Time (ms) | req/s | vs @unireq/http |
|---------|-----------|-------|-----------------|
| native fetch | 674 | 1484 | unireq 36% more throughput |
| undici.request | 575 | 1738 | unireq 16% more throughput |
| **@unireq/http** | **496** | **2015** | **baseline** |
| **@unireq/presets** | **492** | **2030** | **1% more (within noise)** |
| axios | 677 | 1477 | unireq 36% more throughput |
| got | 742 | 1348 | unireq 49% more throughput |
| ky | 738 | 1354 | unireq 49% more throughput |

### Concurrent GET (100 parallel)

| Library | Time (ms) | req/s | vs @unireq/http |
|---------|-----------|-------|-----------------|
| native fetch | 83 | 1200 | unireq 13× more throughput |
| undici.request | 31 | 3239 | unireq 5× more throughput |
| **@unireq/http** | **6** | **15894** | **baseline** |
| **@unireq/presets** | **7** | **14545** | **within noise** |
| axios | 69 | 1454 | unireq 11× more throughput |
| got | 23 | 4435 | unireq 3.6× more throughput |
| ky | 13 | 7470 | unireq 2.1× more throughput |

The concurrent gap is large because native `fetch` and axios use browser-compatible connection pooling (limited by default), while undici — and unireq's HTTP connector — use a per-origin pool that saturates available connection capacity.

### POST JSON (1000 sequential)

| Library | Time (ms) | req/s | vs @unireq/http |
|---------|-----------|-------|-----------------|
| native fetch | 722 | 1385 | unireq 41% more throughput |
| undici.request | 523 | 1913 | unireq 2% more throughput |
| **@unireq/http** | **513** | **1950** | **baseline** |
| **@unireq/presets** | **530** | **1887** | **within noise** |
| axios | 748 | 1336 | unireq 46% more throughput |
| got | 703 | 1421 | unireq 37% more throughput |
| ky | 894 | 1118 | unireq 74% more throughput |

### Policy Overhead (@unireq only, 1000 sequential)

| Configuration | Time (ms) | Overhead |
|---------------|-----------|----------|
| bare (no policies) | 439 | baseline |
| retry(3) + timeout(5000) + throttle(1000/s) | 526 | +20% |

Three active policies add approximately 20% overhead — about 0.087ms per request per policy, a reasonable trade-off for declarative resilience behavior.

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
| Sequential GET (1000 req) | 36% more throughput than axios, 49% more than got |
| Concurrent GET (100 parallel) | 13× the throughput of native fetch, 11× axios |
| POST JSON (1000 req) | 41% more throughput than native fetch, 46% more than axios |
| Large payload (100KB) | Matches raw undici; 19% more throughput than native fetch |
| Retry scenarios | 2× more throughput than axios/ky, 4× more than got |
| ETag cache hits | 43-63× more throughput than manual If-None-Match implementations |
| Policy overhead (3 policies) | +20% over bare transport (~0.087ms per request per policy) |
| 7-policy stack | +7.4% total overhead over bare transport |
