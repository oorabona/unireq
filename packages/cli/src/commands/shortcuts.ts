/**
 * HTTP verb shortcut commands (get, post, put, patch, delete)
 */

import { defineCommand } from 'citty';
import { consola } from 'consola';
import { executeRequest } from '../executor.js';
import { exportRequest } from '../output/index.js';
import type { HttpMethod } from '../types.js';
import { handleRequest, parseExportFormat, parseOutputMode } from './request.js';

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
  output: {
    type: 'string' as const,
    description: 'Output mode: pretty (default), json, raw',
    alias: 'o',
  },
  trace: {
    type: 'boolean' as const,
    description: 'Show timing information',
    default: false,
  },
  export: {
    type: 'string' as const,
    description: 'Export request as command: curl, httpie',
    alias: 'e',
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
      const outputMode = parseOutputMode(args.output as string | undefined);
      const exportFormat = parseExportFormat(args.export as string | undefined);

      // Use shared handler
      const request = handleRequest(method, url, {
        header: args.header as string | string[] | undefined,
        query: args.query as string | string[] | undefined,
        body: args.body as string | undefined,
        timeout: args.timeout as string | undefined,
        output: outputMode,
        trace: args.trace as boolean,
      });

      // Export mode: display command instead of executing
      if (exportFormat) {
        const exported = exportRequest(request, exportFormat);
        consola.log(exported);
        return;
      }

      // Execute the request - exit with code 1 on error
      const result = await executeRequest(request);
      if (result === undefined) {
        process.exitCode = 1;
      }
    },
  });
}
