/**
 * Pino Logging Integration Example
 * Demonstrates how to integrate pino logger with @unireq
 * Usage: pnpm example:logging-pino
 */

import type { Logger } from '@unireq/core';
import { client, log } from '@unireq/core';
import { http, parse } from '@unireq/http';
import pino from 'pino';

// Create pino instance with custom configuration
const pinoLogger = pino({
  level: 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});

// Adapter: Convert @unireq Logger interface to pino
// This shows the versatility of the Logger interface - any logger can be adapted
const pinoAdapter: Logger = {
  debug: (msg, meta) => pinoLogger.debug(meta, msg),
  info: (msg, meta) => pinoLogger.info(meta, msg),
  warn: (msg, meta) => pinoLogger.warn(meta, msg),
  error: (msg, meta) => pinoLogger.error(meta, msg),
};

console.log('📝 Pino Logging Integration Example\n');

// Example 1: Basic pino integration
console.log('📊 Example 1: Basic pino integration\n');

const api = client(
  http('https://jsonplaceholder.typicode.com'),
  log({
    logger: pinoAdapter,
    logBody: false, // Disable body logging for performance
    redactHeaders: ['Authorization', 'Cookie', 'X-Api-Key'],
  }),
  parse.json(),
);

await api.get('/posts/1');
console.log('');

// Example 2: Pino with child logger for request context
console.log('📊 Example 2: Pino with child logger for request context\n');

// Create a child logger with request-specific context
const requestLogger = pinoLogger.child({
  service: 'api-client',
  version: '1.0.0',
});

const contextualAdapter: Logger = {
  debug: (msg, meta) => requestLogger.debug(meta, msg),
  info: (msg, meta) => requestLogger.info(meta, msg),
  warn: (msg, meta) => requestLogger.warn(meta, msg),
  error: (msg, meta) => requestLogger.error(meta, msg),
};

const apiWithContext = client(
  http('https://jsonplaceholder.typicode.com'),
  log({
    logger: contextualAdapter,
    logBody: true,
  }),
  parse.json(),
);

await apiWithContext.get('/users/1');
console.log('');

// Example 3: Custom log levels for different events
console.log('📊 Example 3: Custom log levels for different events\n');

// Create a specialized logger that uses different levels for different events
const eventBasedAdapter: Logger = {
  debug: (msg, meta) => {
    // Trace-level for detailed debugging
    pinoLogger.trace(meta, msg);
  },
  info: (msg, meta) => {
    // Info for successful requests
    if (meta?.['duration'] !== undefined) {
      pinoLogger.info({ ...meta, type: 'http_response' }, msg);
    } else {
      pinoLogger.info({ ...meta, type: 'http_request' }, msg);
    }
  },
  warn: (msg, meta) => {
    // Warn for slow requests or retries
    pinoLogger.warn({ ...meta, alert: true }, msg);
  },
  error: (msg, meta) => {
    // Error with stack trace
    pinoLogger.error({ ...meta, alert: true, notify: true }, msg);
  },
};

const apiEventBased = client(
  http('https://jsonplaceholder.typicode.com'),
  log({
    logger: eventBasedAdapter,
    redactHeaders: ['Authorization'],
  }),
  parse.json(),
);

await apiEventBased.get('/posts/1');
await apiEventBased.post('/posts', {
  body: JSON.stringify({ title: 'Test', body: 'Content', userId: 1 }),
  headers: { 'Content-Type': 'application/json' },
});
console.log('');

console.log('✨ Pino logging examples completed!');
console.log('\n💡 Pino integration benefits:');
console.log('1. Structured JSON logs for production');
console.log('2. Child loggers for request context');
console.log('3. Pretty printing in development');
console.log('4. High performance with async logging');
console.log('5. Compatible with log aggregators (ELK, Datadog, etc.)');
