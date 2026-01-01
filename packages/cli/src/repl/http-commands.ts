/**
 * HTTP command handlers for REPL
 * Creates command handlers for get, post, put, patch, delete, head, options
 */

import { consola } from 'consola';
import { executeRequest } from '../executor.js';
import type { HttpMethod, ParsedRequest } from '../types.js';
import { parseHttpCommand } from './http-parser.js';
import type { Command, CommandHandler } from './types.js';

/**
 * Create an HTTP command handler for a specific method
 */
export function createHttpHandler(method: HttpMethod): CommandHandler {
  return async (args, state) => {
    const startTime = Date.now();
    let request: ParsedRequest | undefined;

    try {
      request = parseHttpCommand(method, args);
      // Store the request for save command
      state.lastRequest = request;
      const result = await executeRequest(request);

      // Log successful HTTP request to history
      if (state.historyWriter && request) {
        const durationMs = Date.now() - startTime;
        state.historyWriter.logHttp({
          method: request.method,
          url: request.url,
          requestHeaders: request.headers.length > 0 ? parseHeadersToRecord(request.headers) : undefined,
          requestBody: request.body,
          status: result?.status ?? null,
          responseHeaders: result?.headers,
          responseBody: result?.body,
          durationMs,
        });
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Log failed HTTP request to history
      if (state.historyWriter && request) {
        state.historyWriter.logHttp({
          method: request.method,
          url: request.url,
          requestHeaders: request.headers.length > 0 ? parseHeadersToRecord(request.headers) : undefined,
          requestBody: request.body,
          status: null,
          error: errorMsg,
          durationMs,
        });
      }

      if (error instanceof Error) {
        consola.error(error.message);
      } else {
        consola.error(`Error: ${errorMsg}`);
      }
    }
  };
}

/**
 * Parse header strings to record for history logging
 */
function parseHeadersToRecord(headers: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const header of headers) {
    const colonIndex = header.indexOf(':');
    if (colonIndex !== -1) {
      const key = header.slice(0, colonIndex).trim();
      const value = header.slice(colonIndex + 1).trim();
      if (key) {
        result[key] = value;
      }
    }
  }
  return result;
}

/**
 * Create all HTTP method commands
 */
export function createHttpCommands(): Command[] {
  const methods: Array<{ method: HttpMethod; description: string }> = [
    { method: 'GET', description: 'Execute HTTP GET request' },
    { method: 'POST', description: 'Execute HTTP POST request' },
    { method: 'PUT', description: 'Execute HTTP PUT request' },
    { method: 'PATCH', description: 'Execute HTTP PATCH request' },
    { method: 'DELETE', description: 'Execute HTTP DELETE request' },
    { method: 'HEAD', description: 'Execute HTTP HEAD request' },
    { method: 'OPTIONS', description: 'Execute HTTP OPTIONS request' },
  ];

  return methods.map(({ method, description }) => ({
    name: method.toLowerCase(),
    description,
    handler: createHttpHandler(method),
  }));
}
