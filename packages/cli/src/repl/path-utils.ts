/**
 * Path utilities for REPL navigation
 * Provides path normalization and resolution for virtual API paths
 */

/**
 * Normalize a path by removing redundant slashes and trailing slashes
 * @param path - The path to normalize
 * @returns Normalized path starting with /
 */
export function normalizePath(path: string): string {
  // Handle empty path
  if (!path || path.trim() === '') {
    return '/';
  }

  // Split by slashes, filter empty segments
  const segments = path.split('/').filter((segment) => segment !== '');

  // Resolve parent segments (..)
  const resolvedSegments: string[] = [];
  for (const segment of segments) {
    if (segment === '..') {
      // Go up one level (remove last segment if exists)
      resolvedSegments.pop();
    } else if (segment !== '.') {
      // Ignore current dir (.), add others
      resolvedSegments.push(segment);
    }
  }

  // Rebuild path
  const result = `/${resolvedSegments.join('/')}`;
  return result;
}

/**
 * Resolve a target path relative to the current path
 * @param currentPath - The current working path
 * @param targetPath - The target path (absolute or relative)
 * @returns Resolved absolute path
 */
export function resolvePath(currentPath: string, targetPath: string): string {
  // Handle empty target
  if (!targetPath || targetPath.trim() === '') {
    return '/';
  }

  const trimmedTarget = targetPath.trim();

  // If absolute path (starts with /), normalize and return
  if (trimmedTarget.startsWith('/')) {
    return normalizePath(trimmedTarget);
  }

  // Relative path: combine with current and normalize
  const combined = `${currentPath}/${trimmedTarget}`;
  return normalizePath(combined);
}
