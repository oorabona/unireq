/**
 * Variable syntax parser
 *
 * Parses ${type:name} patterns from template strings
 */

import type { VariableMatch, VariableType } from './types.js';

/** Known variable types */
const KNOWN_TYPES: ReadonlySet<string> = new Set(['var', 'env', 'secret', 'prompt']);

/**
 * Regex to match variable patterns: ${type:name}
 * - Captures: type, name
 * - Does not match escaped: $${...}
 * - Does not match invalid: ${invalid} (no colon)
 */
const VARIABLE_PATTERN = /(?<!\$)\$\{([a-z]+):([^}]+)\}/g;

/**
 * Regex to detect escaped variable syntax: $${...}
 */
const ESCAPED_PATTERN = /\$\$\{/g;

/**
 * Check if a type string is a known variable type
 */
export function isKnownType(type: string): type is VariableType {
  return KNOWN_TYPES.has(type);
}

/**
 * Parse a template string for variable references
 *
 * @param template - The template string to parse
 * @returns Array of variable matches (only known types)
 *
 * @example
 * parseVariables("Hello ${var:name}!")
 * // Returns: [{ full: "${var:name}", type: "var", name: "name", start: 6, end: 18 }]
 */
export function parseVariables(template: string): VariableMatch[] {
  const matches: VariableMatch[] = [];
  const regex = new RegExp(VARIABLE_PATTERN.source, 'g');

  for (const match of template.matchAll(regex)) {
    const [full, type, name] = match;
    if (type && name && isKnownType(type) && match.index !== undefined) {
      matches.push({
        full,
        type,
        name,
        start: match.index,
        end: match.index + full.length,
      });
    }
  }

  return matches;
}

/**
 * Check if a template contains any variable references
 *
 * @param template - The template string to check
 * @returns true if template contains at least one variable
 */
export function hasVariables(template: string): boolean {
  const regex = new RegExp(VARIABLE_PATTERN.source, 'g');
  for (const match of template.matchAll(regex)) {
    const [, type] = match;
    if (type && isKnownType(type)) {
      return true;
    }
  }
  return false;
}

/**
 * Unescape escaped variable syntax ($${...} → ${...})
 *
 * @param template - The template string with escaped variables
 * @returns String with escaped sequences unescaped
 *
 * @example
 * unescapeVariables("literal: $${var:name}")
 * // Returns: "literal: ${var:name}"
 */
export function unescapeVariables(template: string): string {
  return template.replace(ESCAPED_PATTERN, '${');
}
