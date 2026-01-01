/**
 * Sensitive data redaction for history logging
 */

/** Placeholder for redacted values */
const REDACTED = '[REDACTED]';

/**
 * Headers that should be redacted
 */
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'x-api-key',
  'api-key',
  'x-auth-token',
  'cookie',
  'set-cookie',
  'x-csrf-token',
  'x-xsrf-token',
  'proxy-authorization',
]);

/**
 * Body field names that should be redacted (case-insensitive)
 */
const SENSITIVE_FIELDS = new Set([
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'access_token',
  'refresh_token',
  'client_secret',
  'private_key',
  'credentials',
]);

/**
 * Redact sensitive headers
 * @param headers - Headers to redact
 * @returns Headers with sensitive values replaced
 */
export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_HEADERS.has(lowerKey)) {
      result[key] = REDACTED;
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Redact sensitive fields in a JSON body
 * @param body - Body string to redact
 * @returns Redacted body string
 */
export function redactBody(body: string): string {
  if (!body) return body;

  // Try to parse as JSON
  try {
    const parsed = JSON.parse(body);
    const redacted = redactObject(parsed);
    return JSON.stringify(redacted);
  } catch {
    // Not JSON, return as-is
    return body;
  }
}

/**
 * Recursively redact sensitive fields in an object
 */
function redactObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_FIELDS.has(lowerKey)) {
        result[key] = REDACTED;
      } else if (typeof value === 'object' && value !== null) {
        result[key] = redactObject(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  return obj;
}

/**
 * Result of body truncation
 */
export interface TruncateResult {
  body: string;
  truncated: boolean;
}

/**
 * Truncate body to maximum size
 * @param body - Body string to truncate
 * @param maxSize - Maximum size in bytes
 * @returns Truncated body and truncation flag
 */
export function truncateBody(body: string, maxSize: number): TruncateResult {
  if (!body) {
    return { body, truncated: false };
  }

  const bodyBytes = Buffer.byteLength(body, 'utf8');

  if (bodyBytes <= maxSize) {
    return { body, truncated: false };
  }

  // Truncate by bytes, not characters (for proper UTF-8 handling)
  const buffer = Buffer.from(body, 'utf8');
  const truncatedBuffer = buffer.subarray(0, maxSize);

  // Ensure we don't cut in the middle of a multi-byte character
  let truncatedString = truncatedBuffer.toString('utf8');

  // If the last character is a replacement character, remove it
  if (truncatedString.endsWith('\uFFFD')) {
    truncatedString = truncatedString.slice(0, -1);
  }

  return {
    body: `${truncatedString}...[truncated]`,
    truncated: true,
  };
}

/**
 * Check if a response body is likely binary
 * @param body - Body to check
 * @returns True if body appears to be binary
 */
export function isBinaryBody(body: string): boolean {
  if (!body) return false;

  // Check for null bytes or high ratio of non-printable characters
  let nonPrintable = 0;
  const sampleSize = Math.min(body.length, 1000);

  for (let i = 0; i < sampleSize; i++) {
    const code = body.charCodeAt(i);
    // Null byte or control characters (except common ones)
    if (code === 0 || (code < 32 && code !== 9 && code !== 10 && code !== 13)) {
      nonPrintable++;
    }
  }

  // If more than 10% non-printable, likely binary
  return nonPrintable / sampleSize > 0.1;
}
