/**
 * Request command - executes HTTP request
 */

import { defineCommand } from 'citty';
import { consola } from 'consola';
import { executeRequest } from '../executor.js';
import { type ExportFormat, exportRequest } from '../output/index.js';
import type { OutputMode } from '../output/types.js';
import type { HttpMethod, ParsedRequest } from '../types.js';

/**
 * Valid output modes
 */
const VALID_OUTPUT_MODES = new Set(['pretty', 'json', 'raw']);

/**
 * Valid export formats
 */
const VALID_EXPORT_FORMATS = new Set(['curl', 'httpie']);

/**
 * Parse and validate export format
 * @returns ExportFormat or undefined
 */
export function parseExportFormat(format: string | undefined): ExportFormat | undefined {
  if (!format) return undefined;
  const lower = format.toLowerCase();
  if (!VALID_EXPORT_FORMATS.has(lower)) {
    throw new Error(`Invalid export format: ${format}. Valid formats: ${[...VALID_EXPORT_FORMATS].join(', ')}`);
  }
  return lower as ExportFormat;
}

/**
 * Parse and validate output mode
 * @returns OutputMode (defaults to 'pretty')
 */
export function parseOutputMode(mode: string | undefined): OutputMode {
  if (!mode) return 'pretty';
  const lower = mode.toLowerCase();
  if (!VALID_OUTPUT_MODES.has(lower)) {
    throw new Error(`Invalid output mode: ${mode}. Valid modes: ${[...VALID_OUTPUT_MODES].join(', ')}`);
  }
  return lower as OutputMode;
}

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
    output: {
      type: 'string',
      description: 'Output mode: pretty (default), json, raw',
      alias: 'o',
    },
    trace: {
      type: 'boolean',
      description: 'Show timing information',
      default: false,
    },
    export: {
      type: 'string',
      description: 'Export request as command: curl, httpie',
      alias: 'e',
    },
  },
  async run({ args }) {
    // Parse and validate method
    const method = parseMethod(args.method as string);
    const url = args.url as string;
    const outputMode = parseOutputMode(args.output as string | undefined);
    const exportFormat = parseExportFormat(args.export as string | undefined);

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
      outputMode,
      trace: args.trace as boolean,
    };

    // Export mode: display command instead of executing
    if (exportFormat) {
      const exported = exportRequest(request, exportFormat);
      consola.log(exported);
      return;
    }

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
    output?: OutputMode;
    trace?: boolean;
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
    outputMode: options.output,
    trace: options.trace,
  };
}
