/**
 * Conditional Requests - ETag example
 * Demonstrates ETag-based HTTP caching with conditional requests
 * Usage: pnpm example:conditional-etag
 */

import { client } from '@unireq/core';
import { etag, http, parse } from '@unireq/http';

console.log('🏷️  Conditional Requests - ETag Examples\n');

// Example 1: Basic ETag caching
console.log('📊 Example 1: Basic ETag caching\n');

const cache1 = new Map();
const api1 = client(http('http://localhost:3001'), etag({ cache: cache1, ttl: 10000 }));

// First request - cache miss
console.log('Making first request...');
const response1a = await api1.get('/etag/abc123', parse.raw());
console.log(`Response status: ${response1a.status}`);
console.log(`Cache status: ${response1a.headers['x-cache'] || 'MISS'}`);
console.log(`ETag: ${response1a.headers['etag']}\n`);

// Second request - cache hit (within TTL)
console.log('Making second request (within TTL)...');
const response1b = await api1.get('/etag/abc123', parse.raw());
console.log(`Response status: ${response1b.status}`);
console.log(`Cache status: ${response1b.headers['x-cache']}`);
console.log(`ETag: ${response1b.headers['etag']}\n`);

// Example 2: Cache expiration and revalidation
console.log('📊 Example 2: Cache expiration and revalidation\n');

const cache2 = new Map();
const api2 = client(
  http('http://localhost:3001'),
  etag({ cache: cache2, ttl: 1000 }), // 1 second TTL
);

console.log('Making first request...');
const response2a = await api2.get('/etag/xyz789', parse.raw());
console.log(`Cache status: ${response2a.headers['x-cache'] || 'MISS'}\n`);

console.log('Waiting 2 seconds for cache to expire...');
await new Promise((resolve) => setTimeout(resolve, 2000));

console.log('Making second request (cache expired, should revalidate)...');
const response2b = await api2.get('/etag/xyz789', parse.raw());
console.log(`Cache status: ${response2b.headers['x-cache'] || 'MISS'}`);
console.log('Note: httpbin.org always returns the same ETag for /etag/:value\n');

// Example 3: Multiple resources with different ETags
console.log('📊 Example 3: Multiple resources with different ETags\n');

const cache3 = new Map();
const api3 = client(http('http://localhost:3001'), etag({ cache: cache3, ttl: 60000 }));

const endpoints = ['/etag/resource1', '/etag/resource2', '/etag/resource3'];

console.log('Caching multiple resources...');
for (const endpoint of endpoints) {
  const response = await api3.get(endpoint, parse.raw());
  console.log(`${endpoint}: ETag=${response.headers['etag']}, Cache=${response.headers['x-cache'] || 'MISS'}`);
}

console.log('\nAccessing cached resources again...');
for (const endpoint of endpoints) {
  const response = await api3.get(endpoint, parse.raw());
  console.log(`${endpoint}: Cache=${response.headers['x-cache']}`);
}
console.log('');

// Example 4: ETag with callbacks for monitoring
console.log('📊 Example 4: ETag with monitoring callbacks\n');

const stats = {
  cacheHits: 0,
  revalidations: 0,
  requests: 0,
};

const cache4 = new Map();
const api4 = client(
  http('http://localhost:3001'),
  etag({
    cache: cache4,
    ttl: 5000,
    onCacheHit: (cacheKey, etag) => {
      stats.cacheHits++;
      console.log(`💾 Cache HIT: ${cacheKey} (ETag: ${etag})`);
    },
    onRevalidated: (cacheKey, etag) => {
      stats.revalidations++;
      console.log(`🔄 Revalidated: ${cacheKey} (ETag: ${etag})`);
    },
  }),
);

console.log('Making requests to track cache performance...\n');

// First request
stats.requests++;
await api4.get('/etag/monitor1', parse.raw());

// Cache hit
stats.requests++;
await api4.get('/etag/monitor1', parse.raw());

// Another cache hit
stats.requests++;
await api4.get('/etag/monitor1', parse.raw());

console.log('\nCache statistics:');
console.log(`  Total requests: ${stats.requests}`);
console.log(`  Cache hits: ${stats.cacheHits}`);
console.log(`  Revalidations: ${stats.revalidations}`);
console.log(`  Cache hit rate: ${((stats.cacheHits / stats.requests) * 100).toFixed(1)}%\n`);

// Example 5: Custom cache key generation
console.log('📊 Example 5: Custom cache key generation\n');

const cache5 = new Map();
const api5 = client(
  http('http://localhost:3001'),
  etag({
    cache: cache5,
    ttl: 10000,
    getCacheKey: (ctx) => {
      // Custom key that ignores query parameters
      const url = new URL(ctx.url, 'http://dummy');
      return `${ctx.method}:${url.pathname}`;
    },
  }),
);

console.log('Requesting same resource with different query params...');
const response5a = await api5.get('/etag/custom?v=1', parse.raw());
console.log(`/etag/custom?v=1: Cache=${response5a.headers['x-cache'] || 'MISS'}`);

const response5b = await api5.get('/etag/custom?v=2', parse.raw());
console.log(`/etag/custom?v=2: Cache=${response5b.headers['x-cache']}`);
console.log('(Both use same cache key since query params are ignored)\n');

console.log('✨ ETag conditional requests examples completed!');
console.log('\n💡 ETag benefits:');
console.log('1. Reduces bandwidth - server can respond with 304 Not Modified');
console.log('2. Reduces latency - cached data returned immediately');
console.log('3. Strong validation - exact match required');
console.log('4. Works with dynamic content');
console.log('5. Saves server resources - no need to regenerate response');
