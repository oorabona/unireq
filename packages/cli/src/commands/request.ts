/**
 * Request command - executes HTTP request
 */

import { defineCommand } from 'citty';
import { executeRequest } from '../executor.js';
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
  async run({ args }) {
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

    // Execute the request
    await executeRequest(request);
  },
});

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
