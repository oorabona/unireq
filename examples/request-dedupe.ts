/**
 * Request Deduplication Example
 *
 * Demonstrates how to deduplicate identical in-flight requests
 * to reduce network load and improve performance.
 *
 * Run: pnpm tsx examples/request-dedupe.ts
 */

import { client } from '@unireq/core';
import { dedupe, http, parse } from '@unireq/http';

async function main() {
  console.log('=== Request Deduplication Example ===\n');

  // Create client with deduplication
  const api = client(
    http('https://jsonplaceholder.typicode.com'),
    dedupe({
      ttl: 100, // Dedupe window in ms
      methods: ['GET', 'HEAD'], // Only dedupe these methods
    }),
    parse.json(),
  );

  // Example 1: Multiple identical requests
  console.log('--- Example 1: Identical Concurrent Requests ---');

  console.log('Sending 5 identical GET /posts/1 requests concurrently...');
  const startTime = Date.now();

  const results = await Promise.all([
    api.get<{ id: number; title: string }>('/posts/1'),
    api.get<{ id: number; title: string }>('/posts/1'),
    api.get<{ id: number; title: string }>('/posts/1'),
    api.get<{ id: number; title: string }>('/posts/1'),
    api.get<{ id: number; title: string }>('/posts/1'),
  ]);

  console.log(`Completed in ${Date.now() - startTime}ms`);
  console.log(`All responses have same data: ${results.every((r) => r.data.id === 1)}`);
  console.log(`All responses are same object reference: ${results.every((r) => r === results[0])}`);

  // Example 2: Different URLs are not deduped
  console.log('\n--- Example 2: Different URLs (No Deduplication) ---');

  console.log('Sending requests to different URLs...');
  const differentUrls = await Promise.all([api.get('/posts/1'), api.get('/posts/2'), api.get('/posts/3')]);

  console.log(`Got ${differentUrls.length} different responses`);
  console.log(`IDs: ${differentUrls.map((r) => (r.data as { id: number }).id).join(', ')}`);

  // Example 3: Custom key generator
  console.log('\n--- Example 3: Custom Key Generator ---');

  const apiWithCustomKey = client(
    http('https://jsonplaceholder.typicode.com'),
    dedupe({
      // Ignore query params for deduplication
      key: (ctx) => {
        const url = new URL(ctx.url);
        return `${ctx.method}:${url.pathname}`;
      },
      ttl: 200,
    }),
    parse.json(),
  );

  console.log('Sending requests with different query params (same path)...');
  const [r1, r2, r3] = await Promise.all([
    apiWithCustomKey.get('/posts/1?_t=1'),
    apiWithCustomKey.get('/posts/1?_t=2'),
    apiWithCustomKey.get('/posts/1?_t=3'),
  ]);

  console.log(`All responses same reference (query params ignored): ${r1 === r2 && r2 === r3}`);

  // Example 4: POST requests are not deduped by default
  console.log('\n--- Example 4: POST Requests (No Default Deduplication) ---');

  const apiForPost = client(
    http('https://jsonplaceholder.typicode.com'),
    dedupe(), // Default: only GET, HEAD
    parse.json(),
  );

  console.log('Sending 3 identical POST requests...');
  const postResults = await Promise.all([
    apiForPost.post('/posts', { title: 'Test', body: 'Content', userId: 1 }),
    apiForPost.post('/posts', { title: 'Test', body: 'Content', userId: 1 }),
    apiForPost.post('/posts', { title: 'Test', body: 'Content', userId: 1 }),
  ]);

  console.log(`POST responses are different objects: ${postResults[0] !== postResults[1]}`);
  console.log('(POST, PUT, DELETE mutations are NOT deduped by default for safety)');

  // Example 5: Rate limiting with deduplication
  console.log('\n--- Example 5: Integration with Other Policies ---');

  console.log(`
// Deduplication works well with other policies:

const api = client(
  http('https://api.example.com'),
  dedupe({ ttl: 100 }),      // First: dedupe requests
  throttle({ rps: 10 }),     // Then: throttle unique requests
  retry({ tries: 3 }),       // Then: retry failures
  cache({ ttl: 60000 }),     // Then: cache responses
  parse.json()
);

// The order matters:
// 1. dedupe: Prevents duplicate in-flight requests
// 2. throttle: Rate limits unique requests
// 3. retry: Retries failed unique requests
// 4. cache: Caches successful responses

// This combination provides:
// - Efficient network usage
// - Protection against thundering herd
// - Resilience to transient failures
// - Fast responses from cache
`);

  // Performance comparison
  console.log('\n--- Performance Comparison ---');

  // Without deduplication
  const withoutDedupeApi = client(http('https://jsonplaceholder.typicode.com'), parse.json());

  // Measure without dedupe
  const noDedupeStart = Date.now();
  await Promise.all([
    withoutDedupeApi.get('/posts/1'),
    withoutDedupeApi.get('/posts/1'),
    withoutDedupeApi.get('/posts/1'),
  ]);
  const noDedupeTime = Date.now() - noDedupeStart;

  // Measure with dedupe
  const dedupeStart = Date.now();
  await Promise.all([api.get('/posts/2'), api.get('/posts/2'), api.get('/posts/2')]);
  const dedupeTime = Date.now() - dedupeStart;

  console.log(`Without dedupe: ${noDedupeTime}ms (3 network requests)`);
  console.log(`With dedupe: ${dedupeTime}ms (1 network request)`);

  console.log('\n=== Deduplication Example Complete ===');
}

main().catch(console.error);
