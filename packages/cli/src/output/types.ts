/**
 * Output formatting types
 */

/**
 * Output mode for response display
 */
export type OutputMode = 'pretty' | 'json' | 'raw';

/**
 * Options for output formatting
 */
export interface OutputOptions {
  /** Output mode (default: 'pretty') */
  mode: OutputMode;
  /** Force colors on/off (default: auto-detect) */
  forceColors?: boolean;
  /** Show secrets in output (disable redaction) */
  showSecrets?: boolean;
  /** Additional header patterns to redact */
  redactionPatterns?: readonly string[];
  /** Include response headers in output (default: false) */
  includeHeaders?: boolean;
  /** Show summary footer with status and size (default: false) */
  showSummary?: boolean;
  /** Hide response body in output (default: false) */
  hideBody?: boolean;
}

/**
 * Response data structure for formatting
 */
export interface FormattableResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
}
