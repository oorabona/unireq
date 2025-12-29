/**
 * Preset Builder example
 * Demonstrates the fluent builder API for configuring HTTP clients
 * Usage: pnpm example:preset-builder
 */

import { preset } from '@unireq/presets';

console.log('🔧 Preset Builder Examples\n');

// =============================================================================
// Example 1: Simple JSON API client with retry and timeout
// =============================================================================
console.log('Example 1: preset.api.json.retry.timeout pattern\n');

const simpleClient = preset.api.json.retry.timeout.build('https://jsonplaceholder.typicode.com');

try {
  const response = await simpleClient.get<{ id: number; title: string }>('/posts/1');
  console.log('✅ Simple client works!');
  console.log(`   Title: ${response.data.title}\n`);
} catch (error) {
  console.error('❌ Error:', error);
}

// =============================================================================
// Example 2: Custom configuration with methods
// =============================================================================
console.log('Example 2: Custom configuration with .withRetry() and .withTimeout()\n');

const customClient = preset.api.json
  .withRetry({ tries: 5, methods: ['GET', 'POST'] })
  .withTimeout(10000)
  .build('https://jsonplaceholder.typicode.com');

try {
  const response = await customClient.get<{ id: number; title: string }>('/posts/2');
  console.log('✅ Custom client works!');
  console.log(`   Title: ${response.data.title}\n`);
} catch (error) {
  console.error('❌ Error:', error);
}

// =============================================================================
// Example 3: Full-featured client with caching, logging, and redirect handling
// =============================================================================
console.log('Example 3: Full-featured client with all options\n');

const fullClient = preset.uri('https://jsonplaceholder.typicode.com').json.retry.timeout.cache.redirect.build();

try {
  const response = await fullClient.get<{ id: number; title: string }>('/posts/3');
  console.log('✅ Full-featured client works!');
  console.log(`   Title: ${response.data.title}\n`);
} catch (error) {
  console.error('❌ Error:', error);
}

// =============================================================================
// Example 4: Mixed property and method chaining
// =============================================================================
console.log('Example 4: Mixed property and method chaining\n');

const mixedClient = preset.api.json.retry // Use default retry (3 tries)
  .withTimeout(5000) // Custom timeout
  .withCache({ defaultTtl: 60000 }) // Custom cache TTL
  .build('https://jsonplaceholder.typicode.com');

try {
  const response = await mixedClient.get<{ id: number; title: string }>('/posts/4');
  console.log('✅ Mixed configuration client works!');
  console.log(`   Title: ${response.data.title}\n`);
} catch (error) {
  console.error('❌ Error:', error);
}

// =============================================================================
// Summary
// =============================================================================
console.log('📊 Preset Builder Patterns Summary:\n');

console.log('1️⃣  Property Chaining (defaults):');
console.log('   preset.api.json.retry.timeout.build(uri)');
console.log('   → Uses sensible defaults: 3 retries, 30s timeout\n');

console.log('2️⃣  Method Chaining (custom):');
console.log('   preset.api.json.withRetry({ tries: 5 }).withTimeout(10000).build(uri)');
console.log('   → Full control over configuration\n');

console.log('3️⃣  URI First:');
console.log('   preset.uri("https://api.example.com").json.retry.build()');
console.log('   → Set base URI upfront, call .build() without args\n');

console.log('4️⃣  Mixed Approach:');
console.log('   preset.api.json.retry.withTimeout(5000).cache.build(uri)');
console.log('   → Combine properties (defaults) and methods (custom)\n');

console.log('🎯 Available Options:');
console.log('   .json          - JSON request/response handling');
console.log('   .xml           - XML request/response handling');
console.log('   .retry         - Retry with exponential backoff (3 tries)');
console.log('   .timeout       - Request timeout (30s default)');
console.log('   .cache         - HTTP caching (5min TTL)');
console.log('   .logging       - Request/response logging');
console.log('   .redirect      - Safe redirect handling (307/308)');
console.log('   .oauth({...})  - OAuth2 Bearer authentication\n');

console.log('✨ Preset builder examples completed!');
