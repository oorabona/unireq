/**
 * Standard Logging Policy Example
 * Demonstrates the new standardized logging policy
 * Usage: pnpm example:logging-standard
 */

import type { Logger } from '@unireq/core';
import { client, log } from '@unireq/core';
import { http, parse } from '@unireq/http';

// Simple console logger implementation
const consoleLogger: Logger = {
  debug: (msg, meta) => console.debug(`[DEBUG] ${msg}`, meta),
  info: (msg, meta) => console.info(`[INFO] ${msg}`, meta),
  warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta),
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta),
};

console.log('📝 Standard Logging Policy Example\n');

const api = client(
  http('https://jsonplaceholder.typicode.com'),
  log({
    logger: consoleLogger,
    logBody: true, // Log request/response bodies
    redactHeaders: ['Authorization', 'Cookie'], // Redact sensitive headers
  }),
  parse.json(),
);

console.log('📡 Making request with logging enabled...\n');

try {
  await api.get('/posts/1');
  console.log('\n✅ Request completed successfully');
} catch (error) {
  console.error('\n❌ Request failed:', error);
}

console.log('\n✨ Logging example completed!');
