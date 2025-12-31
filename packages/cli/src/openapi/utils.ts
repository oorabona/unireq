/**
 * OpenAPI Spec Loader Utilities
 * @module openapi/utils
 */

import path from 'node:path';
import type { SpecVersion } from './types';

/**
 * Check if source looks like a URL
 * @param source - File path or URL
 * @returns true if source appears to be a URL
 */
export function isUrl(source: string): boolean {
  return source.startsWith('http://') || source.startsWith('https://');
}

/**
 * Check if URL is localhost
 * @param url - URL to check
 * @returns true if URL points to localhost
 */
export function isLocalhost(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
  } catch {
    return false;
  }
}

/**
 * Check if URL uses HTTPS (or is localhost HTTP)
 * @param url - URL to check
 * @param allowInsecureLocalhost - Allow HTTP for localhost
 * @returns true if URL is secure or allowed insecure localhost
 */
export function isSecureUrl(url: string, allowInsecureLocalhost: boolean): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') {
      return true;
    }
    if (parsed.protocol === 'http:' && allowInsecureLocalhost) {
      return isLocalhost(url);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Detect OpenAPI version from document
 * @param doc - Parsed document (unknown shape)
 * @returns Simplified version (2.0, 3.0, 3.1)
 * @throws Error if no version field found
 */
export function detectVersion(doc: unknown): {
  version: SpecVersion;
  versionFull: string;
} {
  if (typeof doc !== 'object' || doc === null) {
    throw new Error('Document is not an object');
  }

  const document = doc as Record<string, unknown>;

  // Check for OpenAPI 3.x
  if (typeof document['openapi'] === 'string') {
    const openapi = document['openapi'];
    if (openapi.startsWith('3.1')) {
      return { version: '3.1', versionFull: openapi };
    }
    if (openapi.startsWith('3.0')) {
      return { version: '3.0', versionFull: openapi };
    }
    // Future versions - default to 3.1
    if (openapi.startsWith('3.')) {
      return { version: '3.1', versionFull: openapi };
    }
    throw new Error(`Unsupported OpenAPI version: ${openapi}`);
  }

  // Check for Swagger 2.0
  if (typeof document['swagger'] === 'string') {
    const swagger = document['swagger'];
    if (swagger === '2.0') {
      return { version: '2.0', versionFull: '2.0' };
    }
    throw new Error(`Unsupported Swagger version: ${swagger}`);
  }

  throw new Error('Not a valid OpenAPI specification: missing "openapi" or "swagger" field');
}

/**
 * Detect file format from extension or content
 * @param source - File path or URL
 * @returns 'json' | 'yaml'
 */
export function detectFormat(source: string): 'json' | 'yaml' {
  const lower = source.toLowerCase();
  if (lower.endsWith('.json')) {
    return 'json';
  }
  if (lower.endsWith('.yaml') || lower.endsWith('.yml') || lower.endsWith('.openapi')) {
    return 'yaml';
  }
  // Default to YAML as it's more common for OpenAPI specs
  return 'yaml';
}

/**
 * Resolve relative path against base
 * @param base - Base path or URL
 * @param relative - Relative path to resolve
 * @returns Resolved path or URL
 */
export function resolvePath(base: string, relative: string): string {
  if (isUrl(base)) {
    // URL resolution
    return new URL(relative, base).href;
  }

  // File path resolution using path.posix for consistent forward slashes
  const baseDir = path.posix.dirname(base);
  const resolved = path.posix.join(baseDir, relative);

  // Normalize to remove ../ and ./ segments
  return path.posix.normalize(resolved);
}
