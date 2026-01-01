/**
 * OpenAPI Validation Warning Display
 * Formats and displays validation warnings to the console
 * @module openapi/validator/display
 */

import { consola } from 'consola';
import type { ValidationResult, ValidationWarning } from './types.js';

/**
 * ANSI color codes for terminal output
 */
const COLORS = {
  reset: '\x1b[0m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
} as const;

/**
 * Format a single validation warning for display
 * @param warning - The validation warning
 * @param useColors - Whether to use ANSI colors
 * @returns Formatted warning string
 */
export function formatWarning(warning: ValidationWarning, useColors = true): string {
  const prefix = warning.severity === 'info' ? 'ℹ' : '⚠';

  if (useColors) {
    const color = warning.severity === 'info' ? COLORS.cyan : COLORS.yellow;
    return `${color}${prefix} ${warning.message}${COLORS.reset}`;
  }

  return `${prefix} ${warning.message}`;
}

/**
 * Format all validation warnings for display
 * @param result - Validation result
 * @param useColors - Whether to use ANSI colors
 * @returns Array of formatted warning strings
 */
export function formatWarnings(result: ValidationResult, useColors = true): string[] {
  if (result.skipped || result.warnings.length === 0) {
    return [];
  }

  return result.warnings.map((w) => formatWarning(w, useColors));
}

/**
 * Display validation warnings to the console
 * @param result - Validation result
 * @param useColors - Whether to use ANSI colors
 */
export function displayWarnings(result: ValidationResult, useColors = true): void {
  const formatted = formatWarnings(result, useColors);

  for (const line of formatted) {
    consola.log(line);
  }
}

/**
 * Check if there are any warnings to display
 * @param result - Validation result
 * @returns True if there are warnings
 */
export function hasWarnings(result: ValidationResult): boolean {
  return !result.skipped && result.warnings.length > 0;
}
