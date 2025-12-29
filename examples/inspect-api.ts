/**
 * Policy Inspection Example
 * Demonstrates how to inspect and visualize policy composition
 */

import { backoff, compose, inspect, retry } from '@unireq/core';
import { headers, http, httpRetryPredicate, parse, query, rateLimitDelay, timeout } from '@unireq/http';
import { oauthBearer } from '@unireq/oauth';

// Example 1: Simple policy chain
console.log('=== Example 1: Simple Policy Chain ===\n');

const simpleAPI = compose(
  headers({ 'user-agent': 'unireq-example/1.0' }),
  query({ apiVersion: '2025-01' }),
  parse.json(),
);

console.log('JSON format:');
console.log(inspect.json(simpleAPI));
console.log('\nTree format:');
console.log(inspect.tree(simpleAPI));

// Example 2: Complex policy chain with new retry architecture
console.log('\n\n=== Example 2: New Retry Architecture ===\n');

const complexAPI = compose(
  timeout(30000),
  retry(
    httpRetryPredicate({ statusCodes: [408, 429, 500, 502, 503, 504] }),
    [rateLimitDelay({ maxWait: 60000 }), backoff({ initial: 1000, max: 30000 })],
    { tries: 3 },
  ),
  oauthBearer({
    tokenSupplier: async () => 'mock-jwt-token',
    allowUnsafeMode: true, // Only for demo - use JWKS in production
  }),
  headers({
    'content-type': 'application/json',
    accept: 'application/json',
  }),
  parse.json(),
);

console.log('Note: retry() is now transport-agnostic from @unireq/core');
console.log('HTTP-specific logic uses httpRetryPredicate() internally\n');

console.log('JSON format (compact):');
const complexJSON = JSON.parse(inspect.json(complexAPI));
console.log(`${JSON.stringify(complexJSON, null, 2).split('\n').slice(0, 30).join('\n')}\n  ...`);

console.log('\nTree format:');
console.log(inspect.tree(complexAPI));

// Example 3: Inspect transport configuration
console.log('\n\n=== Example 3: Transport with Base URI ===\n');

const transportWithURI = http('https://api.github.com');

console.log('Tree format:');
console.log(inspect.tree(transportWithURI.transport));

// Example 4: Nested composition
console.log('\n\n=== Example 4: Nested Composition ===\n');

const authLayer = compose(
  oauthBearer({
    tokenSupplier: async () => 'mock-token',
    allowUnsafeMode: true,
  }),
  headers({ 'x-api-version': '2025-01' }),
);

const retryLayer = compose(
  retry(httpRetryPredicate(), [backoff({ initial: 500, max: 5000 })], { tries: 2 }),
  timeout(10000),
);

const fullPipeline = compose(retryLayer, authLayer, parse.json());

console.log('Tree format:');
console.log(inspect.tree(fullPipeline));

// Example 5: Verify policy presence
console.log('\n\n=== Example 5: Verify Policy Presence ===\n');

import { assertHas } from '@unireq/core';

try {
  assertHas(complexAPI, 'auth');
  console.log('✓ Auth policy found');
} catch {
  console.log('✗ Auth policy not found');
}

try {
  assertHas(complexAPI, 'retry');
  console.log('✓ Retry policy found');
} catch {
  console.log('✗ Retry policy not found');
}

try {
  assertHas(complexAPI, 'transport');
  console.log('✓ Transport found');
} catch {
  console.log('✗ Transport not found');
}

// Example 6: Generic retry from @unireq/core
console.log('\n\n=== Example 6: Generic Retry (Transport-Agnostic) ===\n');

const genericRetryAPI = compose(
  retry(
    httpRetryPredicate({ methods: ['GET'], statusCodes: [500, 502, 503] }),
    [backoff({ initial: 500, max: 5000 })],
    { tries: 2 },
  ),
  parse.json(),
);

console.log('Tree format:');
console.log(inspect.tree(genericRetryAPI));

console.log('\n💡 Key difference: retry() now in @unireq/core');
console.log('   - Works with any transport (HTTP, FTP, IMAP, etc.)');
console.log('   - Uses predicates to determine retry conditions');
console.log('   - HTTP-specific logic in httpRetryPredicate()');

// Example 7: Introspecting retry predicates and strategies
console.log('\n\n=== Example 7: Introspecting Retry Predicates and Strategies ===\n');

import { getInspectableMeta } from '@unireq/core';

const retryWithDetails = retry(
  httpRetryPredicate({
    methods: ['GET', 'PUT'],
    statusCodes: [429, 500, 502, 503],
    maxBodySize: 1024 * 1024, // 1MB
  }),
  [rateLimitDelay({ maxWait: 60000 }), backoff({ initial: 1000, max: 30000, multiplier: 2 })],
  { tries: 4 },
);

console.log('Tree format:');
console.log(inspect.tree(retryWithDetails));

console.log('\nDetailed JSON format:');
const retryJSON = JSON.parse(inspect.json(retryWithDetails));
console.log(JSON.stringify(retryJSON, null, 2));

console.log('\n🔍 Inspecting individual components:');

const predicate = httpRetryPredicate({ statusCodes: [500, 502, 503] });
const predicateMeta = getInspectableMeta(predicate);
console.log('\nPredicate metadata:');
console.log(JSON.stringify(predicateMeta, null, 2));

const strategy = backoff({ initial: 500, max: 10000 });
const strategyMeta = getInspectableMeta(strategy);
console.log('\nStrategy metadata:');
console.log(JSON.stringify(strategyMeta, null, 2));

console.log('\n💡 New Introspection Features:');
console.log('✨ Predicates: httpRetryPredicate() is now fully inspectable');
console.log('   - Exposes: methods, statusCodes, maxBodySize');
console.log('   - Type: "predicate"');
console.log('\n✨ Delay Strategies: backoff(), rateLimitDelay() are inspectable');
console.log('   - backoff: initial, max, multiplier, jitter');
console.log('   - rateLimitDelay: maxWait');
console.log('   - Type: "strategy"');
console.log('\n✨ Retry Policy: Now includes children (predicate + strategies)');
console.log('   - Full hierarchy visible');
console.log('   - All options and configuration exposed');

console.log('\n✅ Done!');
