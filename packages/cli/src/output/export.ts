/**
 * Export formatters for converting requests to curl/HTTPie commands
 */

import type { ParsedRequest } from '../types.js';

/**
 * Escape a string for safe shell usage
 * Uses single quotes with proper escaping for embedded single quotes
 */
export function escapeShell(value: string): string {
  // If the value contains no special characters, return as-is
  if (/^[a-zA-Z0-9._\-/:@]+$/.test(value)) {
    return value;
  }

  // Use single quotes and escape any embedded single quotes
  // by ending the string, adding an escaped quote, and starting a new string
  // 'don'\''t' -> don't
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/**
 * Build URL with query parameters
 */
function buildUrlWithQuery(url: string, query: string[]): string {
  if (query.length === 0) {
    return url;
  }

  // Parse existing query params from URL
  const urlObj = new URL(url, 'http://localhost');
  const existingParams = new URLSearchParams(urlObj.search);

  // Add new query params
  for (const param of query) {
    const equalsIndex = param.indexOf('=');
    if (equalsIndex !== -1) {
      const key = param.slice(0, equalsIndex);
      const value = param.slice(equalsIndex + 1);
      existingParams.append(key, value);
    }
  }

  // Rebuild URL with all params
  const queryString = existingParams.toString();
  const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;

  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Convert a ParsedRequest to a curl command
 *
 * @example
 * toCurl({ method: 'GET', url: 'https://api.example.com/users', headers: [], query: [] })
 * // => curl -X GET 'https://api.example.com/users'
 *
 * @example
 * toCurl({
 *   method: 'POST',
 *   url: 'https://api.example.com/users',
 *   headers: ['Content-Type: application/json'],
 *   query: [],
 *   body: '{"name":"Alice"}'
 * })
 * // => curl -X POST -H 'Content-Type: application/json' -d '{"name":"Alice"}' 'https://api.example.com/users'
 */
export function toCurl(request: ParsedRequest): string {
  const parts: string[] = ['curl'];

  // Method
  parts.push('-X', request.method);

  // Headers
  for (const header of request.headers) {
    parts.push('-H', escapeShell(header));
  }

  // Body
  if (request.body) {
    parts.push('-d', escapeShell(request.body));
  }

  // URL with query params
  const fullUrl = buildUrlWithQuery(request.url, request.query);
  parts.push(escapeShell(fullUrl));

  return parts.join(' ');
}

/**
 * Convert a ParsedRequest to an HTTPie command
 *
 * @example
 * toHttpie({ method: 'GET', url: 'https://api.example.com/users', headers: [], query: [] })
 * // => http GET https://api.example.com/users
 *
 * @example
 * toHttpie({
 *   method: 'POST',
 *   url: 'https://api.example.com/users',
 *   headers: ['Content-Type: application/json'],
 *   query: ['limit=10'],
 *   body: '{"name":"Alice"}'
 * })
 * // => http POST https://api.example.com/users Content-Type:application/json limit==10 --raw '{"name":"Alice"}'
 */
export function toHttpie(request: ParsedRequest): string {
  const parts: string[] = ['http'];

  // Method
  parts.push(request.method);

  // URL (without query params - HTTPie handles them separately)
  parts.push(escapeShell(request.url));

  // Headers (key:value format for HTTPie)
  for (const header of request.headers) {
    const colonIndex = header.indexOf(':');
    if (colonIndex !== -1) {
      const key = header.slice(0, colonIndex).trim();
      const value = header.slice(colonIndex + 1).trim();
      parts.push(`${key}:${escapeShell(value)}`);
    }
  }

  // Query params (key==value format for HTTPie)
  for (const param of request.query) {
    const equalsIndex = param.indexOf('=');
    if (equalsIndex !== -1) {
      const key = param.slice(0, equalsIndex);
      const value = param.slice(equalsIndex + 1);
      parts.push(`${key}==${escapeShell(value)}`);
    }
  }

  // Body (use --raw for raw body content)
  if (request.body) {
    parts.push('--raw', escapeShell(request.body));
  }

  return parts.join(' ');
}

/**
 * Export format types
 */
export type ExportFormat = 'curl' | 'httpie' | 'har';

/**
 * Export a request to the specified format
 */
export function exportRequest(request: ParsedRequest, format: ExportFormat): string {
  switch (format) {
    case 'curl':
      return toCurl(request);
    case 'httpie':
      return toHttpie(request);
    case 'har':
      // HAR format requires response - use minimal export for request only
      return JSON.stringify(toHar(request), null, 2);
    default:
      throw new Error(`Unknown export format: ${format}`);
  }
}

/**
 * HAR 1.2 types for HTTP Archive format
 * @see https://w3c.github.io/web-performance/specs/HAR/HAR.html
 */

export interface HarNameValue {
  name: string;
  value: string;
}

export interface HarRequest {
  method: string;
  url: string;
  httpVersion: string;
  cookies: HarNameValue[];
  headers: HarNameValue[];
  queryString: HarNameValue[];
  postData?: {
    mimeType: string;
    text: string;
  };
  headersSize: number;
  bodySize: number;
}

export interface HarResponse {
  status: number;
  statusText: string;
  httpVersion: string;
  cookies: HarNameValue[];
  headers: HarNameValue[];
  content: {
    size: number;
    mimeType: string;
    text?: string;
  };
  redirectURL: string;
  headersSize: number;
  bodySize: number;
}

export interface HarEntry {
  startedDateTime: string;
  time: number;
  request: HarRequest;
  response: HarResponse;
  cache: Record<string, never>;
  timings: {
    send: number;
    wait: number;
    receive: number;
  };
}

export interface HarLog {
  log: {
    version: string;
    creator: {
      name: string;
      version: string;
    };
    entries: HarEntry[];
  };
}

/**
 * Response data for HAR export
 */
export interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body?: string;
  timing?: {
    start: number;
    end: number;
  };
}

/**
 * Parse header string "Key: Value" into HarNameValue
 */
function parseHeaderToNameValue(header: string): HarNameValue | null {
  const colonIndex = header.indexOf(':');
  if (colonIndex === -1) {
    return null;
  }
  return {
    name: header.slice(0, colonIndex).trim(),
    value: header.slice(colonIndex + 1).trim(),
  };
}

/**
 * Parse query param string "key=value" into HarNameValue
 */
function parseQueryToNameValue(param: string): HarNameValue | null {
  const equalsIndex = param.indexOf('=');
  if (equalsIndex === -1) {
    return null;
  }
  return {
    name: param.slice(0, equalsIndex),
    value: param.slice(equalsIndex + 1),
  };
}

/**
 * Get content type from headers
 */
function getContentType(headers: HarNameValue[]): string {
  const contentTypeHeader = headers.find((h) => h.name.toLowerCase() === 'content-type');
  return contentTypeHeader?.value || 'application/octet-stream';
}

/**
 * Convert a ParsedRequest (and optional response) to HAR 1.2 format
 *
 * @example
 * toHar({ method: 'GET', url: 'https://api.example.com/users', headers: [], query: [] })
 * // => { log: { version: "1.2", creator: {...}, entries: [{ request: {...}, response: {...} }] } }
 */
export function toHar(request: ParsedRequest, response?: ResponseData): HarLog {
  const startedDateTime = new Date().toISOString();

  // Parse request headers
  const requestHeaders: HarNameValue[] = request.headers
    .map(parseHeaderToNameValue)
    .filter((h): h is HarNameValue => h !== null);

  // Parse query parameters
  const queryString: HarNameValue[] = request.query
    .map(parseQueryToNameValue)
    .filter((q): q is HarNameValue => q !== null);

  // Build request object
  const harRequest: HarRequest = {
    method: request.method,
    url: buildUrlWithQuery(request.url, request.query),
    httpVersion: 'HTTP/1.1',
    cookies: [],
    headers: requestHeaders,
    queryString,
    headersSize: -1,
    bodySize: request.body ? new TextEncoder().encode(request.body).length : 0,
  };

  // Add postData if body exists
  if (request.body) {
    const contentType = getContentType(requestHeaders);
    harRequest.postData = {
      mimeType: contentType,
      text: request.body,
    };
  }

  // Build response object (minimal if no response provided)
  const responseHeaders: HarNameValue[] = response
    ? Object.entries(response.headers).map(([name, value]) => ({ name, value }))
    : [];

  const responseBody = response?.body || '';
  const responseBodySize = responseBody ? new TextEncoder().encode(responseBody).length : 0;

  const harResponse: HarResponse = {
    status: response?.status || 0,
    statusText: response?.statusText || '',
    httpVersion: 'HTTP/1.1',
    cookies: [],
    headers: responseHeaders,
    content: {
      size: responseBodySize,
      mimeType: getContentType(responseHeaders),
      text: responseBody || undefined,
    },
    redirectURL: '',
    headersSize: -1,
    bodySize: responseBodySize,
  };

  // Calculate timing
  const time = response?.timing ? response.timing.end - response.timing.start : 0;

  const entry: HarEntry = {
    startedDateTime,
    time,
    request: harRequest,
    response: harResponse,
    cache: {},
    timings: {
      send: 0,
      wait: time,
      receive: 0,
    },
  };

  return {
    log: {
      version: '1.2',
      creator: {
        name: 'unireq',
        version: '0.0.1',
      },
      entries: [entry],
    },
  };
}
