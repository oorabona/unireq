/**
 * @unireq/config - Centralized configuration for unireq
 * Externalizes hardcoded defaults for security and maintainability
 * Values can be overridden via environment variables (UNIREQ_* prefix)
 */

/**
 * Gets environment variable as number with fallback
 */
function getEnvNumber(key: string, fallback: number): number {
  const value = typeof process !== 'undefined' && process.env ? process.env[key] : undefined;
  const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Gets environment variable as boolean with fallback
 */
function getEnvBoolean(key: string, fallback: boolean): boolean {
  const value = typeof process !== 'undefined' && process.env ? process.env[key] : undefined;
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * HTTP configuration defaults
 * Can be overridden with UNIREQ_HTTP_TIMEOUT environment variable
 */
export const HTTP_CONFIG = {
  /** Default timeout for requests (ms) */
  DEFAULT_TIMEOUT: getEnvNumber('UNIREQ_HTTP_TIMEOUT', 30000),

  /** Default redirect policy */
  REDIRECT: {
    /** Allowed redirect status codes (307/308 only for safety) */
    ALLOWED_STATUS_CODES: [307, 308] as const,
    /** Maximum number of redirects to follow */
    MAX_REDIRECTS: 5,
    /** Follow 303 See Other redirects (opt-in) */
    FOLLOW_303: false,
  },

  /** Retry policy defaults */
  RETRY: {
    /** Number of retry attempts */
    MAX_TRIES: 3,
    /** Initial backoff delay (ms) */
    INITIAL_BACKOFF: 1000,
    /** Maximum backoff delay (ms) */
    MAX_BACKOFF: 30000,
    /** Enable jitter for backoff */
    JITTER: true,
    /** HTTP methods eligible for retry */
    RETRY_METHODS: ['GET', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'] as const,
    /** Status codes that trigger retry */
    RETRY_STATUS_CODES: [408, 429, 500, 502, 503, 504] as const,
  },

  /** Rate limit handling */
  RATE_LIMIT: {
    /** Automatically retry on rate limit (429/503) */
    AUTO_RETRY: true,
    /** Maximum wait time for rate limit (ms) */
    MAX_WAIT: 60000,
  },
} as const;

/**
 * Multipart upload security defaults
 * Can be overridden with UNIREQ_MULTIPART_MAX_FILE_SIZE and UNIREQ_MULTIPART_SANITIZE_FILENAMES
 */
export const MULTIPART_CONFIG = {
  /** Maximum file size (bytes) - 100 MB */
  MAX_FILE_SIZE: getEnvNumber('UNIREQ_MULTIPART_MAX_FILE_SIZE', 100_000_000),

  /** Enable filename sanitization by default */
  SANITIZE_FILENAMES: getEnvBoolean('UNIREQ_MULTIPART_SANITIZE_FILENAMES', true),

  /** Common allowed MIME types by category */
  MIME_TYPES: {
    IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'] as const,
    DOCUMENTS: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ] as const,
    ARCHIVES: ['application/zip', 'application/x-tar', 'application/gzip'] as const,
  },

  /**
   * Default secure whitelist for multipart uploads (OWASP A01:2021 - Broken Access Control)
   * Includes common safe file types: images, documents, text, and binary data
   * @security This whitelist prevents unrestricted file upload attacks
   */
  DEFAULT_ALLOWED_MIME_TYPES: [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Text
    'text/plain',
    'text/csv',
    'text/html',
    'text/markdown',
    // JSON/XML
    'application/json',
    'application/xml',
    'text/xml',
    // Binary (safe generic types)
    'application/octet-stream',
  ] as const,
} as const;

/**
 * OAuth/JWT security defaults
 * Can be overridden with UNIREQ_JWT_CLOCK_SKEW and UNIREQ_OAUTH_AUTO_REFRESH
 */
export const OAUTH_CONFIG = {
  /** Clock skew tolerance for JWT expiration (seconds) */
  JWT_CLOCK_SKEW: getEnvNumber('UNIREQ_JWT_CLOCK_SKEW', 60),

  /** Automatically refresh tokens on 401 */
  AUTO_REFRESH: getEnvBoolean('UNIREQ_OAUTH_AUTO_REFRESH', true),
} as const;

/**
 * Security configuration
 */
export const SECURITY_CONFIG = {
  /** CRLF injection validation (always enabled, cannot be disabled) */
  CRLF_VALIDATION: {
    ENABLED: true,
    /** Pattern to detect CRLF characters */
    PATTERN: /[\r\n]/,
  } as const,

  /** Path traversal prevention patterns */
  PATH_TRAVERSAL: {
    /** Patterns to sanitize in filenames */
    UNSAFE_PATTERNS: [
      /[/\\]/g, // Path separators
      /\0/g, // Null bytes
      /\.\./g, // Directory traversal
    ] as const,
  } as const,
} as const;

/**
 * Content negotiation defaults
 */
export const CONTENT_CONFIG = {
  /** Default Accept header for JSON APIs */
  JSON_ACCEPT: ['application/json', 'application/xml'] as const,

  /** Default content types */
  DEFAULT_CONTENT_TYPES: {
    JSON: 'application/json',
    TEXT: 'text/plain',
    FORM: 'application/x-www-form-urlencoded',
    MULTIPART: 'multipart/form-data',
  } as const,
} as const;

/**
 * Range request configuration
 */
export const RANGE_CONFIG = {
  /** Default unit for range requests */
  DEFAULT_UNIT: 'bytes' as const,

  /** Default chunk size for range requests (1 MB) */
  DEFAULT_CHUNK_SIZE: 1_000_000,
} as const;

/**
 * Complete configuration object
 */
export const CONFIG = {
  HTTP: HTTP_CONFIG,
  MULTIPART: MULTIPART_CONFIG,
  OAUTH: OAUTH_CONFIG,
  SECURITY: SECURITY_CONFIG,
  CONTENT: CONTENT_CONFIG,
  RANGE: RANGE_CONFIG,
} as const;

/**
 * Type-safe configuration access
 */
export type UnireqConfig = typeof CONFIG;

/**
 * Export individual configs for tree-shaking
 */
export default CONFIG;
