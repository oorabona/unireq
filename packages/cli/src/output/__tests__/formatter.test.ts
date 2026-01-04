/**
 * Tests for response formatter
 * Following AAA pattern for unit tests
 */

import { describe, expect, it, vi } from 'vitest';
import { formatJson, formatPretty, formatRaw, formatResponse } from '../formatter.js';
import type { FormattableResponse } from '../types.js';

// Mock shouldUseColors to return false for consistent test output
vi.mock('../colors.js', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('../colors.js');
  return {
    ...actual,
    shouldUseColors: vi.fn(() => false),
  };
});

/**
 * Create a mock response for testing
 */
function createResponse(overrides: Partial<FormattableResponse> = {}): FormattableResponse {
  return {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    data: { message: 'Hello, World!' },
    ...overrides,
  };
}

describe('formatPretty', () => {
  describe('binary content detection', () => {
    it('should display placeholder for image/* content-type', () => {
      // Arrange
      const response = createResponse({
        headers: { 'content-type': 'image/png' },
        data: 'binary image data',
      });

      // Act
      const result = formatPretty(response, { useColors: false });

      // Assert
      expect(result).toContain('[Binary data:');
      expect(result).toContain('image/png');
      expect(result).not.toContain('binary image data');
    });

    it('should display placeholder for audio/* content-type', () => {
      // Arrange
      const response = createResponse({
        headers: { 'content-type': 'audio/mpeg' },
        data: 'binary audio data',
      });

      // Act
      const result = formatPretty(response, { useColors: false });

      // Assert
      expect(result).toContain('[Binary data:');
      expect(result).toContain('audio/mpeg');
    });

    it('should display placeholder for application/octet-stream', () => {
      // Arrange
      const response = createResponse({
        headers: { 'content-type': 'application/octet-stream' },
        data: Buffer.from([0x00, 0x01, 0x02, 0x03]),
      });

      // Act
      const result = formatPretty(response, { useColors: false });

      // Assert
      expect(result).toContain('[Binary data:');
      expect(result).toContain('application/octet-stream');
    });

    it('should display placeholder for data with null bytes', () => {
      // Arrange
      const response = createResponse({
        headers: { 'content-type': 'text/plain' },
        data: 'hello\x00world', // Contains null byte
      });

      // Act
      const result = formatPretty(response, { useColors: false });

      // Assert
      expect(result).toContain('[Binary data:');
      expect(result).not.toContain('hello');
    });

    it('should NOT show placeholder for application/json', () => {
      // Arrange
      const response = createResponse({
        headers: { 'content-type': 'application/json' },
        data: { foo: 'bar' },
      });

      // Act
      const result = formatPretty(response, { useColors: false });

      // Assert
      expect(result).not.toContain('[Binary data:');
      expect(result).toContain('"foo"');
      expect(result).toContain('"bar"');
    });

    it('should NOT show placeholder for text/html', () => {
      // Arrange
      const response = createResponse({
        headers: { 'content-type': 'text/html' },
        data: '<html><body>Hello</body></html>',
      });

      // Act
      const result = formatPretty(response, { useColors: false });

      // Assert
      expect(result).not.toContain('[Binary data:');
      expect(result).toContain('<html>');
    });
  });

  describe('JSON formatting', () => {
    it('should pretty-print JSON objects', () => {
      // Arrange
      const response = createResponse({
        data: { foo: 'bar', nested: { value: 42 } },
      });

      // Act
      const result = formatPretty(response, { useColors: false });

      // Assert
      expect(result).toContain('"foo": "bar"');
      expect(result).toContain('"nested"');
      expect(result).toContain('"value": 42');
    });

    it('should pretty-print JSON strings', () => {
      // Arrange
      const response = createResponse({
        data: '{"compact":"json"}',
      });

      // Act
      const result = formatPretty(response, { useColors: false });

      // Assert
      expect(result).toContain('"compact": "json"');
    });
  });
});

describe('formatJson', () => {
  describe('binary content handling', () => {
    it('should output binaryContent metadata for image content', () => {
      // Arrange
      const response = createResponse({
        headers: { 'content-type': 'image/png' },
        data: 'binary image data',
      });

      // Act
      const result = formatJson(response);
      const parsed = JSON.parse(result);

      // Assert
      expect(parsed.body).toBeUndefined();
      expect(parsed.binaryContent).toEqual({
        size: expect.any(Number),
        contentType: 'image/png',
      });
    });

    it('should output body for JSON content', () => {
      // Arrange
      const response = createResponse({
        headers: { 'content-type': 'application/json' },
        data: { foo: 'bar' },
      });

      // Act
      const result = formatJson(response);
      const parsed = JSON.parse(result);

      // Assert
      expect(parsed.body).toEqual({ foo: 'bar' });
      expect(parsed.binaryContent).toBeUndefined();
    });
  });
});

describe('formatRaw', () => {
  describe('binary content handling', () => {
    it('should output placeholder for binary content-type', () => {
      // Arrange
      const response = createResponse({
        headers: { 'content-type': 'application/pdf' },
        data: 'binary pdf data',
      });

      // Act
      const result = formatRaw(response);

      // Assert
      expect(result).toContain('[Binary data:');
      expect(result).toContain('application/pdf');
      expect(result).not.toContain('binary pdf data');
    });

    it('should output body for text content', () => {
      // Arrange
      const response = createResponse({
        headers: { 'content-type': 'text/plain' },
        data: 'Hello, World!',
      });

      // Act
      const result = formatRaw(response);

      // Assert
      expect(result).toBe('Hello, World!');
    });

    it('should stringify JSON objects', () => {
      // Arrange
      const response = createResponse({
        headers: { 'content-type': 'application/json' },
        data: { foo: 'bar' },
      });

      // Act
      const result = formatRaw(response);

      // Assert
      expect(result).toBe('{"foo":"bar"}');
    });
  });
});

describe('formatResponse', () => {
  it('should use formatPretty for default mode', () => {
    // Arrange
    const response = createResponse();

    // Act
    const result = formatResponse(response, { mode: 'pretty' });

    // Assert
    expect(result).toContain('"message"');
  });

  it('should use formatJson for json mode', () => {
    // Arrange
    const response = createResponse();

    // Act
    const result = formatResponse(response, { mode: 'json' });
    const parsed = JSON.parse(result);

    // Assert
    expect(parsed.status).toBe(200);
    expect(parsed.statusText).toBe('OK');
    expect(parsed.body).toEqual({ message: 'Hello, World!' });
  });

  it('should use formatRaw for raw mode', () => {
    // Arrange
    const response = createResponse({
      data: 'raw content',
      headers: { 'content-type': 'text/plain' },
    });

    // Act
    const result = formatResponse(response, { mode: 'raw' });

    // Assert
    expect(result).toBe('raw content');
  });
});
