/**
 * HTTP verb shortcut commands (get, post, put, patch, delete)
 */

import { defineCommand } from 'citty';
import { executeRequest } from '../executor.js';
import type { HttpMethod } from '../types.js';
import { handleRequest } from './request.js';

/**
 * Common request options shared by all HTTP shortcuts
 */
const requestArgs = {
  url: {
    type: 'positional' as const,
    description: 'Target URL (absolute or relative)',
    required: true,
  },
  header: {
    type: 'string' as const,
    description: 'Add header (key:value), repeatable',
    alias: 'H',
  },
  query: {
    type: 'string' as const,
    description: 'Add query param (key=value), repeatable',
    alias: 'q',
  },
  body: {
    type: 'string' as const,
    description: 'Request body (JSON string or @filepath)',
    alias: 'b',
  },
  timeout: {
    type: 'string' as const,
    description: 'Request timeout in milliseconds',
    alias: 't',
  },
};

/**
 * Create an HTTP verb shortcut command
 */
export function createHttpShortcut(method: HttpMethod) {
  return defineCommand({
    meta: {
      name: method.toLowerCase(),
      description: `${method} request shortcut`,
    },
    args: requestArgs,
    async run({ args }) {
      const url = args.url as string;

      // Use shared handler
      const request = handleRequest(method, url, {
        header: args.header as string | string[] | undefined,
        query: args.query as string | string[] | undefined,
        body: args.body as string | undefined,
        timeout: args.timeout as string | undefined,
      });

      // Execute the request
      await executeRequest(request);
    },
  });
}
