/**
 * History entry types for NDJSON logging
 */

/**
 * Base history entry with common fields
 */
export interface BaseHistoryEntry {
  /** Entry type discriminator */
  type: 'cmd' | 'http';
  /** ISO 8601 timestamp */
  timestamp: string;
}

/**
 * REPL command history entry
 */
export interface CmdEntry extends BaseHistoryEntry {
  type: 'cmd';
  /** Command name (e.g., "cd", "ls", "get") */
  command: string;
  /** Command arguments */
  args: string[];
  /** Whether command succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * HTTP request/response history entry
 */
export interface HttpEntry extends BaseHistoryEntry {
  type: 'http';
  /** HTTP method */
  method: string;
  /** Request URL */
  url: string;
  /** Original command string (with all flags) for history recall */
  rawCommand?: string;
  /** Request headers (redacted) */
  requestHeaders?: Record<string, string>;
  /** Request body (redacted, truncated) */
  requestBody?: string;
  /** Whether request body was truncated */
  requestBodyTruncated?: boolean;
  /** Response status code (null if request failed) */
  status: number | null;
  /** Response headers */
  responseHeaders?: Record<string, string>;
  /** Response body (truncated) */
  responseBody?: string;
  /** Whether response body was truncated */
  responseBodyTruncated?: boolean;
  /** Request duration in milliseconds */
  durationMs?: number;
  /** Error message if request failed */
  error?: string;
  /** Number of assertions passed */
  assertionsPassed?: number;
  /** Number of assertions failed */
  assertionsFailed?: number;
  /** Names of extracted variables (not values) */
  extractedVars?: string[];
}

/**
 * Union type for all history entries
 */
export type HistoryEntry = CmdEntry | HttpEntry;

/**
 * History writer configuration
 */
export interface HistoryWriterConfig {
  /** Path to history file */
  historyPath: string;
  /** Maximum number of entries before rotation (default: 10000) */
  maxEntries?: number;
  /** Percentage of entries to keep on rotation (default: 0.8) */
  rotationKeepRatio?: number;
  /** Maximum body size in bytes before truncation (default: 10240 = 10KB) */
  maxBodySize?: number;
}

/**
 * Default configuration values
 */
export const HISTORY_DEFAULTS = {
  maxEntries: 10000,
  rotationKeepRatio: 0.8,
  maxBodySize: 10240, // 10KB
  historyFileName: 'history.ndjson',
} as const;
