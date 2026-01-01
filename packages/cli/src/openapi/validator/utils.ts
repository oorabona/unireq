/**
 * OpenAPI Validator Utilities
 * Shared utility functions for the validator module
 * @module openapi/validator/utils
 */

/**
 * Normalize a URL path for comparison
 * - Removes query string if present
 * - Ensures leading slash
 * - Removes trailing slash (except for root)
 * @param path - The URL path to normalize
 * @returns Normalized path
 */
export function normalizePath(path: string): string {
  // Remove query string if present
  const queryIndex = path.indexOf('?');
  let cleanPath = queryIndex >= 0 ? path.slice(0, queryIndex) : path;

  // Ensure leading slash
  if (!cleanPath.startsWith('/')) {
    cleanPath = `/${cleanPath}`;
  }

  // Remove trailing slash (except for root)
  if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
    cleanPath = cleanPath.slice(0, -1);
  }

  return cleanPath;
}
