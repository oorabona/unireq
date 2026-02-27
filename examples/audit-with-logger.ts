/**
 * Audit Logging Example
 * Demonstrates the audit() policy for OWASP-compliant security logging,
 * and createLoggerAdapter() to bridge a standard Logger into audit.
 * Usage: pnpm example:audit
 */

import type { Logger } from '@unireq/core';
import { audit, client, createConsoleAuditLogger, createLoggerAdapter } from '@unireq/core';
import { http, parse } from '@unireq/http';

console.log('🔒 Audit Logging Example\n');

// ─── Example 1: Console audit logger (quick setup) ─────────────────────────

console.log('📊 Example 1: Console audit logger\n');

const api = client(
  http('https://jsonplaceholder.typicode.com'),
  audit({
    logger: createConsoleAuditLogger(),
    getUserId: (ctx) => ctx.headers['x-user-id'],
  }),
  parse.json(),
);

await api.get('/posts/1');
console.log('');

// ─── Example 2: Bridge a standard Logger into audit ─────────────────────────

console.log('📊 Example 2: createLoggerAdapter — reuse your existing logger\n');

// If you already have a Logger for the log() policy, reuse it for audit():
const myLogger: Logger = {
  debug: (msg, meta) => console.log(`  [DEBUG] ${msg}`, meta ? JSON.stringify(meta).slice(0, 80) : ''),
  info: (msg, meta) => console.log(`  [INFO]  ${msg}`, meta ? JSON.stringify(meta).slice(0, 80) : ''),
  warn: (msg, meta) => console.warn(`  [WARN]  ${msg}`, meta ? JSON.stringify(meta).slice(0, 80) : ''),
  error: (msg, meta) => console.error(`  [ERROR] ${msg}`, meta ? JSON.stringify(meta).slice(0, 80) : ''),
};

// createLoggerAdapter bridges Logger → AuditLogger:
// - severity critical/error → logger.error()
// - severity warn → logger.warn()
// - severity info → logger.info()
const auditedApi = client(
  http('https://jsonplaceholder.typicode.com'),
  audit({
    logger: createLoggerAdapter(myLogger),
    getUserId: (ctx) => ctx.headers['x-user-id'],
    logSuccess: true,
  }),
  parse.json(),
);

await auditedApi.get('/posts/1');
console.log('');

// ─── Example 3: Audit with suspicious activity detection ────────────────────

console.log('📊 Example 3: Suspicious activity detection\n');

const secureApi = client(
  http('https://jsonplaceholder.typicode.com'),
  audit({
    logger: createLoggerAdapter(myLogger),
    getUserId: (ctx) => ctx.headers['x-user-id'],
    getClientIp: (ctx) => ctx.headers['x-forwarded-for'],
    detectSuspiciousActivity: (_ctx, response) => {
      // Flag any 401/403 as suspicious for this demo
      return response !== undefined && (response.status === 401 || response.status === 403);
    },
  }),
  parse.json(),
);

await secureApi.get('/posts/1');
console.log('');

console.log('✨ Audit examples completed!');
console.log('\n💡 Key takeaways:');
console.log('1. createConsoleAuditLogger() for quick dev setup');
console.log('2. createLoggerAdapter(logger) to reuse your existing Logger');
console.log('3. detectSuspiciousActivity for custom security rules');
console.log('4. OWASP A09:2021 compliant structured logging');
