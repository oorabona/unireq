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
export type ExportFormat = 'curl' | 'httpie';

/**
 * Export a request to the specified format
 */
export function exportRequest(request: ParsedRequest, format: ExportFormat): string {
  switch (format) {
    case 'curl':
      return toCurl(request);
    case 'httpie':
      return toHttpie(request);
    default:
      throw new Error(`Unknown export format: ${format}`);
  }
}
