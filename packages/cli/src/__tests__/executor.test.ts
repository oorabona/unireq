/**
 * Tests for executor module
 * Following AAA pattern for unit tests
 */

import { describe, expect, it } from 'vitest';
import { detectContentType, parseHeaders, parseQuery } from '../executor.js';

describe('parseHeaders', () => {
  describe('when given valid headers', () => {
    it('should parse single header', () => {
      // Arrange
      const headers = ['Content-Type:application/json'];

      // Act
      const result = parseHeaders(headers);

      // Assert
      expect(result).toEqual({ 'Content-Type': 'application/json' });
    });

    it('should parse multiple headers', () => {
      // Arrange
      const headers = ['Content-Type:application/json', 'Authorization:Bearer token123'];

      // Act
      const result = parseHeaders(headers);

      // Assert
      expect(result).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer token123',
      });
    });

    it('should handle headers with multiple colons in value', () => {
      // Arrange
      const headers = ['X-Custom:value:with:colons'];

      // Act
      const result = parseHeaders(headers);

      // Assert
      expect(result).toEqual({ 'X-Custom': 'value:with:colons' });
    });

    it('should trim whitespace from key and value', () => {
      // Arrange
      const headers = ['  Content-Type  :  application/json  '];

      // Act
      const result = parseHeaders(headers);

      // Assert
      expect(result).toEqual({ 'Content-Type': 'application/json' });
    });

    it('should return empty object for empty array', () => {
      // Arrange
      const headers: string[] = [];

      // Act
      const result = parseHeaders(headers);

      // Assert
      expect(result).toEqual({});
    });
  });

  describe('when given invalid headers', () => {
    it('should throw error for header without colon', () => {
      // Arrange
      const headers = ['invalid-no-colon'];

      // Act & Assert
      expect(() => parseHeaders(headers)).toThrow(
        "Invalid header format: expected 'key:value', got 'invalid-no-colon'",
      );
    });

    it('should throw error for header with empty key', () => {
      // Arrange
      const headers = [':value-only'];

      // Act & Assert
      expect(() => parseHeaders(headers)).toThrow("Invalid header format: empty key in ':value-only'");
    });
  });
});

describe('parseQuery', () => {
  describe('when given valid query params', () => {
    it('should parse single query param', () => {
      // Arrange
      const query = ['foo=bar'];

      // Act
      const result = parseQuery(query);

      // Assert
      expect(result).toEqual({ foo: 'bar' });
    });

    it('should parse multiple query params', () => {
      // Arrange
      const query = ['foo=bar', 'baz=qux'];

      // Act
      const result = parseQuery(query);

      // Assert
      expect(result).toEqual({ foo: 'bar', baz: 'qux' });
    });

    it('should handle query with multiple equals in value', () => {
      // Arrange
      const query = ['filter=a=1&b=2'];

      // Act
      const result = parseQuery(query);

      // Assert
      expect(result).toEqual({ filter: 'a=1&b=2' });
    });

    it('should trim whitespace from key and value', () => {
      // Arrange
      const query = ['  foo  =  bar  '];

      // Act
      const result = parseQuery(query);

      // Assert
      expect(result).toEqual({ foo: 'bar' });
    });

    it('should return empty object for empty array', () => {
      // Arrange
      const query: string[] = [];

      // Act
      const result = parseQuery(query);

      // Assert
      expect(result).toEqual({});
    });
  });

  describe('when given invalid query params', () => {
    it('should throw error for query without equals', () => {
      // Arrange
      const query = ['invalid-no-equals'];

      // Act & Assert
      expect(() => parseQuery(query)).toThrow("Invalid query format: expected 'key=value', got 'invalid-no-equals'");
    });

    it('should throw error for query with empty key', () => {
      // Arrange
      const query = ['=value-only'];

      // Act & Assert
      expect(() => parseQuery(query)).toThrow("Invalid query format: empty key in '=value-only'");
    });
  });
});

describe('detectContentType', () => {
  describe('when given JSON content', () => {
    it('should detect JSON object', () => {
      // Arrange
      const bodyStr = '{"name": "test"}';

      // Act
      const result = detectContentType(bodyStr);

      // Assert
      expect(result).toBe('application/json');
    });

    it('should detect JSON array', () => {
      // Arrange
      const bodyStr = '[1, 2, 3]';

      // Act
      const result = detectContentType(bodyStr);

      // Assert
      expect(result).toBe('application/json');
    });

    it('should detect JSON with whitespace', () => {
      // Arrange
      const bodyStr = '  { "key": "value" }  ';

      // Act
      const result = detectContentType(bodyStr);

      // Assert
      expect(result).toBe('application/json');
    });
  });

  describe('when given non-JSON content', () => {
    it('should return text/plain for plain text', () => {
      // Arrange
      const bodyStr = 'hello world';

      // Act
      const result = detectContentType(bodyStr);

      // Assert
      expect(result).toBe('text/plain');
    });

    it('should return text/plain for invalid JSON that looks like JSON', () => {
      // Arrange
      const bodyStr = '{invalid json}';

      // Act
      const result = detectContentType(bodyStr);

      // Assert
      expect(result).toBe('text/plain');
    });

    it('should return text/plain for empty string', () => {
      // Arrange
      const bodyStr = '';

      // Act
      const result = detectContentType(bodyStr);

      // Assert
      expect(result).toBe('text/plain');
    });
  });
});
