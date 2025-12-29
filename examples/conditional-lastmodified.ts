/**
 * Conditional Requests - Last-Modified example
 * Demonstrates Last-Modified-based HTTP caching with conditional requests
 * Usage: pnpm example:conditional-lastmodified
 */

import { client } from '@unireq/core';
import { http, lastModified, parse } from '@unireq/http';

console.log('📅 Conditional Requests - Last-Modified Examples\n');

// Example 1: Basic Last-Modified caching
console.log('📊 Example 1: Basic Last-Modified caching\n');

const cache1 = new Map();
const api1 = client(http('http://localhost:3001'), lastModified({ cache: cache1, ttl: 10000 }));

// First request - cache miss
console.log('Making first request...');
const response1a = await api1.get(
  '/response-headers?Last-Modified=Wed,%2021%20Oct%202015%2007:28:00%20GMT',
  parse.json(),
);
console.log(`Response status: ${response1a.status}`);
console.log(`Cache status: ${response1a.headers['x-cache'] || 'MISS'}`);
console.log(`Last-Modified: ${response1a.headers['last-modified']}\n`);

// Second request - cache hit (within TTL)
console.log('Making second request (within TTL)...');
const response1b = await api1.get(
  '/response-headers?Last-Modified=Wed,%2021%20Oct%202015%2007:28:00%20GMT',
  parse.json(),
);
console.log(`Response status: ${response1b.status}`);
console.log(`Cache status: ${response1b.headers['x-cache']}`);
console.log(`Last-Modified: ${response1b.headers['last-modified']}\n`);

// Example 2: Cache expiration
console.log('📊 Example 2: Cache expiration and revalidation\n');

const cache2 = new Map();
const api2 = client(
  http('http://localhost:3001'),
  lastModified({ cache: cache2, ttl: 1000 }), // 1 second TTL
);

console.log('Making first request...');
const response2a = await api2.get(
  '/response-headers?Last-Modified=Thu,%2015%20Jan%202025%2012:00:00%20GMT',
  parse.json(),
);
console.log(`Cache status: ${response2a.headers['x-cache'] || 'MISS'}`);
console.log(`Last-Modified: ${response2a.headers['last-modified']}\n`);

console.log('Waiting 2 seconds for cache to expire...');
await new Promise((resolve) => setTimeout(resolve, 2000));

console.log('Making second request (cache expired)...');
const response2b = await api2.get(
  '/response-headers?Last-Modified=Thu,%2015%20Jan%202025%2012:00:00%20GMT',
  parse.json(),
);
console.log(`Cache status: ${response2b.headers['x-cache'] || 'MISS'}`);
console.log('(httpbin.org echoes back the Last-Modified we send)\n');

// Example 3: Simulated cache revalidation
console.log('📊 Example 3: Understanding cache revalidation\n');

console.log('How Last-Modified cache revalidation works:');
console.log('1. First request: Server sends Last-Modified header, client caches it');
console.log('2. Cache expires after TTL');
console.log('3. Next request: Client sends If-Modified-Since with cached timestamp');
console.log('4. If unchanged: Server responds 304 Not Modified, client uses cached data');
console.log('5. If changed: Server responds 200 OK with new data and timestamp\n');

// Example 4: Multiple resources with monitoring
console.log('📊 Example 4: Multiple resources with cache monitoring\n');

const stats = {
  cacheHits: 0,
  revalidations: 0,
  cacheMisses: 0,
};

const cache4 = new Map();
const api4 = client(
  http('http://localhost:3001'),
  lastModified({
    cache: cache4,
    ttl: 60000,
    onCacheHit: (cacheKey, lastModified) => {
      stats.cacheHits++;
      console.log(`💾 Cache HIT: ${cacheKey}`);
      console.log(`   Last-Modified: ${lastModified}`);
    },
    onRevalidated: (cacheKey, lastModified) => {
      stats.revalidations++;
      console.log(`🔄 Revalidated: ${cacheKey}`);
      console.log(`   Last-Modified: ${lastModified}`);
    },
  }),
);

const resources = [
  '/response-headers?Last-Modified=Mon,%2001%20Jan%202024%2000:00:00%20GMT',
  '/response-headers?Last-Modified=Tue,%2001%20Feb%202024%2000:00:00%20GMT',
  '/response-headers?Last-Modified=Wed,%2001%20Mar%202024%2000:00:00%20GMT',
];

console.log('Caching multiple resources...\n');
for (const resource of resources) {
  stats.cacheMisses++;
  await api4.get(resource, parse.json());
}

console.log('\nAccessing cached resources...\n');
for (const resource of resources) {
  await api4.get(resource, parse.json());
}

console.log('\nCache statistics:');
console.log(`  Cache misses: ${stats.cacheMisses}`);
console.log(`  Cache hits: ${stats.cacheHits}`);
console.log(`  Revalidations: ${stats.revalidations}`);
console.log(`  Total requests: ${stats.cacheMisses + stats.cacheHits + stats.revalidations}\n`);

// Example 5: Comparison with ETag
console.log('📊 Example 5: Last-Modified vs ETag\n');

console.log('Last-Modified characteristics:');
console.log('✅ Simple timestamp-based validation');
console.log('✅ Widely supported by servers');
console.log('✅ Good for file-based content');
console.log('⚠️  Limited to 1-second precision');
console.log('⚠️  May not detect sub-second changes');
console.log('⚠️  Clock skew issues possible\n');

console.log('When to use Last-Modified:');
console.log('- Static files (images, CSS, JS)');
console.log('- Content that changes infrequently');
console.log('- Legacy systems without ETag support');
console.log('- Simple caching needs\n');

console.log('When to prefer ETag:');
console.log('- Dynamic content that changes frequently');
console.log('- Content that may change multiple times per second');
console.log('- When exact validation is critical');
console.log('- Modern APIs and services\n');

// Example 6: Best practices
console.log('📊 Example 6: Best practices\n');

console.log('Cache TTL guidelines:');
console.log('- Static assets: 1 hour - 1 year');
console.log('- API responses: 5-60 minutes');
console.log('- Dynamic content: 1-5 minutes');
console.log('- Real-time data: 10-30 seconds\n');

const cache6 = new Map();
const apiWithBestPractices = client(
  http('http://localhost:3001'),
  lastModified({
    cache: cache6,
    ttl: 300000, // 5 minutes for API responses
    getCacheKey: (ctx) => {
      // Include relevant parts of URL
      const url = new URL(ctx.url, 'http://dummy');
      return `${ctx.method}:${url.pathname}${url.search}`;
    },
    onCacheHit: (cacheKey) => {
      console.log(`✅ Served from cache: ${cacheKey}`);
    },
    onRevalidated: (cacheKey) => {
      console.log(`🔄 Cache revalidated: ${cacheKey}`);
    },
  }),
);

console.log('Making request with best practices...');
await apiWithBestPractices.get('/response-headers?Last-Modified=Thu,%2017%20Oct%202024%2010:30:00%20GMT', parse.json());
await apiWithBestPractices.get('/response-headers?Last-Modified=Thu,%2017%20Oct%202024%2010:30:00%20GMT', parse.json());

console.log('\n✨ Last-Modified conditional requests examples completed!');
console.log('\n💡 Last-Modified benefits:');
console.log('1. Simple and widely supported');
console.log('2. Reduces bandwidth usage');
console.log('3. Improves response times');
console.log('4. Works well for static content');
console.log('5. Easy to implement on servers');
