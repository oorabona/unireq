/**
 * HTTP verb shortcut commands (get, post, put, patch, delete)
 */

import { defineCommand } from 'citty';
import { consola } from 'consola';
import { executeRequest } from '../executor.js';
import { exportRequest } from '../output/index.js';
import { generateCittyArgs } from '../shared/http-options.js';
import type { HttpMethod } from '../types.js';
import { handleRequest, parseExportFormat, parseOutputMode } from './request.js';

/**
 * Common request options shared by all HTTP shortcuts
 * Generated from shared HTTP_OPTIONS definition (DRY)
 */
const requestArgs = generateCittyArgs();

/**
 * Create an HTTP verb shortcut command
 * Note: --help is intercepted in cli.ts before citty to show unified help
 */
export function createHttpShortcut(method: HttpMethod) {
  return defineCommand({
    meta: {
      name: method.toLowerCase(),
      description: `${method} request shortcut`,
    },
    args: requestArgs,
    async run({ args }) {
      const url = args['url'] as string;
      const outputMode = parseOutputMode(args['output'] as string | undefined);
      const exportFormat = parseExportFormat(args['export'] as string | undefined);

      // Use shared handler
      const request = handleRequest(method, url, {
        header: args['header'] as string | string[] | undefined,
        query: args['query'] as string | string[] | undefined,
        body: args['body'] as string | undefined,
        timeout: args['timeout'] as string | undefined,
        output: outputMode,
        trace: args['trace'] as boolean,
        includeHeaders: args['include'] as boolean,
        showSecrets: args['no-redact'] as boolean,
        showSummary: args['summary'] as boolean,
        hideBody: args['no-body'] as boolean,
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
