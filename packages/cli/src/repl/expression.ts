/**
 * Expression evaluator for the `_` response variable
 *
 * Provides access to the last HTTP response via dot-notation:
 * - _.status       → response status code (number)
 * - _.statusText   → response status text (string)
 * - _.headers      → response headers (object)
 * - _.headers.name → specific header (case-insensitive)
 * - _.body         → response body (parsed JSON or string)
 * - _.body.path    → JSONPath extraction from body
 * - _.timing       → timing information
 * - _.timing.total → specific timing value
 */

import type { TimingInfo } from '@unireq/http';
import { extractByPath, InvalidJsonPathError, JsonPathNotFoundError } from '../collections/jsonpath.js';

/**
 * Context for expression evaluation (from ReplState)
 */
export interface ResponseContext {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string;
  timing?: TimingInfo;
}

/**
 * Error thrown when expression evaluation fails
 */
export class ExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExpressionError';
    Object.setPrototypeOf(this, ExpressionError.prototype);
  }
}

/**
 * Error thrown when no response is available
 */
export class NoResponseError extends ExpressionError {
  constructor() {
    super('No response available. Execute a request first.');
    this.name = 'NoResponseError';
    Object.setPrototypeOf(this, NoResponseError.prototype);
  }
}

/**
 * Error thrown when expression path is invalid
 */
export class InvalidExpressionError extends ExpressionError {
  readonly expression: string;

  constructor(expression: string, reason: string) {
    super(`Invalid expression "${expression}": ${reason}`);
    this.name = 'InvalidExpressionError';
    this.expression = expression;
    Object.setPrototypeOf(this, InvalidExpressionError.prototype);
  }
}

/**
 * Error thrown when path is not found
 */
export class PathNotFoundError extends ExpressionError {
  readonly expression: string;
  readonly path: string;

  constructor(expression: string, path: string) {
    super(`Path not found: ${expression}`);
    this.name = 'PathNotFoundError';
    this.expression = expression;
    this.path = path;
    Object.setPrototypeOf(this, PathNotFoundError.prototype);
  }
}

/**
 * Check if an expression is a `_` variable expression
 */
export function isUnderscoreExpression(expr: string): boolean {
  const trimmed = expr.trim();
  return trimmed === '_' || trimmed.startsWith('_.');
}

/**
 * Check if there's a valid response context
 */
export function hasResponseContext(ctx: ResponseContext): boolean {
  return ctx.status !== undefined;
}

/**
 * Find header value with case-insensitive lookup
 */
function findHeader(headers: Record<string, string>, name: string): string | undefined {
  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }
  return undefined;
}

/**
 * Parse the body as JSON, returning parsed object or original string
 */
function parseBody(body: string): unknown {
  if (!body || body.trim() === '') {
    return body;
  }

  try {
    return JSON.parse(body);
  } catch {
    // Not JSON, return as string
    return body;
  }
}

/**
 * Convert a value to display string
 */
export function valueToString(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  // Objects and arrays - JSON stringify with indentation for readability
  return JSON.stringify(value, null, 2);
}

/**
 * Evaluate an underscore expression
 *
 * @param expr - Expression starting with `_` (e.g., "_.status", "_.body.data[0].id")
 * @param ctx - Response context from ReplState
 * @returns Evaluated value
 * @throws NoResponseError if no response is available
 * @throws InvalidExpressionError if expression syntax is invalid
 * @throws PathNotFoundError if path doesn't exist
 *
 * @example
 * evaluateExpression("_.status", { status: 200 })
 * // Returns: 200
 *
 * @example
 * evaluateExpression("_.body.data[0].id", { body: '{"data":[{"id":42}]}' })
 * // Returns: 42
 */
export function evaluateExpression(expr: string, ctx: ResponseContext): unknown {
  const trimmed = expr.trim();

  // Must start with _
  if (!isUnderscoreExpression(trimmed)) {
    throw new InvalidExpressionError(expr, 'Expression must start with _');
  }

  // Check for response context
  if (!hasResponseContext(ctx)) {
    throw new NoResponseError();
  }

  // Just _ returns the full response object
  if (trimmed === '_') {
    return {
      status: ctx.status,
      statusText: ctx.statusText,
      headers: ctx.headers ?? {},
      body: parseBody(ctx.body ?? ''),
      timing: ctx.timing,
    };
  }

  // Parse the path after _
  const path = trimmed.slice(2); // Remove "_."
  const segments = path.split('.');
  const firstSegment = segments[0];

  if (!firstSegment) {
    throw new InvalidExpressionError(expr, 'Empty path after _.');
  }

  // Handle top-level properties
  switch (firstSegment) {
    case 'status':
      if (segments.length > 1) {
        throw new InvalidExpressionError(expr, 'status is a primitive value, cannot access properties');
      }
      return ctx.status;

    case 'statusText':
      if (segments.length > 1) {
        throw new InvalidExpressionError(expr, 'statusText is a primitive value, cannot access properties');
      }
      return ctx.statusText;

    case 'headers': {
      const headers = ctx.headers ?? {};

      // Just _.headers
      if (segments.length === 1) {
        return headers;
      }

      // _.headers.name - case-insensitive lookup
      const headerName = segments.slice(1).join('.');
      const headerValue = findHeader(headers, headerName);

      // Return empty string for missing headers (not error)
      return headerValue ?? '';
    }

    case 'body': {
      const body = ctx.body ?? '';

      // Just _.body
      if (segments.length === 1) {
        return parseBody(body);
      }

      // _.body.path - use JSONPath
      const bodyPath = segments.slice(1).join('.');
      const parsedBody = parseBody(body);

      // If body is not an object, cannot extract path
      if (typeof parsedBody !== 'object' || parsedBody === null) {
        throw new InvalidExpressionError(expr, 'Cannot extract path from non-JSON body');
      }

      // Convert _.body.path to $.path for JSONPath
      const jsonPath = `$.${bodyPath}`;

      try {
        return extractByPath(jsonPath, parsedBody);
      } catch (error) {
        if (error instanceof InvalidJsonPathError) {
          throw new InvalidExpressionError(expr, error.message);
        }
        if (error instanceof JsonPathNotFoundError) {
          throw new PathNotFoundError(expr, jsonPath);
        }
        throw error;
      }
    }

    case 'timing': {
      const timing = ctx.timing;

      // Just _.timing
      if (segments.length === 1) {
        return timing;
      }

      // No timing available
      if (!timing) {
        throw new PathNotFoundError(expr, path);
      }

      // _.timing.property
      const timingProp = segments[1];
      if (!timingProp) {
        throw new InvalidExpressionError(expr, 'Empty timing property');
      }

      // Check if property exists on timing
      if (!(timingProp in timing)) {
        const available = Object.keys(timing).join(', ');
        throw new PathNotFoundError(expr, `${path} (available: ${available})`);
      }

      return timing[timingProp as keyof TimingInfo];
    }

    default:
      throw new InvalidExpressionError(
        expr,
        `Unknown property "${firstSegment}". Available: status, statusText, headers, body, timing`,
      );
  }
}

/**
 * Create a ResponseContext from ReplState fields
 */
export function createResponseContext(state: {
  lastResponseStatus?: number;
  lastResponseStatusText?: string;
  lastResponseHeaders?: Record<string, string>;
  lastResponseBody?: string;
  lastResponseTiming?: TimingInfo;
}): ResponseContext {
  return {
    status: state.lastResponseStatus,
    statusText: state.lastResponseStatusText,
    headers: state.lastResponseHeaders,
    body: state.lastResponseBody,
    timing: state.lastResponseTiming,
  };
}
