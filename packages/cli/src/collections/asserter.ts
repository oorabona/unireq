/**
 * Assertions engine for validating HTTP responses
 */

import { extractByPath, InvalidJsonPathError, JsonPathNotFoundError } from './jsonpath.js';
import type { AssertConfig, JsonAssertion } from './types.js';

/**
 * Result of a single assertion
 */
export interface AssertionResult {
  /** Whether the assertion passed */
  passed: boolean;
  /** Human-readable message (success or failure details) */
  message: string;
  /** The assertion type/description for reporting */
  assertion: string;
}

/**
 * Response data needed for assertions
 */
export interface AssertableResponse {
  /** HTTP status code */
  status: number;
  /** Response headers (case-insensitive lookup) */
  headers: Record<string, string>;
  /** Response body as string */
  body: string;
}

/**
 * Error thrown for invalid assertion configuration
 */
export class InvalidAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAssertionError';
  }
}

/**
 * Assert HTTP status code
 */
export function assertStatus(expected: number, actual: number): AssertionResult {
  const passed = expected === actual;
  return {
    passed,
    message: passed ? `Status: ${actual} ✓` : `Status: expected ${expected}, got ${actual}`,
    assertion: `status: ${expected}`,
  };
}

/**
 * Assert a header value (case-insensitive header name)
 */
export function assertHeader(name: string, expected: string, headers: Record<string, string>): AssertionResult {
  // Find header case-insensitively
  const lowerName = name.toLowerCase();
  const headerEntry = Object.entries(headers).find(([key]) => key.toLowerCase() === lowerName);

  if (!headerEntry) {
    return {
      passed: false,
      message: `Header '${name}' not found`,
      assertion: `header: ${name}`,
    };
  }

  const actual = headerEntry[1];
  const passed = actual === expected;

  return {
    passed,
    message: passed ? `Header ${name}: '${actual}' ✓` : `Header ${name}: expected '${expected}', got '${actual}'`,
    assertion: `header: ${name}`,
  };
}

/**
 * Assert response body contains a string
 */
export function assertContains(expected: string, body: string): AssertionResult {
  const passed = body.includes(expected);
  return {
    passed,
    message: passed
      ? `Body contains '${expected.slice(0, 30)}${expected.length > 30 ? '...' : ''}' ✓`
      : `Body does not contain '${expected.slice(0, 50)}${expected.length > 50 ? '...' : ''}'`,
    assertion: `contains: ${expected.slice(0, 30)}${expected.length > 30 ? '...' : ''}`,
  };
}

/**
 * Assert a JSON path condition
 */
export function assertJsonPath(assertion: JsonAssertion, body: string): AssertionResult {
  const { path, op, value, pattern } = assertion;

  // Try to parse JSON
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return {
      passed: false,
      message: 'Response is not valid JSON',
      assertion: `json: ${path}`,
    };
  }

  // Evaluate the path
  let actual: unknown;
  try {
    actual = extractByPath(path, data);
  } catch (error) {
    if (error instanceof JsonPathNotFoundError) {
      if (op === 'exists') {
        return {
          passed: false,
          message: `${path}: path not found`,
          assertion: `json: ${path} exists`,
        };
      }
      return {
        passed: false,
        message: `${path}: path not found`,
        assertion: `json: ${path} ${op}`,
      };
    }
    if (error instanceof InvalidJsonPathError) {
      return {
        passed: false,
        message: `Invalid JSONPath: ${error.message}`,
        assertion: `json: ${path}`,
      };
    }
    throw error;
  }

  switch (op) {
    case 'exists': {
      const passed = actual !== undefined && actual !== null;
      return {
        passed,
        message: passed ? `${path}: exists ✓` : `${path}: does not exist`,
        assertion: `json: ${path} exists`,
      };
    }

    case 'equals': {
      // Deep equality for objects/arrays, strict for primitives
      const passed = deepEquals(actual, value);
      const actualStr = formatValue(actual);
      const expectedStr = formatValue(value);
      return {
        passed,
        message: passed ? `${path}: equals ${expectedStr} ✓` : `${path}: expected ${expectedStr}, got ${actualStr}`,
        assertion: `json: ${path} equals`,
      };
    }

    case 'contains': {
      // For strings: substring match
      // For arrays: includes element
      // For objects: has key or value
      const actualStr = String(actual);
      const valueStr = String(value);
      const passed = actualStr.includes(valueStr);
      return {
        passed,
        message: passed ? `${path}: contains '${valueStr}' ✓` : `${path}: does not contain '${valueStr}'`,
        assertion: `json: ${path} contains`,
      };
    }

    case 'matches': {
      if (!pattern) {
        return {
          passed: false,
          message: `${path}: 'matches' requires a 'pattern' property`,
          assertion: `json: ${path} matches`,
        };
      }

      let regex: RegExp;
      try {
        regex = new RegExp(pattern);
      } catch {
        return {
          passed: false,
          message: `Invalid regex pattern: ${pattern}`,
          assertion: `json: ${path} matches`,
        };
      }

      const actualStr = String(actual);
      const passed = regex.test(actualStr);
      return {
        passed,
        message: passed ? `${path}: matches pattern ✓` : `${path}: does not match pattern '${pattern}'`,
        assertion: `json: ${path} matches`,
      };
    }

    default:
      return {
        passed: false,
        message: `Unknown operator: ${op}`,
        assertion: `json: ${path}`,
      };
  }
}

/**
 * Deep equality comparison
 */
function deepEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object') return a === b;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => deepEquals(val, b[i]));
  }

  if (Array.isArray(a) || Array.isArray(b)) return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);

  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => deepEquals(aObj[key], bObj[key]));
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return `'${value}'`;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Evaluate all assertions against a response
 * Returns all results (does not short-circuit on first failure)
 */
export function assertResponse(config: AssertConfig, response: AssertableResponse): AssertionResult[] {
  const results: AssertionResult[] = [];

  // Status assertion
  if (config.status !== undefined) {
    results.push(assertStatus(config.status, response.status));
  }

  // Header assertions
  if (config.headers) {
    for (const [name, expected] of Object.entries(config.headers)) {
      results.push(assertHeader(name, expected, response.headers));
    }
  }

  // Body contains assertion
  if (config.contains !== undefined) {
    results.push(assertContains(config.contains, response.body));
  }

  // JSON path assertions
  if (config.json) {
    for (const jsonAssertion of config.json) {
      results.push(assertJsonPath(jsonAssertion, response.body));
    }
  }

  return results;
}

/**
 * Check if all assertions passed
 */
export function allPassed(results: AssertionResult[]): boolean {
  return results.every((r) => r.passed);
}

/**
 * Get failed assertions
 */
export function getFailures(results: AssertionResult[]): AssertionResult[] {
  return results.filter((r) => !r.passed);
}
