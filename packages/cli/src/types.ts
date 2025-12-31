/**
 * CLI types for @unireq/cli
 */

/**
 * HTTP method type
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * Parsed request from CLI arguments
 * This is the intermediate representation before execution
 */
export interface ParsedRequest {
  /** HTTP method */
  method: HttpMethod;
  /** Target URL (absolute or relative) */
  url: string;
  /** Headers as key:value pairs */
  headers: string[];
  /** Query parameters as key=value pairs */
  query: string[];
  /** Request body (string or @filepath) */
  body?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Global CLI options that apply to all commands
 */
export interface GlobalOptions {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Show trace output (request/response details) */
  trace?: boolean;
  /** Raw output mode (no formatting) */
  raw?: boolean;
  /** Disable colors in output */
  noColor?: boolean;
}

/**
 * Request command options (extends global)
 */
export interface RequestOptions extends GlobalOptions {
  /** Headers to add (repeatable) */
  header?: string[];
  /** Query params to add (repeatable) */
  query?: string[];
  /** Request body */
  body?: string;
}
