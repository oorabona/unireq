/**
 * JSONPath-lite parser and evaluator
 *
 * Supports a minimal subset of JSONPath for variable extraction:
 * - $.property - Property access
 * - $.a.b.c - Nested property access
 * - $.arr[0] - Array index access
 * - $.arr[0].prop - Property of array element
 * - $.prop? - Optional (no error if missing)
 */

/**
 * Segment types in a parsed JSONPath
 */
export type JsonPathSegmentType = 'root' | 'property' | 'index';

/**
 * A single segment in a parsed JSONPath
 */
export interface JsonPathSegment {
  /** Segment type */
  type: JsonPathSegmentType;
  /** Property name or array index */
  value: string | number;
  /** Whether this segment is optional (trailing ?) */
  optional: boolean;
}

/**
 * Parsed JSONPath result
 */
export interface ParsedJsonPath {
  /** Path segments */
  segments: JsonPathSegment[];
  /** Whether the entire path is optional (ends with ?) */
  optional: boolean;
  /** Original path string */
  original: string;
}

/**
 * Error thrown when JSONPath syntax is invalid
 */
export class InvalidJsonPathError extends Error {
  readonly path: string;

  constructor(path: string, reason: string) {
    super(`Invalid JSONPath "${path}": ${reason}`);
    this.name = 'InvalidJsonPathError';
    this.path = path;
    Object.setPrototypeOf(this, InvalidJsonPathError.prototype);
  }
}

/**
 * Error thrown when JSONPath cannot be resolved in data
 */
export class JsonPathNotFoundError extends Error {
  readonly path: string;
  readonly segment: string;
  readonly availableKeys: string[];

  constructor(path: string, segment: string, availableKeys: string[] = []) {
    const keysHint = availableKeys.length > 0 ? `. Available: ${availableKeys.join(', ')}` : '';
    super(`Path not found: "${path}" at segment "${segment}"${keysHint}`);
    this.name = 'JsonPathNotFoundError';
    this.path = path;
    this.segment = segment;
    this.availableKeys = availableKeys;
    Object.setPrototypeOf(this, JsonPathNotFoundError.prototype);
  }
}

/**
 * Regex to match property segments: .propertyName or .propertyName?
 */
const PROPERTY_REGEX = /^\.([a-zA-Z_][a-zA-Z0-9_]*)\??/;

/**
 * Regex to match array index segments: [0] or [0]?
 */
const INDEX_REGEX = /^\[(\d+)\]\??/;

/**
 * Parse a JSONPath-lite expression into segments
 *
 * @param path - JSONPath expression (e.g., "$.data.items[0].name")
 * @returns Parsed path with segments
 * @throws InvalidJsonPathError if syntax is invalid
 *
 * @example
 * parseJsonPath("$.token")
 * // Returns: { segments: [{ type: 'root', value: '$', optional: false }, { type: 'property', value: 'token', optional: false }], optional: false }
 */
export function parseJsonPath(path: string): ParsedJsonPath {
  if (!path) {
    throw new InvalidJsonPathError(path, 'Path cannot be empty');
  }

  if (!path.startsWith('$')) {
    throw new InvalidJsonPathError(path, 'Path must start with $');
  }

  const segments: JsonPathSegment[] = [];
  let remaining = path.slice(1); // Remove leading $
  let pathOptional = false;

  // Check for optional marker at the very end
  if (remaining.endsWith('?') && !remaining.endsWith(']?') && !remaining.endsWith(')?')) {
    // Trailing ? on property (not array index)
    pathOptional = true;
  }

  // Add root segment
  segments.push({ type: 'root', value: '$', optional: false });

  // Parse remaining segments
  while (remaining.length > 0) {
    // Try property match
    const propertyMatch = remaining.match(PROPERTY_REGEX);
    if (propertyMatch) {
      const fullMatch = propertyMatch[0];
      const propName = propertyMatch[1];
      const isOptional = fullMatch.endsWith('?');

      if (propName) {
        segments.push({
          type: 'property',
          value: propName,
          optional: isOptional,
        });
      }

      remaining = remaining.slice(fullMatch.length);
      continue;
    }

    // Try array index match
    const indexMatch = remaining.match(INDEX_REGEX);
    if (indexMatch) {
      const fullMatch = indexMatch[0];
      const indexStr = indexMatch[1];
      const isOptional = fullMatch.endsWith('?');

      if (indexStr !== undefined) {
        segments.push({
          type: 'index',
          value: Number.parseInt(indexStr, 10),
          optional: isOptional,
        });
      }

      remaining = remaining.slice(fullMatch.length);
      continue;
    }

    // No match - invalid syntax
    throw new InvalidJsonPathError(
      path,
      `Unexpected character at position ${path.length - remaining.length}: "${remaining[0]}"`,
    );
  }

  // Must have at least root + one segment
  if (segments.length < 2) {
    throw new InvalidJsonPathError(path, 'Path must access at least one property (e.g., $.property)');
  }

  return {
    segments,
    optional: pathOptional || segments.some((s) => s.optional),
    original: path,
  };
}

/**
 * Get available keys from a value for error messages
 */
function getAvailableKeys(value: unknown): string[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((_, i) => `[${i}]`);
  }
  if (typeof value === 'object') {
    return Object.keys(value);
  }
  return [];
}

/**
 * Evaluate a parsed JSONPath against data
 *
 * @param parsed - Parsed JSONPath from parseJsonPath
 * @param data - Data to evaluate against (parsed JSON)
 * @returns Extracted value (may be null/undefined for optional paths)
 * @throws JsonPathNotFoundError if required path segment is not found
 *
 * @example
 * evaluateJsonPath(parseJsonPath("$.token"), { token: "abc" })
 * // Returns: "abc"
 */
export function evaluateJsonPath(parsed: ParsedJsonPath, data: unknown): unknown {
  let current: unknown = data;

  for (let i = 1; i < parsed.segments.length; i++) {
    const segment = parsed.segments[i];
    if (!segment) continue;

    // Handle null/undefined current value
    if (current === null || current === undefined) {
      if (segment.optional || parsed.optional) {
        return undefined;
      }
      throw new JsonPathNotFoundError(parsed.original, String(segment.value), []);
    }

    if (segment.type === 'property') {
      // Property access
      if (typeof current !== 'object' || Array.isArray(current)) {
        if (segment.optional || parsed.optional) {
          return undefined;
        }
        throw new JsonPathNotFoundError(parsed.original, String(segment.value), getAvailableKeys(current));
      }

      const obj = current as Record<string, unknown>;
      const key = segment.value as string;

      if (!(key in obj)) {
        if (segment.optional || parsed.optional) {
          return undefined;
        }
        throw new JsonPathNotFoundError(parsed.original, key, Object.keys(obj));
      }

      current = obj[key];
    } else if (segment.type === 'index') {
      // Array index access
      if (!Array.isArray(current)) {
        if (segment.optional || parsed.optional) {
          return undefined;
        }
        throw new JsonPathNotFoundError(parsed.original, `[${segment.value}]`, getAvailableKeys(current));
      }

      const index = segment.value as number;
      if (index < 0 || index >= current.length) {
        if (segment.optional || parsed.optional) {
          return undefined;
        }
        throw new JsonPathNotFoundError(
          parsed.original,
          `[${index}]`,
          current.map((_, i) => `[${i}]`),
        );
      }

      current = current[index];
    }
  }

  return current;
}

/**
 * Extract a value from data using a JSONPath expression
 *
 * Convenience function combining parse and evaluate.
 *
 * @param path - JSONPath expression
 * @param data - Data to extract from
 * @returns Extracted value
 * @throws InvalidJsonPathError if path syntax is invalid
 * @throws JsonPathNotFoundError if required path not found
 *
 * @example
 * extractByPath("$.data.id", { data: { id: 42 } })
 * // Returns: 42
 */
export function extractByPath(path: string, data: unknown): unknown {
  const parsed = parseJsonPath(path);
  return evaluateJsonPath(parsed, data);
}
