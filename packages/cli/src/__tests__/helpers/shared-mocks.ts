/**
 * Shared mock data and utilities for both mock-server and MSW handlers
 * This ensures consistency between local examples and integration tests
 */

/**
 * Mock API endpoints configuration
 */
export const MOCK_ENDPOINTS = {
  // Mock server (local examples)
  LOCAL: 'http://localhost:3001',
  // MSW (integration tests)
  TEST: 'https://api.test.local',
} as const;

/**
 * Common paths used across handlers
 */
export const PATHS = {
  POST: '/post',
  ANYTHING: '/anything',
  UPLOAD: '/upload',
  STATUS: '/status',
  HTML: '/html',
  DELAY: '/delay',
  GET: '/get',
  ETAG: '/etag',
  CACHE: '/cache',
  RESPONSE_HEADERS: '/response-headers',
  PROTECTED: '/protected',
  FLAKY: '/flaky',
  ALWAYS_FAILS: '/always-fails',
  RATE_LIMITED: '/rate-limited',
} as const;

/**
 * Common response data structures
 */
export const RESPONSE_MESSAGES = {
  UPLOAD_SUCCESS: 'Upload successful',
  ACCESS_GRANTED: 'Access granted',
  SUCCESS_AFTER_RETRIES: 'Success after retries',
  UNAUTHORIZED: 'Unauthorized',
  INVALID_TOKEN: 'Invalid token',
  INVALID_TOKEN_FORMAT: 'Invalid token format',
  TOKEN_EXPIRED: 'Token expired',
  MULTIPART_EXPECTED: 'Expected multipart/form-data',
  MULTIPART_PARSE_FAILED: 'Failed to parse multipart data',
  INTERNAL_SERVER_ERROR: 'Internal server error',
  PERSISTENT_FAILURE: 'Persistent failure',
  TOO_MANY_REQUESTS: 'Too many requests',
  NOT_FOUND: 'Not Found',
  OK: 'OK',
  CUSTOM_STATUS: 'Custom Status',
} as const;

/**
 * Status code messages
 */
export const STATUS_MESSAGES: Record<number, string> = {
  200: RESPONSE_MESSAGES.OK,
  404: RESPONSE_MESSAGES.NOT_FOUND,
  500: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR,
};

/**
 * File metadata structure
 */
export interface FileMetadata {
  filename: string;
  size: number;
  type: string;
}

/**
 * Multipart response structure
 */
export interface MultipartResponse {
  success?: boolean;
  message?: string;
  files: Record<string, FileMetadata>;
  form?: Record<string, string>;
  fields?: Record<string, string>;
  headers?: Record<string, string>;
}

/**
 * Parse multipart form data and extract files and fields
 */
export function extractMultipartData(formData: FormData): {
  files: Record<string, FileMetadata>;
  fields: Record<string, string>;
} {
  const files: Record<string, FileMetadata> = {};
  const fields: Record<string, string> = {};

  // Use forEach instead of entries() for broader TypeScript compatibility
  formData.forEach((value, name) => {
    if (value instanceof File) {
      files[name] = {
        filename: value.name,
        size: value.size,
        type: value.type,
      };
    } else {
      fields[name] = value;
    }
  });

  return { files, fields };
}

/**
 * Create multipart upload success response
 */
export function createMultipartSuccessResponse(
  files: Record<string, FileMetadata>,
  fields: Record<string, string>,
  includeMessage = true,
): MultipartResponse {
  const response: MultipartResponse = {
    files,
  };

  if (includeMessage) {
    response.message = RESPONSE_MESSAGES.UPLOAD_SUCCESS;
    response.fields = fields;
  } else {
    response.success = true;
    response.form = fields;
  }

  return response;
}

/**
 * Parse form urlencoded data
 */
export function parseFormUrlEncoded(text: string): Record<string, string> {
  const params = new URLSearchParams(text);
  const form: Record<string, string> = {};

  for (const [key, value] of params.entries()) {
    form[key] = value;
  }

  return form;
}

/**
 * Create status code response
 */
export function createStatusResponse(code: number): { status: number; message: string } {
  return {
    status: code,
    message: STATUS_MESSAGES[code] || RESPONSE_MESSAGES.CUSTOM_STATUS,
  };
}

/**
 * HTML response content
 */
export const HTML_RESPONSE = '<html><body><h1>This is HTML, not JSON</h1></body></html>';

/**
 * OAuth Bearer token validation
 */
export interface TokenPayload {
  sub?: string;
  exp?: number;
  v?: number;
}

/**
 * Parse and validate JWT token (unsafe, for testing only)
 */
export function parseJWT(token: string): { valid: boolean; payload?: TokenPayload; error?: string } {
  // Validate token format
  if (!token.includes('.')) {
    return { valid: false, error: RESPONSE_MESSAGES.INVALID_TOKEN_FORMAT };
  }

  try {
    const parts = token.split('.');
    if (!parts[1]) {
      return { valid: false, error: RESPONSE_MESSAGES.INVALID_TOKEN_FORMAT };
    }
    const payload = JSON.parse(atob(parts[1])) as TokenPayload;

    // Check expiration
    if (payload.exp && payload.exp <= Math.floor(Date.now() / 1000)) {
      return { valid: false, error: RESPONSE_MESSAGES.TOKEN_EXPIRED };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, error: RESPONSE_MESSAGES.INVALID_TOKEN };
  }
}

/**
 * Create OAuth success response
 */
export function createOAuthSuccessResponse(payload: TokenPayload) {
  return {
    message: RESPONSE_MESSAGES.ACCESS_GRANTED,
    user: payload.sub || 'test-user',
    tokenVersion: payload.v || 1,
  };
}

/**
 * Create OAuth error response data
 */
export function createOAuthErrorResponse(error: string) {
  return { error };
}

/**
 * HTTP headers for OAuth errors
 */
export const OAUTH_HEADERS = {
  UNAUTHORIZED: { 'www-authenticate': 'Bearer realm="test"' },
  INVALID_TOKEN: { 'www-authenticate': 'Bearer realm="test" error="invalid_token"' },
} as const;

/**
 * Retry logic configuration
 */
export const RETRY_CONFIG = {
  FLAKY_SUCCESS_AFTER: 3,
  RATE_LIMIT_RETRY_AFTER: '1',
} as const;

/**
 * Create retry success response
 */
export function createRetrySuccessResponse(totalAttempts: number) {
  return {
    message: RESPONSE_MESSAGES.SUCCESS_AFTER_RETRIES,
    totalAttempts,
  };
}

/**
 * Create retry error response
 */
export function createRetryErrorResponse(attempt: number) {
  return {
    error: RESPONSE_MESSAGES.INTERNAL_SERVER_ERROR,
    attempt,
  };
}

/**
 * Create delay response
 */
export function createDelayResponse(seconds: number) {
  return {
    delayed: true,
    seconds,
  };
}
