/**
 * Color utilities for output formatting
 */

import pc from 'picocolors';

/**
 * Check if colors should be used based on environment and TTY
 */
export function shouldUseColors(forceColors?: boolean): boolean {
  // Explicit override
  if (forceColors !== undefined) {
    return forceColors;
  }

  // NO_COLOR standard: https://no-color.org/
  if (process.env['NO_COLOR'] !== undefined) {
    return false;
  }

  // FORCE_COLOR overrides TTY check
  if (process.env['FORCE_COLOR'] !== undefined) {
    return true;
  }

  // Check if stdout is a TTY
  return process.stdout.isTTY === true;
}

/**
 * Color function type
 */
export type ColorFn = (text: string) => string;

/**
 * Get color function for HTTP status code
 * - 2xx: green (success)
 * - 3xx: yellow (redirect)
 * - 4xx/5xx: red (error)
 */
export function getStatusColor(status: number, useColors: boolean): ColorFn {
  if (!useColors) {
    return (text: string) => text;
  }

  if (status >= 200 && status < 300) {
    return pc.green;
  }

  if (status >= 300 && status < 400) {
    return pc.yellow;
  }

  // 4xx and 5xx
  return pc.red;
}

/**
 * Apply dim styling if colors enabled
 */
export function dim(text: string, useColors: boolean): string {
  return useColors ? pc.dim(text) : text;
}

/**
 * Apply bold styling if colors enabled
 */
export function bold(text: string, useColors: boolean): string {
  return useColors ? pc.bold(text) : text;
}

/**
 * Get terminal width for output formatting
 *
 * Returns the terminal width in columns, or a default value if not available.
 * Uses process.stdout.columns when running in a TTY environment.
 *
 * @param defaultWidth - Default width to use when terminal width is unavailable (default: 80)
 * @returns Terminal width in columns
 */
export function getTerminalWidth(defaultWidth = 80): number {
  return process.stdout.columns || defaultWidth;
}
