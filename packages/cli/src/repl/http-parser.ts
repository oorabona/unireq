/**
 * HTTP command parser for REPL
 * Parses input like: get /users -H "Authorization:Bearer token" -q "page=1"
 */

import type { HttpMethod, ParsedRequest } from '../types.js';

/**
 * Valid HTTP methods (lowercase for REPL commands)
 */
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);

/**
 * Check if a string is a valid HTTP method
 */
export function isHttpMethod(str: string): boolean {
  return HTTP_METHODS.has(str.toLowerCase());
}

/**
 * Parse HTTP command arguments into a ParsedRequest
 * @param method - HTTP method (from command name)
 * @param args - Command arguments (URL, body, flags)
 * @throws Error if URL is missing or invalid format
 */
export function parseHttpCommand(method: string, args: string[]): ParsedRequest {
  if (args.length === 0) {
    throw new Error('URL is required');
  }

  // First non-flag argument is the URL
  const url = args[0];
  if (!url || url.startsWith('-')) {
    throw new Error('URL is required');
  }

  const headers: string[] = [];
  const query: string[] = [];
  let body: string | undefined;

  // Parse remaining arguments
  let i = 1;
  while (i < args.length) {
    const arg = args[i];
    if (arg === undefined) break;

    // Header flag: -H or --header
    if (arg === '-H' || arg === '--header') {
      i++;
      const headerValue = args[i];
      if (headerValue === undefined) {
        throw new Error('Missing value for header flag');
      }
      // Validate header format (must contain colon)
      if (!headerValue.includes(':')) {
        throw new Error(`Invalid header format: expected 'key:value', got '${headerValue}'`);
      }
      headers.push(headerValue);
      i++;
      continue;
    }

    // Query flag: -q or --query
    if (arg === '-q' || arg === '--query') {
      i++;
      const queryValue = args[i];
      if (queryValue === undefined) {
        throw new Error('Missing value for query flag');
      }
      // Validate query format (must contain equals)
      if (!queryValue.includes('=')) {
        throw new Error(`Invalid query format: expected 'key=value', got '${queryValue}'`);
      }
      query.push(queryValue);
      i++;
      continue;
    }

    // If not a flag and looks like JSON, treat as body
    if (!arg.startsWith('-') && (arg.startsWith('{') || arg.startsWith('['))) {
      if (body !== undefined) {
        throw new Error('Multiple body arguments provided');
      }
      body = arg;
      // Validate JSON syntax
      try {
        JSON.parse(body);
      } catch {
        throw new Error(`Invalid JSON body: ${body}`);
      }
      i++;
      continue;
    }

    // Unknown flag
    if (arg.startsWith('-')) {
      throw new Error(`Unknown flag: ${arg}`);
    }

    // Unknown positional argument (not URL, not body, not flag)
    // Could be part of a multi-word body - not supported in single-line REPL
    throw new Error(`Unexpected argument: ${arg}`);
  }

  return {
    method: method.toUpperCase() as HttpMethod,
    url,
    headers,
    query,
    body,
  };
}

/**
 * Get list of supported HTTP methods for help/error messages
 */
export function getSupportedMethods(): string[] {
  return [...HTTP_METHODS].map((m) => m.toUpperCase());
}
