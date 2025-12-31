/**
 * Request command - executes HTTP request
 */

import { defineCommand } from 'citty';
import { consola } from 'consola';
import type { HttpMethod, ParsedRequest } from '../types.js';

/**
 * Valid HTTP methods (uppercase)
 */
const VALID_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

/**
 * Parse and validate HTTP method
 */
function parseMethod(method: string): HttpMethod {
  const upper = method.toUpperCase();
  if (!VALID_METHODS.has(upper)) {
    throw new Error(`Invalid HTTP method: ${method}. Valid methods: ${[...VALID_METHODS].join(', ')}`);
  }
  return upper as HttpMethod;
}

/**
 * Collect array option (handles string or string[])
 */
function collectArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Request subcommand - executes HTTP request with method and URL
 */
export const requestCommand = defineCommand({
  meta: {
    name: 'request',
    description: 'Execute HTTP request',
  },
  args: {
    method: {
      type: 'positional',
      description: 'HTTP method (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)',
      required: true,
    },
    url: {
      type: 'positional',
      description: 'Target URL (absolute or relative)',
      required: true,
    },
    header: {
      type: 'string',
      description: 'Add header (key:value), repeatable',
      alias: 'H',
    },
    query: {
      type: 'string',
      description: 'Add query param (key=value), repeatable',
      alias: 'q',
    },
    body: {
      type: 'string',
      description: 'Request body (JSON string or @filepath)',
      alias: 'b',
    },
    timeout: {
      type: 'string',
      description: 'Request timeout in milliseconds',
      alias: 't',
    },
  },
  run({ args }) {
    // Parse and validate method
    const method = parseMethod(args.method as string);
    const url = args.url as string;

    // Collect headers and query params (may be single string or array)
    const headers = collectArray(args.header as string | string[] | undefined);
    const query = collectArray(args.query as string | string[] | undefined);

    // Build parsed request
    const request: ParsedRequest = {
      method,
      url,
      headers,
      query,
      body: args.body as string | undefined,
      timeout: args.timeout ? Number.parseInt(args.timeout as string, 10) : undefined,
    };

    // Placeholder output - actual execution is Task 1.4
    printParsedRequest(request);
  },
});

/**
 * Print parsed request to console (placeholder output)
 * Shared between request command and shortcuts
 */
export function printParsedRequest(request: ParsedRequest): void {
  consola.info('Parsed request:');
  consola.log(`  Method: ${request.method}`);
  consola.log(`  URL: ${request.url}`);
  if (request.headers.length > 0) {
    consola.log(`  Headers: ${request.headers.join(', ')}`);
  }
  if (request.query.length > 0) {
    consola.log(`  Query: ${request.query.join(', ')}`);
  }
  if (request.body) {
    consola.log(`  Body: ${request.body}`);
  }
  if (request.timeout) {
    consola.log(`  Timeout: ${request.timeout}ms`);
  }
  consola.warn('Request execution not yet implemented - see Task 1.4');
}

/**
 * Execute request handler (shared between request and shortcuts)
 * Returns parsed request for testing
 */
export function handleRequest(
  method: HttpMethod,
  url: string,
  options: {
    header?: string | string[];
    query?: string | string[];
    body?: string;
    timeout?: string;
  },
): ParsedRequest {
  const headers = collectArray(options.header);
  const query = collectArray(options.query);

  return {
    method,
    url,
    headers,
    query,
    body: options.body,
    timeout: options.timeout ? Number.parseInt(options.timeout, 10) : undefined,
  };
}
