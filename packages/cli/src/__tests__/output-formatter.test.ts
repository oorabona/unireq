/**
 * Tests for output formatter
 */

import { describe, expect, it } from 'vitest';
import { formatJson, formatPretty, formatRaw, formatResponse } from '../output/formatter.js';
import type { FormattableResponse, OutputOptions } from '../output/types.js';

describe('output/formatter', () => {
  // Sample responses for testing
  const successResponse: FormattableResponse = {
    status: 200,
    statusText: 'OK',
    headers: {
      'content-type': 'application/json',
      'x-request-id': 'abc-123',
    },
    data: { users: [{ id: 1, name: 'Alice' }] },
  };

  const emptyResponse: FormattableResponse = {
    status: 204,
    statusText: 'No Content',
    headers: {},
    data: null,
  };

  const textResponse: FormattableResponse = {
    status: 200,
    statusText: 'OK',
    headers: {
      'content-type': 'text/plain',
    },
    data: 'Hello, World!',
  };

  describe('formatPretty', () => {
    it('should format status line', () => {
      const result = formatPretty(successResponse, false);
      expect(result).toContain('HTTP/1.1 200 OK');
    });

    it('should format headers with indentation', () => {
      const result = formatPretty(successResponse, false);
      expect(result).toContain('  content-type: application/json');
      expect(result).toContain('  x-request-id: abc-123');
    });

    it('should pretty-print JSON body', () => {
      const result = formatPretty(successResponse, false);
      // Should be indented JSON
      expect(result).toContain('"users"');
      expect(result).toContain('"id": 1');
      expect(result).toContain('"name": "Alice"');
    });

    it('should include summary line with size', () => {
      const result = formatPretty(successResponse, false);
      expect(result).toMatch(/── 200 OK · \d+ bytes ──/);
    });

    it('should handle empty body', () => {
      const result = formatPretty(emptyResponse, false);
      expect(result).toContain('HTTP/1.1 204 No Content');
      expect(result).toContain('0 bytes');
    });

    it('should handle text body', () => {
      const result = formatPretty(textResponse, false);
      expect(result).toContain('Hello, World!');
    });

    it('should handle string body with JSON content-type', () => {
      const response: FormattableResponse = {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: '{"key":"value"}',
      };
      const result = formatPretty(response, false);
      // Should pretty-print the JSON string
      expect(result).toContain('"key": "value"');
    });

    it('should handle invalid JSON string gracefully', () => {
      const response: FormattableResponse = {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: 'not valid json',
      };
      const result = formatPretty(response, false);
      expect(result).toContain('not valid json');
    });

    it('should format large body with KB size', () => {
      const largeData = { content: 'x'.repeat(2000) };
      const response: FormattableResponse = {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: largeData,
      };
      const result = formatPretty(response, false);
      expect(result).toMatch(/\d+\.\d+ KB/);
    });
  });

  describe('formatJson', () => {
    it('should output valid JSON', () => {
      const result = formatJson(successResponse);
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should include status', () => {
      const result = formatJson(successResponse);
      const parsed = JSON.parse(result);
      expect(parsed.status).toBe(200);
    });

    it('should include statusText', () => {
      const result = formatJson(successResponse);
      const parsed = JSON.parse(result);
      expect(parsed.statusText).toBe('OK');
    });

    it('should include headers', () => {
      const result = formatJson(successResponse);
      const parsed = JSON.parse(result);
      expect(parsed.headers['content-type']).toBe('application/json');
    });

    it('should include body', () => {
      const result = formatJson(successResponse);
      const parsed = JSON.parse(result);
      expect(parsed.body.users).toHaveLength(1);
    });

    it('should handle null body', () => {
      const result = formatJson(emptyResponse);
      const parsed = JSON.parse(result);
      expect(parsed.body).toBeNull();
    });

    it('should be pretty-printed with indentation', () => {
      const result = formatJson(successResponse);
      expect(result).toContain('\n');
      expect(result).toContain('  ');
    });
  });

  describe('formatRaw', () => {
    it('should output only body content', () => {
      const result = formatRaw(successResponse);
      // Should not contain status line
      expect(result).not.toContain('HTTP');
      expect(result).not.toContain('200');
    });

    it('should stringify object body', () => {
      const result = formatRaw(successResponse);
      expect(result).toContain('users');
      // JSON.parse should work
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should return string body as-is', () => {
      const result = formatRaw(textResponse);
      expect(result).toBe('Hello, World!');
    });

    it('should return empty string for null body', () => {
      const result = formatRaw(emptyResponse);
      expect(result).toBe('');
    });

    it('should return empty string for undefined body', () => {
      const response: FormattableResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: undefined,
      };
      const result = formatRaw(response);
      expect(result).toBe('');
    });
  });

  describe('formatResponse', () => {
    it('should use pretty mode by default', () => {
      const options: OutputOptions = { mode: 'pretty', forceColors: false };
      const result = formatResponse(successResponse, options);
      expect(result).toContain('HTTP/1.1 200 OK');
      expect(result).toContain('──');
    });

    it('should format as JSON when mode is json', () => {
      const options: OutputOptions = { mode: 'json' };
      const result = formatResponse(successResponse, options);
      const parsed = JSON.parse(result);
      expect(parsed.status).toBe(200);
    });

    it('should format as raw when mode is raw', () => {
      const options: OutputOptions = { mode: 'raw' };
      const result = formatResponse(successResponse, options);
      expect(result).not.toContain('HTTP');
    });

    it('should disable colors when forceColors is false', () => {
      const options: OutputOptions = { mode: 'pretty', forceColors: false };
      const result = formatResponse(successResponse, options);
      // Should not contain ANSI escape codes
      expect(result).not.toContain('\x1b[');
    });
  });

  describe('edge cases', () => {
    it('should handle response with no headers', () => {
      const response: FormattableResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: 'test',
      };
      const result = formatPretty(response, false);
      expect(result).toContain('HTTP/1.1 200 OK');
      expect(result).toContain('test');
    });

    it('should handle Content-Type header with different casing', () => {
      const response: FormattableResponse = {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
        data: { key: 'value' },
      };
      const result = formatPretty(response, false);
      expect(result).toContain('"key": "value"');
    });

    it('should handle redirect status', () => {
      const response: FormattableResponse = {
        status: 301,
        statusText: 'Moved Permanently',
        headers: { location: 'https://example.com/new' },
        data: null,
      };
      const result = formatPretty(response, false);
      expect(result).toContain('HTTP/1.1 301 Moved Permanently');
    });

    it('should handle server error status', () => {
      const response: FormattableResponse = {
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        data: { error: 'Something went wrong' },
      };
      const result = formatPretty(response, false);
      expect(result).toContain('HTTP/1.1 500 Internal Server Error');
    });

    it('should handle number data', () => {
      const response: FormattableResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: 42,
      };
      const result = formatRaw(response);
      expect(result).toBe('42');
    });
  });
});
