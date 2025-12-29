/**
 * Conditional Requests - Combined example
 * Demonstrates automatic selection between ETag and Last-Modified
 * Usage: pnpm example:conditional-combined
 */

import { client } from '@unireq/core';
import { conditional, http, parse } from '@unireq/http';

console.log('🔀 Conditional Requests - Combined (ETag + Last-Modified) Examples\n');

// Example 1: Automatic selection based on response headers
console.log('📊 Example 1: Automatic header-based caching\n');

const api1 = client(http('http://localhost:3001'), conditional({ ttl: 10000 }));

console.log('The conditional() policy automatically uses:');
console.log('- ETag if server provides it (preferred)');
console.log('- Last-Modified as fallback');
console.log('- No caching if neither header is present\n');

// Request with ETag
console.log('Request 1: Endpoint with ETag header');
const response1a = await api1.get('/etag/value1', parse.json());
console.log(`Cache: ${response1a.headers['x-cache'] || 'MISS'}`);
console.log(`ETag: ${response1a.headers['etag']}\n`);

// Same request - should use ETag cache
console.log('Request 1 again (should use ETag cache):');
const response1b = await api1.get('/etag/value1', parse.json());
console.log(`Cache: ${response1b.headers['x-cache']}`);
console.log(`ETag: ${response1b.headers['etag']}\n`);

// Request with Last-Modified
console.log('Request 2: Endpoint with Last-Modified header');
const response2a = await api1.get(
  '/response-headers?Last-Modified=Wed,%2021%20Oct%202015%2007:28:00%20GMT',
  parse.json(),
);
console.log(`Cache: ${response2a.headers['x-cache'] || 'MISS'}`);
console.log(`Last-Modified: ${response2a.headers['last-modified']}\n`);

// Same request - should use Last-Modified cache
console.log('Request 2 again (should use Last-Modified cache):');
const response2b = await api1.get(
  '/response-headers?Last-Modified=Wed,%2021%20Oct%202015%2007:28:00%20GMT',
  parse.json(),
);
console.log(`Cache: ${response2b.headers['x-cache']}`);
console.log(`Last-Modified: ${response2b.headers['last-modified']}\n`);

// Example 2: Mixed content with monitoring
console.log('📊 Example 2: Mixed content types with monitoring\n');

const stats = {
  etagCached: 0,
  lastModCached: 0,
  notCached: 0,
  cacheHits: 0,
};

const api2 = client(
  http('http://localhost:3001'),
  conditional({
    ttl: 60000,
    onCacheHit: (cacheKey) => {
      stats.cacheHits++;
      console.log(`💾 Cache HIT: ${cacheKey}`);
    },
  }),
);

// Simulate different types of resources
const resources = [
  { url: '/etag/api-response', type: 'ETag' },
  { url: '/response-headers?Last-Modified=Mon,%2001%20Jan%202024%2000:00:00%20GMT', type: 'Last-Modified' },
  { url: '/etag/dynamic-content', type: 'ETag' },
  { url: '/response-headers?Last-Modified=Tue,%2002%20Jan%202024%2000:00:00%20GMT', type: 'Last-Modified' },
];

console.log('Caching different resource types...\n');
for (const resource of resources) {
  const response = await api2.get(resource.url, parse.json());
  const cached = response.headers['x-cache'] !== 'HIT';

  if (cached) {
    if (response.headers['etag']) {
      stats.etagCached++;
    } else if (response.headers['last-modified']) {
      stats.lastModCached++;
    } else {
      stats.notCached++;
    }
  }

  console.log(`${resource.type}: ${resource.url.substring(0, 40)}...`);
  console.log(`  Cached: ${cached ? 'Yes' : 'No'}`);
  console.log(
    `  Method: ${response.headers['etag'] ? 'ETag' : response.headers['last-modified'] ? 'Last-Modified' : 'None'}`,
  );
}

console.log('\nAccessing cached resources again...\n');
for (const resource of resources) {
  await api2.get(resource.url, parse.json());
}

console.log('\nCache statistics:');
console.log(`  ETag cached: ${stats.etagCached}`);
console.log(`  Last-Modified cached: ${stats.lastModCached}`);
console.log(`  Not cached: ${stats.notCached}`);
console.log(`  Cache hits: ${stats.cacheHits}\n`);

// Example 3: Performance comparison
console.log('📊 Example 3: Performance comparison\n');

console.log('Measuring cache performance...\n');

const nocacheApi = client(http('http://localhost:3001'));
const cachedApi = client(http('http://localhost:3001'), conditional({ ttl: 60000 }));

// Warm up cache
await cachedApi.get('/etag/perf-test', parse.json());

// Test uncached requests
const uncachedStart = Date.now();
for (let i = 0; i < 3; i++) {
  await nocacheApi.get('/etag/perf-test', parse.json());
}
const uncachedTime = Date.now() - uncachedStart;

// Test cached requests
const cachedStart = Date.now();
for (let i = 0; i < 3; i++) {
  await cachedApi.get('/etag/perf-test', parse.json());
}
const cachedTime = Date.now() - cachedStart;

console.log('Results (3 requests each):');
console.log(`  Without cache: ${uncachedTime}ms`);
console.log(`  With cache: ${cachedTime}ms`);
console.log(`  Speedup: ${(uncachedTime / cachedTime).toFixed(1)}x faster`);
console.log(`  Time saved: ${uncachedTime - cachedTime}ms\n`);

// Example 4: Cache invalidation strategies
console.log('📊 Example 4: Cache invalidation strategies\n');

const cache4 = new Map();

console.log('Strategy 1: Time-based expiration (TTL)');
console.log('- Set appropriate TTL based on content type');
console.log('- Short TTL (5-60s) for dynamic content');
console.log('- Long TTL (1h-1d) for static content\n');

console.log('Strategy 2: Manual cache clearing');
console.log(`- Current cache size: ${cache4.size} entries`);
cache4.clear();
console.log(`- After clear: ${cache4.size} entries\n`);

console.log('Strategy 3: Selective invalidation');
console.log('- Remove specific entries when data changes');
console.log('- Use cache.delete(key) for targeted invalidation\n');

console.log('Strategy 4: Cache-Control headers');
console.log('- Server can set Cache-Control: no-cache to force revalidation');
console.log('- Server can set Cache-Control: no-store to prevent caching');
console.log('- Client should respect these directives\n');

// Example 5: Best practices
console.log('📊 Example 5: Production best practices\n');

const productionCache = new Map();
const productionApi = client(
  http('http://localhost:3001'),
  conditional({
    cache: productionCache,
    ttl: 300000, // 5 minutes
    getCacheKey: (ctx) => {
      // Custom cache key with query params
      const url = new URL(ctx.url, 'http://dummy');
      return `${ctx.method}:${url.pathname}${url.search}`;
    },
    onCacheHit: (cacheKey, _etag) => {
      // Log cache hits for monitoring
      console.log(`✅ Cache hit: ${cacheKey}`);
    },
    onRevalidated: (cacheKey, _etag) => {
      // Log revalidations for monitoring
      console.log(`🔄 Revalidated: ${cacheKey}`);
    },
  }),
);

console.log('Production checklist:');
console.log('✅ Set appropriate TTL based on content type');
console.log('✅ Use custom cache keys to avoid collisions');
console.log('✅ Monitor cache hit/miss ratio');
console.log('✅ Implement cache invalidation strategy');
console.log('✅ Respect Cache-Control headers');
console.log('✅ Log cache operations for debugging');
console.log('✅ Set cache size limits if needed');
console.log('✅ Handle cache errors gracefully\n');

console.log('Making production-ready request...');
await productionApi.get('/etag/production', parse.json());
await productionApi.get('/etag/production', parse.json());

console.log('\n✨ Combined conditional requests examples completed!');
console.log('\n💡 Key takeaways:');
console.log('1. Use conditional() for automatic ETag/Last-Modified selection');
console.log('2. ETags are preferred when available');
console.log('3. Last-Modified is a good fallback');
console.log('4. Set appropriate TTL based on content type');
console.log('5. Monitor cache performance for optimization');
console.log('6. Implement cache invalidation strategy');
console.log('7. Conditional requests reduce bandwidth and latency significantly');
