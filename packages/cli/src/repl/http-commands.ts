/**
 * HTTP command handlers for REPL
 * Creates command handlers for get, post, put, patch, delete, head, options
 */

import { consola } from 'consola';
import { executeRequest } from '../executor.js';
import type { HttpMethod } from '../types.js';
import { parseHttpCommand } from './http-parser.js';
import type { Command, CommandHandler } from './types.js';

/**
 * Create an HTTP command handler for a specific method
 */
export function createHttpHandler(method: HttpMethod): CommandHandler {
  return async (args) => {
    try {
      const request = parseHttpCommand(method, args);
      await executeRequest(request);
    } catch (error) {
      if (error instanceof Error) {
        consola.error(error.message);
      } else {
        consola.error(`Error: ${String(error)}`);
      }
    }
  };
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
