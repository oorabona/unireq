/**
 * URL normalization and header utilities
 */

import { URLNormalizationError } from './errors.js';
import type { ClientOptions } from './types.js';

/**
 * Normalizes a URL with base and default scheme support
 * @param url - The URL to normalize (absolute or relative)
 * @param options - Client options containing base and defaultScheme
 * @returns Normalized absolute URL
 */
export function normalizeURL(url: string, options: ClientOptions = {}): string {
  const { base, defaultScheme = 'https' } = options;

  try {
    // If URL is already absolute, use it directly
    if (url.includes('://')) {
      return new URL(url).toString();
    }

    // If URL starts with //, treat as protocol-relative
    if (url.startsWith('//')) {
      return new URL(`${defaultScheme}:${url}`).toString();
    }

    // If base is provided, resolve relative to base
    if (base) {
      const baseURL = base.includes('://') ? base : `${defaultScheme}://${base}`;
      return new URL(url, baseURL).toString();
    }

    // If no base provided and URL is relative → Error
    // Check if URL is relative (starts with / or doesn't have scheme)
    const isRelative = !url.match(/^[a-z][a-z0-9+.-]*:/i);

    if (isRelative) {
      throw new URLNormalizationError(
        url,
        'Relative URL requires URI in transport. Use http("https://api.com") or provide absolute URL.',
      );
    }

    return new URL(url).toString();
  } catch (error) {
    if (error instanceof URLNormalizationError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new URLNormalizationError(url, message);
  }
}

/**
 * Appends query parameters to a URL
 * @param url - The base URL
 * @param params - Query parameters to append
 * @returns URL with query parameters
 */
export function appendQueryParams(url: string, params: Record<string, string | number | boolean | undefined>): string {
  const urlObj = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      urlObj.searchParams.append(key, String(value));
    }
  }
  return urlObj.toString();
}

/**
 * Normalizes HTTP headers to lowercase (per HTTP/2 spec)
 * HTTP/2 requires all header names to be lowercase
 * HTTP/1.1 is case-insensitive, so lowercase is safe everywhere
 *
 * @param headers - Headers object with potentially mixed case keys
 * @returns Headers object with all lowercase keys
 *
 * @example
 * ```ts
 * normalizeHeaders({ 'Content-Type': 'application/json', 'Accept': 'text/html' })
 * // Returns: { 'content-type': 'application/json', 'accept': 'text/html' }
 * ```
 */
export function normalizeHeaders(headers: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value;
  }
  return normalized;
}

/**
 * Gets a header value with case-insensitive lookup
 * Useful for reading headers before normalization
 *
 * @param headers - Headers object
 * @param name - Header name (case-insensitive)
 * @returns Header value or undefined
 *
 * @example
 * ```ts
 * getHeader({ 'Content-Type': 'application/json' }, 'content-type') // 'application/json'
 * getHeader({ 'content-type': 'application/json' }, 'Content-Type') // 'application/json'
 * ```
 */
export function getHeader(headers: Record<string, string>, name: string): string | undefined {
  const lowerName = name.toLowerCase();
  // Try lowercase first (most common)
  if (lowerName in headers) {
    return headers[lowerName];
  }
  // Fallback: case-insensitive search
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }
  return undefined;
}

/**
 * Sets a header value, removing any existing variants with different casing
 * Prevents duplicate headers with different casing (e.g., 'accept' and 'Accept')
 *
 * @param headers - Headers object to modify
 * @param name - Header name (will be normalized to lowercase)
 * @param value - Header value
 * @returns New headers object with the header set (immutable)
 *
 * @example
 * ```ts
 * setHeader({ Accept: 'text/html' }, 'accept', 'application/json')
 * // Returns: { accept: 'application/json' } (removed 'Accept')
 * ```
 */
export function setHeader(headers: Record<string, string>, name: string, value: string): Record<string, string> {
  const lowerName = name.toLowerCase();
  const newHeaders: Record<string, string> = {};

  // Copy all headers except variants of the target header
  for (const [key, val] of Object.entries(headers)) {
    if (key.toLowerCase() !== lowerName) {
      newHeaders[key] = val;
    }
  }

  // Set the new header value with normalized lowercase name
  newHeaders[lowerName] = value;

  return newHeaders;
}

/**
 * Converts a Record<string, string> headers object to native Headers
 *
 * Use this helper when you need to pass headers to external libraries
 * that require the native Headers API (e.g., fetch, Web APIs).
 *
 * Note: In most cases, you should prefer Record<string, string> because:
 * - It's more efficient (no iteration overhead)
 * - It's JSON-serializable
 * - It works directly with unireq APIs
 *
 * @param headers - Headers object (Record<string, string>)
 * @returns Native Headers instance
 *
 * @example
 * ```ts
 * const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer token' };
 * const nativeHeaders = toNativeHeaders(headers);
 *
 * // Pass to external API that requires native Headers
 * fetch(url, { headers: nativeHeaders });
 * ```
 */
export function toNativeHeaders(headers: Record<string, string>): Headers {
  return new Headers(headers);
}

/**
 * Converts native Headers to Record<string, string>
 *
 * Use this helper when receiving headers from external sources
 * (e.g., Response.headers from fetch) and need to use them with unireq APIs.
 *
 * @param headers - Native Headers instance
 * @returns Headers as Record<string, string>
 *
 * @example
 * ```ts
 * const response = await fetch(url);
 * const headers = fromNativeHeaders(response.headers);
 * console.log(headers['content-type']); // 'application/json'
 * ```
 */
export function fromNativeHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}
