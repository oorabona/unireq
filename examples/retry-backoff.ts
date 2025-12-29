/**
 * Retry with exponential backoff example
 * Demonstrates the new transport-agnostic retry architecture
 * Shows both high-level retry() wrapper and low-level predicate approach
 * Usage: pnpm example:retry
 */

import { backoff, client, retry } from '@unireq/core';
import { http, httpRetryPredicate, parse, rateLimitDelay } from '@unireq/http';

console.log('📡 Retry with Exponential Backoff Examples\n');
console.log('🏗️  New Architecture: Transport-agnostic retry from @unireq/core\n');

// Example 1: High-level HTTP retry wrapper (recommended for HTTP)
console.log('Example 1: HTTP retry wrapper (recommended)\n');

const api1 = client(
  http('https://jsonplaceholder.typicode.com'),
  retry(
    httpRetryPredicate({ methods: ['GET', 'PUT', 'DELETE'] }),
    [backoff({ initial: 200, max: 2000, jitter: true })],
    { tries: 3 },
  ),
  parse.json(),
);

try {
  const response = await api1.get<{ id: number; title: string }>('/posts/1');
  console.log('✅ Request successful!');
  console.log(`Title: ${response.data.title}\n`);
} catch (error) {
  console.error('❌ Request failed after retries:', error);
}

// Example 2: Using custom HTTP predicate (advanced)
console.log('Example 2: Custom HTTP predicate (advanced)\n');

const api2 = client(
  http('https://jsonplaceholder.typicode.com'),
  retry(
    httpRetryPredicate({
      methods: ['GET', 'PUT', 'DELETE'],
      statusCodes: [408, 429, 500, 502, 503, 504],
      maxBodySize: 1024 * 1024, // 1MB max body size for retry
    }),
    [backoff({ initial: 200, max: 2000, jitter: true })],
    { tries: 3 },
  ),
  parse.json(),
);

try {
  const response = await api2.get<{ id: number; title: string }>('/posts/1');
  console.log('✅ Request with custom predicate successful!');
  console.log(`Title: ${response.data.title}\n`);
} catch (error) {
  console.error('❌ Request failed:', error);
}

// Example 3: Combined rate limit + backoff fallback
console.log('Example 3: Rate limit aware with backoff fallback\n');

const api3 = client(
  http('https://jsonplaceholder.typicode.com'),
  retry(
    httpRetryPredicate({
      methods: ['GET', 'PUT', 'DELETE'],
      statusCodes: [408, 429, 500, 502, 503, 504],
    }),
    [
      rateLimitDelay({ maxWait: 60000 }), // Try Retry-After first
      backoff({ initial: 200, max: 2000, jitter: true }), // Fallback to backoff
    ],
    { tries: 4 },
  ),
  parse.json(),
);

try {
  const response = await api3.get<{ id: number; title: string }>('/posts/1');
  console.log('✅ Request successful with smart retry!');
  console.log(`Title: ${response.data.title}\n`);
} catch (error) {
  console.error('❌ Request failed after retries:', error);
}

// Example 4: Transport-agnostic retry with custom predicate
console.log('Example 4: Generic retry (works with any transport)\n');

// Custom predicate that retries on any error or 5xx status
const customPredicate = (result: unknown, error: Error | null, _attempt: number, _ctx: unknown): boolean => {
  if (error !== null) return true; // Retry on network errors
  // biome-ignore lint/suspicious/noExplicitAny: result type is generic, need runtime check
  return Boolean(result && (result as any).status >= 500 && (result as any).status < 600); // Retry on 5xx
};

const api4 = client(
  http('https://jsonplaceholder.typicode.com'),
  retry(customPredicate, [backoff({ initial: 100, max: 1000 })], { tries: 2 }),
  parse.json(),
);

try {
  const response = await api4.get<{ id: number; title: string }>('/posts/1');
  console.log('✅ Request with generic retry successful!');
  console.log(`Title: ${response.data.title}\n`);
} catch (error) {
  console.error('❌ Request failed:', error);
}

console.log('📊 New Architecture Benefits:\n');
console.log('✨ Transport-Agnostic:');
console.log('  - retry() in @unireq/core works with HTTP, FTP, IMAP, etc.');
console.log('  - Same retry logic across all protocols\n');

console.log('🔧 Composable Predicates:');
console.log('  - httpRetryPredicate() for HTTP-specific logic');
console.log('  - Custom predicates for any retry condition');
console.log('  - Predicates receive (result, error, attempt, context)\n');

console.log('🔄 Flexible Strategies:');
console.log('  - backoff() - Exponential backoff with jitter');
console.log('  - rateLimitDelay() - Respects Retry-After header');
console.log('  - Multiple strategies evaluated in order\n');

console.log('🏗️  Separation of Concerns:');
console.log('  - Flow control (retry loop) → @unireq/core');
console.log('  - Protocol logic (HTTP predicates) → @unireq/http');
console.log('  - Delay strategies → composable and reusable\n');

console.log('✨ Retry examples completed!');
