/**
 * Request executor - executes HTTP requests via @unireq/http
 */

import type { Policy, Response } from '@unireq/core';
import { client, NetworkError, TimeoutError, UnireqError } from '@unireq/core';
import { body, headers as headersPolicy, http, query as queryPolicy, timeout } from '@unireq/http';
import { consola } from 'consola';
import { formatResponse, shouldUseColors } from './output/index.js';
import type { OutputOptions } from './output/types.js';
import type { ParsedRequest } from './types.js';

/**
 * Parse header strings in "key:value" format
 * @throws Error if format is invalid
 */
export function parseHeaders(headers: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (const header of headers) {
    const colonIndex = header.indexOf(':');
    if (colonIndex === -1) {
      throw new Error(`Invalid header format: expected 'key:value', got '${header}'`);
    }

    const key = header.slice(0, colonIndex).trim();
    const value = header.slice(colonIndex + 1).trim();

    if (!key) {
      throw new Error(`Invalid header format: empty key in '${header}'`);
    }

    result[key] = value;
  }

  return result;
}

/**
 * Parse query strings in "key=value" format
 * @throws Error if format is invalid
 */
export function parseQuery(query: string[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (const param of query) {
    const equalsIndex = param.indexOf('=');
    if (equalsIndex === -1) {
      throw new Error(`Invalid query format: expected 'key=value', got '${param}'`);
    }

    const key = param.slice(0, equalsIndex).trim();
    const value = param.slice(equalsIndex + 1).trim();

    if (!key) {
      throw new Error(`Invalid query format: empty key in '${param}'`);
    }

    result[key] = value;
  }

  return result;
}

/**
 * Detect content type based on body content
 * Returns 'application/json' if body is valid JSON, otherwise 'text/plain'
 */
export function detectContentType(bodyStr: string): 'application/json' | 'text/plain' {
  if (!bodyStr) {
    return 'text/plain';
  }

  const trimmed = bodyStr.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return 'application/json';
    } catch {
      return 'text/plain';
    }
  }

  return 'text/plain';
}

/**
 * Display response using the output formatter
 */
function displayResponse(response: Response, outputOptions: OutputOptions): void {
  const formattableResponse = {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    data: response.data,
  };

  const formatted = formatResponse(formattableResponse, outputOptions);
  consola.log(`\n${formatted}`);
}

/**
 * Handle and display errors in a user-friendly way
 */
function handleError(error: unknown): void {
  if (error instanceof TimeoutError) {
    consola.error(`Request timed out after ${error.timeoutMs}ms`);
    return;
  }

  if (error instanceof NetworkError) {
    const message = error.message.toLowerCase();
    if (message.includes('enotfound') || message.includes('getaddrinfo')) {
      consola.error(`Could not resolve host: ${error.message}`);
    } else if (message.includes('econnrefused')) {
      consola.error(`Connection refused: ${error.message}`);
    } else {
      consola.error(`Network error: ${error.message}`);
    }
    return;
  }

  if (error instanceof UnireqError) {
    consola.error(`Request failed: ${error.message}`);
    return;
  }

  if (error instanceof Error) {
    // Check for common network-related errors
    const message = error.message.toLowerCase();
    if (message.includes('enotfound') || message.includes('getaddrinfo')) {
      consola.error(`Could not resolve host: ${error.message}`);
    } else if (message.includes('econnrefused')) {
      consola.error(`Connection refused: ${error.message}`);
    } else if (message.includes('timeout') || message.includes('timed out')) {
      consola.error(`Request timed out: ${error.message}`);
    } else {
      consola.error(`Error: ${error.message}`);
    }
    return;
  }

  consola.error(`Unknown error: ${String(error)}`);
}

/**
 * Result of executing a request
 */
export interface ExecuteResult {
  /** HTTP status code */
  status: number;
  /** Response headers */
  headers: Record<string, string>;
  /** Response body as string */
  body: string;
}

/**
 * Execute an HTTP request based on ParsedRequest
 * @returns ExecuteResult with status and body, or undefined on error
 */
export async function executeRequest(request: ParsedRequest): Promise<ExecuteResult | undefined> {
  try {
    // Parse headers and query
    let parsedHeaders: Record<string, string> = {};
    let parsedQuery: Record<string, string> = {};

    if (request.headers.length > 0) {
      parsedHeaders = parseHeaders(request.headers);
    }

    if (request.query.length > 0) {
      parsedQuery = parseQuery(request.query);
    }

    // Build policies
    const policies: Policy[] = [];

    if (Object.keys(parsedHeaders).length > 0) {
      policies.push(headersPolicy(parsedHeaders));
    }

    if (Object.keys(parsedQuery).length > 0) {
      policies.push(queryPolicy(parsedQuery));
    }

    if (request.timeout) {
      policies.push(timeout(request.timeout));
    }

    // Create HTTP client
    const httpTransport = http();
    const httpClient = client(httpTransport, ...policies);

    // Prepare body if present
    let requestBody: unknown;
    if (request.body) {
      const contentType = detectContentType(request.body);
      if (contentType === 'application/json') {
        requestBody = body.json(JSON.parse(request.body));
      } else {
        requestBody = body.text(request.body);
      }
    }

    // Execute request based on method
    let response: Response;
    const url = request.url;

    switch (request.method) {
      case 'GET':
        response = await httpClient.get(url);
        break;
      case 'HEAD':
        response = await httpClient.head(url);
        break;
      case 'OPTIONS':
        response = await httpClient.options(url);
        break;
      case 'DELETE':
        response = await httpClient.delete(url);
        break;
      case 'POST':
        response = await httpClient.post(url, requestBody);
        break;
      case 'PUT':
        response = await httpClient.put(url, requestBody);
        break;
      case 'PATCH':
        response = await httpClient.patch(url, requestBody);
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${request.method}`);
    }

    // Build output options
    const outputOptions: OutputOptions = {
      mode: request.outputMode ?? 'pretty',
      forceColors: shouldUseColors(),
    };

    // Display response
    displayResponse(response, outputOptions);

    // Return result for extraction and assertions
    const bodyStr = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

    // Convert Headers to Record<string, string>
    const headersRecord: Record<string, string> = {};
    if (response.headers) {
      for (const [key, value] of Object.entries(response.headers)) {
        if (typeof value === 'string') {
          headersRecord[key] = value;
        } else if (Array.isArray(value)) {
          headersRecord[key] = (value as string[]).join(', ');
        }
      }
    }

    return {
      status: response.status,
      headers: headersRecord,
      body: bodyStr,
    };
  } catch (error) {
    // Check if it's a validation error (header/query parsing)
    if (error instanceof Error && error.message.startsWith('Invalid')) {
      consola.error(error.message);
      return undefined;
    }

    handleError(error);
    return undefined;
  }
}
