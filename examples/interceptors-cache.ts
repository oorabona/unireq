/**
 * Interceptors - Caching example
 * Demonstrates HTTP caching using interceptors
 * Usage: pnpm example:interceptors-cache
 */

import { client, type Policy } from '@unireq/core';
import { http, parse } from '@unireq/http';

console.log('💾 Interceptors - Caching Examples\n');

// Example 1: Simple in-memory cache
console.log('📊 Example 1: Simple in-memory cache\n');

const cache = new Map<string, { data: unknown; expires: number }>();

const simpleCache: Policy = async (ctx, next) => {
  // Only cache GET requests
  if (ctx.method !== 'GET') {
    return next(ctx);
  }

  const cacheKey = ctx.url;
  const cached = cache.get(cacheKey);

  // Return cached response if not expired
  if (cached && Date.now() < cached.expires) {
    console.log(`💾 Cache HIT: ${ctx.url}`);
    return {
      status: 200,
      statusText: 'OK',
      headers: { 'x-cache': 'HIT' },
      data: cached.data,
      ok: true,
    };
  }

  console.log(`🔍 Cache MISS: ${ctx.url}`);

  // Make request and cache response
  const response = await next(ctx);

  if (response.ok) {
    cache.set(cacheKey, {
      data: response.data,
      expires: Date.now() + 5000, // 5 second TTL
    });
  }

  return { ...response, headers: { ...response.headers, 'x-cache': 'MISS' } };
};

const api1 = client(http('http://localhost:3001'), simpleCache);

// First request - cache miss
const response1a = await api1.get('/get?test=1', parse.json());
console.log(`Response 1a - Cache: ${response1a.headers['x-cache']}\n`);

// Second request - cache hit
const response1b = await api1.get('/get?test=1', parse.json());
console.log(`Response 1b - Cache: ${response1b.headers['x-cache']}\n`);

// Wait for cache to expire
console.log('Waiting 5 seconds for cache to expire...\n');
await new Promise((resolve) => setTimeout(resolve, 5000));

// Third request - cache miss (expired)
const response1c = await api1.get('/get?test=1', parse.json());
console.log(`Response 1c - Cache: ${response1c.headers['x-cache']}\n`);

// Example 2: Cache with ETag support
console.log('📊 Example 2: Cache with ETag support\n');

interface CacheEntry {
  data: unknown;
  etag: string;
  expires: number;
}

const etagCache = new Map<string, CacheEntry>();

const etagCachePolicy: Policy = async (ctx, next) => {
  if (ctx.method !== 'GET') {
    return next(ctx);
  }

  const cacheKey = ctx.url;
  const cached = etagCache.get(cacheKey);

  // If cached and not expired, return cached data
  if (cached && Date.now() < cached.expires) {
    console.log(`💾 Cache HIT (valid): ${ctx.url}`);
    return {
      status: 200,
      statusText: 'OK',
      headers: { 'x-cache': 'HIT', etag: cached.etag },
      data: cached.data,
      ok: true,
    };
  }

  // If cached but expired, send conditional request with If-None-Match
  const requestCtx = cached
    ? {
        ...ctx,
        headers: {
          ...ctx.headers,
          'if-none-match': cached.etag,
        },
      }
    : ctx;

  if (cached) {
    console.log(`🔄 Conditional request with If-None-Match: ${cached.etag}`);
  } else {
    console.log(`🔍 Cache MISS: ${ctx.url}`);
  }

  const response = await next(requestCtx);

  // Handle 304 Not Modified
  if (response.status === 304 && cached) {
    console.log('✅ 304 Not Modified - using cached data');
    // Update expiry but keep data
    etagCache.set(cacheKey, {
      ...cached,
      expires: Date.now() + 10000, // Extend TTL
    });
    return {
      status: 200,
      statusText: 'OK',
      headers: { 'x-cache': 'REVALIDATED', etag: cached.etag },
      data: cached.data,
      ok: true,
    };
  }

  // Cache successful responses with ETag
  if (response.ok && response.headers['etag']) {
    etagCache.set(cacheKey, {
      data: response.data,
      etag: response.headers['etag'] as string,
      expires: Date.now() + 10000,
    });
  }

  return { ...response, headers: { ...response.headers, 'x-cache': 'MISS' } };
};

const api2 = client(http('http://localhost:3001'), etagCachePolicy);

// First request
const response2a = await api2.get('/etag/abc123', parse.json());
console.log(`Response 2a - Cache: ${response2a.headers['x-cache']}\n`);

// Second request (within TTL)
const response2b = await api2.get('/etag/abc123', parse.json());
console.log(`Response 2b - Cache: ${response2b.headers['x-cache']}\n`);

// Example 3: Selective caching based on headers
console.log('📊 Example 3: Selective caching (Cache-Control aware)\n');

const selectiveCache = new Map<string, { data: unknown; expires: number }>();

const cacheControlPolicy: Policy = async (ctx, next) => {
  if (ctx.method !== 'GET') {
    return next(ctx);
  }

  const cacheKey = ctx.url;
  const cached = selectiveCache.get(cacheKey);

  if (cached && Date.now() < cached.expires) {
    console.log(`💾 Cache HIT: ${ctx.url}`);
    return {
      status: 200,
      statusText: 'OK',
      headers: { 'x-cache': 'HIT' },
      data: cached.data,
      ok: true,
    };
  }

  console.log(`🔍 Cache MISS: ${ctx.url}`);

  const response = await next(ctx);

  // Parse Cache-Control header
  const cacheControl = response.headers['cache-control'];
  let maxAge = 0;
  let shouldCache = false;

  if (cacheControl) {
    // Check for no-store
    if (cacheControl.includes('no-store')) {
      console.log('⛔ no-store directive - not caching');
      return { ...response, headers: { ...response.headers, 'x-cache': 'BYPASS' } };
    }

    // Check for no-cache
    if (cacheControl.includes('no-cache')) {
      console.log('⚠️  no-cache directive - validation required');
    }

    // Extract max-age
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    if (maxAgeMatch?.[1]) {
      maxAge = Number.parseInt(maxAgeMatch[1], 10);
      shouldCache = maxAge > 0;
      console.log(`⏱️  max-age=${maxAge}s`);
    }
  }

  // Cache if we got max-age
  if (response.ok && shouldCache) {
    selectiveCache.set(cacheKey, {
      data: response.data,
      expires: Date.now() + maxAge * 1000,
    });
    console.log(`✅ Cached for ${maxAge}s`);
  }

  return { ...response, headers: { ...response.headers, 'x-cache': 'MISS' } };
};

const api3 = client(http('http://localhost:3001'), cacheControlPolicy);

await api3.get('/cache/30', parse.json());
console.log('');

// Example 4: LRU cache with size limit
console.log('📊 Example 4: LRU cache with size limit\n');

class LRUCache<T> {
  private cache = new Map<string, { data: T; expires: number }>();
  private accessOrder: string[] = [];

  constructor(private maxSize: number) {}

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry || Date.now() >= entry.expires) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    this.accessOrder.push(key);

    return entry.data;
  }

  set(key: string, data: T, ttl: number): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldest = this.accessOrder.shift();
      if (oldest) {
        this.cache.delete(oldest);
        console.log(`🗑️  Evicted oldest entry: ${oldest}`);
      }
    }

    this.cache.set(key, {
      data,
      expires: Date.now() + ttl,
    });

    // Update access order
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    this.accessOrder.push(key);
  }

  size(): number {
    return this.cache.size;
  }
}

const lruCache = new LRUCache<unknown>(3); // Max 3 entries

const lruCachePolicy: Policy = async (ctx, next) => {
  if (ctx.method !== 'GET') {
    return next(ctx);
  }

  const cached = lruCache.get(ctx.url);
  if (cached) {
    console.log(`💾 Cache HIT: ${ctx.url}`);
    return {
      status: 200,
      statusText: 'OK',
      headers: { 'x-cache': 'HIT' },
      data: cached,
      ok: true,
    };
  }

  console.log(`🔍 Cache MISS: ${ctx.url}`);

  const response = await next(ctx);

  if (response.ok) {
    lruCache.set(ctx.url, response.data, 60000); // 60s TTL
    console.log(`✅ Cached (cache size: ${lruCache.size()})`);
  }

  return { ...response, headers: { ...response.headers, 'x-cache': 'MISS' } };
};

const api4 = client(http('http://localhost:3001'), lruCachePolicy);

// Fill cache
await api4.get('/get?key=1', parse.json());
console.log('');
await api4.get('/get?key=2', parse.json());
console.log('');
await api4.get('/get?key=3', parse.json());
console.log('');

// This should evict key=1 (oldest)
await api4.get('/get?key=4', parse.json());
console.log('');

console.log('✨ Caching interceptors examples completed!');
console.log('\n💡 Caching strategies:');
console.log('1. Time-based expiration (TTL)');
console.log('2. ETag validation (conditional requests)');
console.log('3. Cache-Control header compliance');
console.log('4. LRU eviction for memory management');
console.log('5. Selective caching by method/status');
