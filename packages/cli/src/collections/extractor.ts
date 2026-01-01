/**
 * Variable extraction engine
 *
 * Extracts variables from response bodies using JSONPath-lite expressions.
 */

import { extractByPath, InvalidJsonPathError, JsonPathNotFoundError } from './jsonpath.js';
import type { ExtractConfig } from './types.js';

/**
 * Error thrown when extraction fails
 */
export class ExtractionError extends Error {
  override readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'ExtractionError';
    this.cause = cause;
    Object.setPrototypeOf(this, ExtractionError.prototype);
  }
}

/**
 * Result of variable extraction
 */
export interface ExtractionResult {
  /** Successfully extracted variables */
  variables: Record<string, string>;
  /** Errors for failed extractions (optional paths that were not found) */
  skipped: Array<{ name: string; path: string; reason: string }>;
}

/**
 * Convert extracted value to string for storage
 */
function valueToString(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  // Objects and arrays - JSON stringify
  return JSON.stringify(value);
}

/**
 * Parse JSON response body
 */
function parseResponseBody(body: string): unknown {
  if (!body || body.trim() === '') {
    throw new ExtractionError('Cannot extract from empty response body');
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    throw new ExtractionError(
      'Response is not valid JSON. Variable extraction requires JSON response.',
      error instanceof Error ? error : undefined,
    );
  }
}

/**
 * Extract variables from a response body using extraction config
 *
 * @param body - Response body (JSON string)
 * @param config - Extraction configuration with variable mappings
 * @returns Extraction result with variables and any skipped paths
 * @throws ExtractionError if response is not valid JSON
 *
 * @example
 * extractVariables('{"token":"abc"}', { vars: { token: '$.token' } })
 * // Returns: { variables: { token: 'abc' }, skipped: [] }
 */
export function extractVariables(body: string, config: ExtractConfig): ExtractionResult {
  const data = parseResponseBody(body);

  const variables: Record<string, string> = {};
  const skipped: Array<{ name: string; path: string; reason: string }> = [];

  if (!config.vars) {
    return { variables, skipped };
  }

  for (const [varName, path] of Object.entries(config.vars)) {
    try {
      const value = extractByPath(path, data);

      // Handle undefined (optional path not found)
      if (value === undefined) {
        skipped.push({
          name: varName,
          path,
          reason: 'Optional path not found',
        });
        continue;
      }

      variables[varName] = valueToString(value);
    } catch (error) {
      if (error instanceof InvalidJsonPathError) {
        throw new ExtractionError(`Invalid JSONPath for variable "${varName}": ${error.message}`, error);
      }
      if (error instanceof JsonPathNotFoundError) {
        throw new ExtractionError(`Cannot extract variable "${varName}": ${error.message}`, error);
      }
      throw error;
    }
  }

  return { variables, skipped };
}

/**
 * Extract a single variable from response body
 *
 * @param body - Response body (JSON string)
 * @param path - JSONPath expression
 * @returns Extracted value as string, or undefined for optional paths
 * @throws ExtractionError if extraction fails
 */
export function extractSingleVariable(body: string, path: string): string | undefined {
  const data = parseResponseBody(body);

  try {
    const value = extractByPath(path, data);
    if (value === undefined) {
      return undefined;
    }
    return valueToString(value);
  } catch (error) {
    if (error instanceof InvalidJsonPathError) {
      throw new ExtractionError(`Invalid JSONPath: ${error.message}`, error);
    }
    if (error instanceof JsonPathNotFoundError) {
      throw new ExtractionError(`Path not found: ${error.message}`, error);
    }
    throw error;
  }
}
