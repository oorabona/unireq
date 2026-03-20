/**
 * Shared token utility functions
 *
 * Extracted from auth/providers/login-jwt.ts for reuse across the CLI.
 */

import { interpolate } from '../workspace/variables/resolver.js';
import type { InterpolationContext } from '../workspace/variables/types.js';

/**
 * Simple hash function for cache key generation
 * Not cryptographic, just for cache key uniqueness
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Recursively interpolate all string values in an object
 *
 * @param obj - The object to interpolate
 * @param context - Interpolation context
 * @returns New object with interpolated values
 */
export function interpolateObject(obj: unknown, context: InterpolationContext): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return interpolate(obj, context);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => interpolateObject(item, context));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = interpolateObject(value, context);
    }
    return result;
  }

  // primitives (number, boolean) pass through unchanged
  return obj;
}

/**
 * Extract a value from an object using a simple JSONPath expression
 *
 * Supports patterns like:
 * - $.token
 * - $.data.access_token
 * - $.response.auth.jwt
 *
 * @param obj - The object to extract from
 * @param path - JSONPath expression (must start with $.)
 * @returns The extracted value or undefined if not found
 */
export function extractJsonPath(obj: unknown, path: string): unknown {
  if (typeof obj !== 'object' || obj === null) {
    return undefined;
  }

  // Validate path format
  if (!path.startsWith('$.')) {
    throw new Error(`Invalid JSONPath: must start with '$.' but got '${path}'`);
  }

  // Remove $. prefix and split into parts
  const parts = path.slice(2).split('.');

  // Navigate through the object
  let current: unknown = obj;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Format the token value using the inject format template
 *
 * @param token - The extracted token value
 * @param format - Format template with ${token} placeholder
 * @returns Formatted value
 */
export function formatTokenValue(token: string, format: string): string {
  // biome-ignore lint/suspicious/noTemplateCurlyInString: This is the expected format pattern
  return format.replace('${token}', token);
}

/**
 * Error thrown when token extraction fails
 */
export class TokenExtractionError extends Error {
  constructor(
    public readonly path: string,
    public readonly response: unknown,
  ) {
    super(`Failed to extract token at path '${path}'`);
    this.name = 'TokenExtractionError';
  }
}
