/**
 * Header redaction for security-sensitive output
 * Prevents accidental exposure of credentials in terminal output
 */

/**
 * Default headers that are always considered sensitive
 * All matching is case-insensitive
 */
export const DEFAULT_SENSITIVE_HEADERS: readonly string[] = [
  'authorization',
  'x-api-key',
  'api-key',
  'x-auth-token',
  'proxy-authorization',
  'cookie',
  'set-cookie',
];

/**
 * Redaction placeholder
 */
export const REDACTED = '[REDACTED]';

/**
 * Options for header redaction
 */
export interface RedactionOptions {
  /** Whether to show secrets (disable redaction) */
  showSecrets?: boolean;
  /** Additional patterns to match (case-insensitive, supports * wildcard) */
  additionalPatterns?: readonly string[];
}

/**
 * Check if a header name matches a pattern
 * Supports wildcard (*) at the end of patterns
 */
function matchesPattern(headerName: string, pattern: string): boolean {
  const lowerHeader = headerName.toLowerCase();
  const lowerPattern = pattern.toLowerCase();

  if (lowerPattern.endsWith('*')) {
    const prefix = lowerPattern.slice(0, -1);
    return lowerHeader.startsWith(prefix);
  }

  return lowerHeader === lowerPattern;
}

/**
 * Check if a header should be redacted
 */
export function shouldRedact(headerName: string, additionalPatterns: readonly string[] = []): boolean {
  const allPatterns = [...DEFAULT_SENSITIVE_HEADERS, ...additionalPatterns];

  for (const pattern of allPatterns) {
    if (matchesPattern(headerName, pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Extract prefix from Authorization-style headers
 * Returns [prefix, rest] or [null, value] if no prefix
 */
function extractAuthPrefix(value: string): [string | null, string] {
  // Common auth prefixes: Bearer, Basic, Digest, etc.
  const prefixMatch = value.match(/^(Bearer|Basic|Digest|HOBA|Mutual|Negotiate|OAuth|SCRAM-SHA-\d+|vapid)\s+/i);

  if (prefixMatch?.[1]) {
    return [prefixMatch[1], value.slice(prefixMatch[0].length)];
  }

  return [null, value];
}

/**
 * Redact a single header value
 * Preserves prefix for Authorization-style headers
 */
export function redactValue(headerName: string, value: string): string {
  const lowerName = headerName.toLowerCase();

  // For authorization headers, preserve the prefix
  if (lowerName === 'authorization' || lowerName === 'proxy-authorization') {
    const [prefix] = extractAuthPrefix(value);
    if (prefix) {
      return `${prefix} ${REDACTED}`;
    }
  }

  return REDACTED;
}

/**
 * Redact sensitive headers from a headers object
 * Returns a new object with redacted values
 */
export function redactHeaders(headers: Record<string, string>, options: RedactionOptions = {}): Record<string, string> {
  const { showSecrets = false, additionalPatterns = [] } = options;

  // If showing secrets, return headers as-is
  if (showSecrets) {
    return headers;
  }

  const result: Record<string, string> = {};

  for (const [name, value] of Object.entries(headers)) {
    if (shouldRedact(name, additionalPatterns)) {
      result[name] = redactValue(name, value);
    } else {
      result[name] = value;
    }
  }

  return result;
}
