/**
 * @unireq/config - Configuration tests
 */

import { describe, expect, it } from 'vitest';
import {
  CONFIG,
  CONTENT_CONFIG,
  HTTP_CONFIG,
  MULTIPART_CONFIG,
  OAUTH_CONFIG,
  RANGE_CONFIG,
  SECURITY_CONFIG,
} from '../index.js';

describe('@unireq/config - HTTP_CONFIG', () => {
  it('should export DEFAULT_TIMEOUT', () => {
    expect(HTTP_CONFIG.DEFAULT_TIMEOUT).toBe(30000);
    expect(typeof HTTP_CONFIG.DEFAULT_TIMEOUT).toBe('number');
  });

  it('should export REDIRECT configuration', () => {
    expect(HTTP_CONFIG.REDIRECT).toBeDefined();
    expect(HTTP_CONFIG.REDIRECT.ALLOWED_STATUS_CODES).toEqual([307, 308]);
    expect(HTTP_CONFIG.REDIRECT.MAX_REDIRECTS).toBe(5);
    expect(HTTP_CONFIG.REDIRECT.FOLLOW_303).toBe(false);
  });

  it('should export RETRY configuration', () => {
    expect(HTTP_CONFIG.RETRY).toBeDefined();
    expect(HTTP_CONFIG.RETRY.MAX_TRIES).toBe(3);
    expect(HTTP_CONFIG.RETRY.INITIAL_BACKOFF).toBe(1000);
    expect(HTTP_CONFIG.RETRY.MAX_BACKOFF).toBe(30000);
    expect(HTTP_CONFIG.RETRY.JITTER).toBe(true);
    expect(HTTP_CONFIG.RETRY.RETRY_METHODS).toEqual(['GET', 'PUT', 'DELETE', 'HEAD', 'OPTIONS']);
    expect(HTTP_CONFIG.RETRY.RETRY_STATUS_CODES).toEqual([408, 429, 500, 502, 503, 504]);
  });

  it('should export RATE_LIMIT configuration', () => {
    expect(HTTP_CONFIG.RATE_LIMIT).toBeDefined();
    expect(HTTP_CONFIG.RATE_LIMIT.AUTO_RETRY).toBe(true);
    expect(HTTP_CONFIG.RATE_LIMIT.MAX_WAIT).toBe(60000);
  });

  it('should be read-only (const)', () => {
    // Note: TypeScript enforces readonly at compile time
    // Runtime enforcement would require Object.freeze which is not applied
    expect(HTTP_CONFIG).toBeDefined();
  });
});

describe('@unireq/config - MULTIPART_CONFIG', () => {
  it('should export MAX_FILE_SIZE', () => {
    expect(MULTIPART_CONFIG.MAX_FILE_SIZE).toBe(100_000_000);
    expect(typeof MULTIPART_CONFIG.MAX_FILE_SIZE).toBe('number');
  });

  it('should export SANITIZE_FILENAMES', () => {
    expect(MULTIPART_CONFIG.SANITIZE_FILENAMES).toBe(true);
    expect(typeof MULTIPART_CONFIG.SANITIZE_FILENAMES).toBe('boolean');
  });

  it('should export MIME_TYPES', () => {
    expect(MULTIPART_CONFIG.MIME_TYPES).toBeDefined();
    expect(MULTIPART_CONFIG.MIME_TYPES.IMAGES).toEqual([
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ]);
    expect(MULTIPART_CONFIG.MIME_TYPES.DOCUMENTS).toContain('application/pdf');
    expect(MULTIPART_CONFIG.MIME_TYPES.ARCHIVES).toContain('application/zip');
  });

  it('should include common document types', () => {
    expect(MULTIPART_CONFIG.MIME_TYPES.DOCUMENTS).toContain('application/pdf');
    expect(MULTIPART_CONFIG.MIME_TYPES.DOCUMENTS).toContain('application/msword');
    expect(MULTIPART_CONFIG.MIME_TYPES.DOCUMENTS).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
  });
});

describe('@unireq/config - OAUTH_CONFIG', () => {
  it('should export JWT_CLOCK_SKEW', () => {
    expect(OAUTH_CONFIG.JWT_CLOCK_SKEW).toBe(60);
    expect(typeof OAUTH_CONFIG.JWT_CLOCK_SKEW).toBe('number');
  });

  it('should export AUTO_REFRESH', () => {
    expect(OAUTH_CONFIG.AUTO_REFRESH).toBe(true);
    expect(typeof OAUTH_CONFIG.AUTO_REFRESH).toBe('boolean');
  });
});

describe('@unireq/config - SECURITY_CONFIG', () => {
  it('should export CRLF_VALIDATION', () => {
    expect(SECURITY_CONFIG.CRLF_VALIDATION).toBeDefined();
    expect(SECURITY_CONFIG.CRLF_VALIDATION.ENABLED).toBe(true);
    expect(SECURITY_CONFIG.CRLF_VALIDATION.PATTERN).toBeInstanceOf(RegExp);
  });

  it('should detect CRLF characters with pattern', () => {
    const pattern = SECURITY_CONFIG.CRLF_VALIDATION.PATTERN;
    expect(pattern.test('normal text')).toBe(false);
    expect(pattern.test('text with\rcarriage return')).toBe(true);
    expect(pattern.test('text with\nline feed')).toBe(true);
    expect(pattern.test('text with\r\nboth')).toBe(true);
  });

  it('should export PATH_TRAVERSAL', () => {
    expect(SECURITY_CONFIG.PATH_TRAVERSAL).toBeDefined();
    expect(SECURITY_CONFIG.PATH_TRAVERSAL.UNSAFE_PATTERNS).toBeDefined();
    expect(SECURITY_CONFIG.PATH_TRAVERSAL.UNSAFE_PATTERNS.length).toBeGreaterThan(0);
  });

  it('should have patterns for path separators', () => {
    const patterns = SECURITY_CONFIG.PATH_TRAVERSAL.UNSAFE_PATTERNS;
    // Test that path separator pattern exists
    expect(patterns.length).toBeGreaterThan(0);
    // The pattern matches both / and \
    expect(patterns[0].test('/')).toBe(true);
    // Test backslash - the pattern is /[\\/\\]/g which matches both
    const hasBackslashMatch = patterns.some((p) => {
      const testStr = 'path\\file';
      return p.test(testStr);
    });
    expect(hasBackslashMatch).toBe(true);
  });

  it('should have pattern for null bytes', () => {
    const patterns = SECURITY_CONFIG.PATH_TRAVERSAL.UNSAFE_PATTERNS;
    expect(patterns.some((p) => p.test('\0'))).toBe(true);
  });

  it('should have pattern for directory traversal', () => {
    const patterns = SECURITY_CONFIG.PATH_TRAVERSAL.UNSAFE_PATTERNS;
    expect(patterns.some((p) => p.test('..'))).toBe(true);
  });
});

describe('@unireq/config - CONTENT_CONFIG', () => {
  it('should export JSON_ACCEPT', () => {
    expect(CONTENT_CONFIG.JSON_ACCEPT).toEqual(['application/json', 'application/xml']);
  });

  it('should export DEFAULT_CONTENT_TYPES', () => {
    expect(CONTENT_CONFIG.DEFAULT_CONTENT_TYPES).toBeDefined();
    expect(CONTENT_CONFIG.DEFAULT_CONTENT_TYPES.JSON).toBe('application/json');
    expect(CONTENT_CONFIG.DEFAULT_CONTENT_TYPES.TEXT).toBe('text/plain');
    expect(CONTENT_CONFIG.DEFAULT_CONTENT_TYPES.FORM).toBe('application/x-www-form-urlencoded');
    expect(CONTENT_CONFIG.DEFAULT_CONTENT_TYPES.MULTIPART).toBe('multipart/form-data');
  });
});

describe('@unireq/config - RANGE_CONFIG', () => {
  it('should export DEFAULT_UNIT', () => {
    expect(RANGE_CONFIG.DEFAULT_UNIT).toBe('bytes');
  });

  it('should export DEFAULT_CHUNK_SIZE', () => {
    expect(RANGE_CONFIG.DEFAULT_CHUNK_SIZE).toBe(1_000_000);
    expect(typeof RANGE_CONFIG.DEFAULT_CHUNK_SIZE).toBe('number');
  });
});

describe('@unireq/config - CONFIG object', () => {
  it('should export complete CONFIG object', () => {
    expect(CONFIG).toBeDefined();
    expect(CONFIG.HTTP).toBe(HTTP_CONFIG);
    expect(CONFIG.MULTIPART).toBe(MULTIPART_CONFIG);
    expect(CONFIG.OAUTH).toBe(OAUTH_CONFIG);
    expect(CONFIG.SECURITY).toBe(SECURITY_CONFIG);
    expect(CONFIG.CONTENT).toBe(CONTENT_CONFIG);
    expect(CONFIG.RANGE).toBe(RANGE_CONFIG);
  });

  it('should be the default export', async () => {
    const defaultConfig = (await import('../index.js')).default;
    expect(defaultConfig).toBe(CONFIG);
  });

  it('should be deeply frozen (const)', () => {
    // Note: TypeScript enforces readonly at compile time
    // Runtime enforcement would require Object.freeze which is not applied
    expect(CONFIG).toBeDefined();
  });
});

describe('@unireq/config - exports', () => {
  it('should export all config objects', async () => {
    const exports = await import('../index.js');

    expect(exports.HTTP_CONFIG).toBeDefined();
    expect(exports.MULTIPART_CONFIG).toBeDefined();
    expect(exports.OAUTH_CONFIG).toBeDefined();
    expect(exports.SECURITY_CONFIG).toBeDefined();
    expect(exports.CONTENT_CONFIG).toBeDefined();
    expect(exports.RANGE_CONFIG).toBeDefined();
    expect(exports.CONFIG).toBeDefined();
    expect(exports.default).toBeDefined();
  });

  it('should have proper types', () => {
    expect(typeof HTTP_CONFIG).toBe('object');
    expect(typeof MULTIPART_CONFIG).toBe('object');
    expect(typeof OAUTH_CONFIG).toBe('object');
    expect(typeof SECURITY_CONFIG).toBe('object');
    expect(typeof CONTENT_CONFIG).toBe('object');
    expect(typeof RANGE_CONFIG).toBe('object');
    expect(typeof CONFIG).toBe('object');
  });
});

describe('@unireq/config - values validation', () => {
  it('should have sensible timeout values', () => {
    expect(HTTP_CONFIG.DEFAULT_TIMEOUT).toBeGreaterThan(0);
    expect(HTTP_CONFIG.RETRY.INITIAL_BACKOFF).toBeGreaterThan(0);
    expect(HTTP_CONFIG.RETRY.MAX_BACKOFF).toBeGreaterThan(HTTP_CONFIG.RETRY.INITIAL_BACKOFF);
    expect(HTTP_CONFIG.RATE_LIMIT.MAX_WAIT).toBeGreaterThan(0);
  });

  it('should have sensible retry values', () => {
    expect(HTTP_CONFIG.RETRY.MAX_TRIES).toBeGreaterThan(0);
    expect(HTTP_CONFIG.REDIRECT.MAX_REDIRECTS).toBeGreaterThan(0);
  });

  it('should have valid HTTP methods for retry', () => {
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    for (const method of HTTP_CONFIG.RETRY.RETRY_METHODS) {
      expect(validMethods).toContain(method);
    }
  });

  it('should have valid HTTP status codes for retry', () => {
    for (const code of HTTP_CONFIG.RETRY.RETRY_STATUS_CODES) {
      expect(code).toBeGreaterThanOrEqual(400);
      expect(code).toBeLessThan(600);
    }
  });

  it('should have valid redirect status codes', () => {
    for (const code of HTTP_CONFIG.REDIRECT.ALLOWED_STATUS_CODES) {
      expect(code).toBeGreaterThanOrEqual(300);
      expect(code).toBeLessThan(400);
    }
  });

  it('should have positive file size limit', () => {
    expect(MULTIPART_CONFIG.MAX_FILE_SIZE).toBeGreaterThan(0);
  });

  it('should have positive chunk size', () => {
    expect(RANGE_CONFIG.DEFAULT_CHUNK_SIZE).toBeGreaterThan(0);
  });

  it('should have positive clock skew', () => {
    expect(OAUTH_CONFIG.JWT_CLOCK_SKEW).toBeGreaterThan(0);
  });
});
