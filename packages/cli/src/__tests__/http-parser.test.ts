/**
 * Tests for HTTP command parser
 * Following AAA pattern for unit tests
 */

import { describe, expect, it } from 'vitest';
import { getSupportedMethods, isHttpMethod, parseHttpCommand } from '../repl/http-parser.js';

describe('isHttpMethod', () => {
  describe('when given valid HTTP methods', () => {
    it('should return true for lowercase methods', () => {
      // Arrange
      const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

      // Act & Assert
      for (const method of methods) {
        expect(isHttpMethod(method)).toBe(true);
      }
    });

    it('should return true for uppercase methods', () => {
      // Arrange
      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

      // Act & Assert
      for (const method of methods) {
        expect(isHttpMethod(method)).toBe(true);
      }
    });

    it('should return true for mixed case methods', () => {
      // Arrange & Act & Assert
      expect(isHttpMethod('Get')).toBe(true);
      expect(isHttpMethod('PoSt')).toBe(true);
    });
  });

  describe('when given invalid methods', () => {
    it('should return false for unknown methods', () => {
      // Arrange
      const invalidMethods = ['foo', 'bar', 'connect', 'trace', ''];

      // Act & Assert
      for (const method of invalidMethods) {
        expect(isHttpMethod(method)).toBe(false);
      }
    });
  });
});

describe('parseHttpCommand', () => {
  describe('when parsing basic URL', () => {
    it('should parse method and URL', () => {
      // Arrange
      const method = 'get';
      const args = ['https://api.example.com/users'];

      // Act
      const result = parseHttpCommand(method, args);

      // Assert
      expect(result.method).toBe('GET');
      expect(result.url).toBe('https://api.example.com/users');
      expect(result.headers).toEqual([]);
      expect(result.query).toEqual([]);
      expect(result.body).toBeUndefined();
    });

    it('should convert method to uppercase', () => {
      // Arrange
      const method = 'post';
      const args = ['/api'];

      // Act
      const result = parseHttpCommand(method, args);

      // Assert
      expect(result.method).toBe('POST');
    });
  });

  describe('when parsing with headers', () => {
    it('should parse single header with -H flag', () => {
      // Arrange
      const method = 'get';
      const args = ['/api', '-H', 'Authorization:Bearer token123'];

      // Act
      const result = parseHttpCommand(method, args);

      // Assert
      expect(result.headers).toEqual(['Authorization:Bearer token123']);
    });

    it('should parse single header with --header flag', () => {
      // Arrange
      const method = 'get';
      const args = ['/api', '--header', 'Content-Type:application/json'];

      // Act
      const result = parseHttpCommand(method, args);

      // Assert
      expect(result.headers).toEqual(['Content-Type:application/json']);
    });

    it('should parse multiple headers', () => {
      // Arrange
      const method = 'get';
      const args = ['/api', '-H', 'Auth:Bearer x', '-H', 'Accept:application/json'];

      // Act
      const result = parseHttpCommand(method, args);

      // Assert
      expect(result.headers).toEqual(['Auth:Bearer x', 'Accept:application/json']);
    });
  });

  describe('when parsing with query parameters', () => {
    it('should parse single query with -q flag', () => {
      // Arrange
      const method = 'get';
      const args = ['/api', '-q', 'page=1'];

      // Act
      const result = parseHttpCommand(method, args);

      // Assert
      expect(result.query).toEqual(['page=1']);
    });

    it('should parse single query with --query flag', () => {
      // Arrange
      const method = 'get';
      const args = ['/api', '--query', 'limit=10'];

      // Act
      const result = parseHttpCommand(method, args);

      // Assert
      expect(result.query).toEqual(['limit=10']);
    });

    it('should parse multiple query parameters', () => {
      // Arrange
      const method = 'get';
      const args = ['/api', '-q', 'page=1', '-q', 'limit=10'];

      // Act
      const result = parseHttpCommand(method, args);

      // Assert
      expect(result.query).toEqual(['page=1', 'limit=10']);
    });
  });

  describe('when parsing with JSON body', () => {
    it('should parse inline JSON object', () => {
      // Arrange
      const method = 'post';
      const args = ['/api', '{"name":"test"}'];

      // Act
      const result = parseHttpCommand(method, args);

      // Assert
      expect(result.body).toBe('{"name":"test"}');
    });

    it('should parse inline JSON array', () => {
      // Arrange
      const method = 'post';
      const args = ['/api', '[1,2,3]'];

      // Act
      const result = parseHttpCommand(method, args);

      // Assert
      expect(result.body).toBe('[1,2,3]');
    });

    it('should parse body with headers and query', () => {
      // Arrange
      const method = 'post';
      const args = ['/api', '{"x":1}', '-H', 'Auth:token', '-q', 'v=1'];

      // Act
      const result = parseHttpCommand(method, args);

      // Assert
      expect(result.body).toBe('{"x":1}');
      expect(result.headers).toEqual(['Auth:token']);
      expect(result.query).toEqual(['v=1']);
    });
  });

  describe('when given invalid input', () => {
    it('should throw error when URL is missing', () => {
      // Arrange
      const method = 'get';
      const args: string[] = [];

      // Act & Assert
      expect(() => parseHttpCommand(method, args)).toThrow('URL is required');
    });

    it('should throw error when URL starts with flag', () => {
      // Arrange
      const method = 'get';
      const args = ['-H', 'foo:bar'];

      // Act & Assert
      expect(() => parseHttpCommand(method, args)).toThrow('URL is required');
    });

    it('should throw error for invalid header format', () => {
      // Arrange
      const method = 'get';
      const args = ['/api', '-H', 'badformat'];

      // Act & Assert
      expect(() => parseHttpCommand(method, args)).toThrow(
        "Invalid header format: expected 'key:value', got 'badformat'",
      );
    });

    it('should throw error for invalid query format', () => {
      // Arrange
      const method = 'get';
      const args = ['/api', '-q', 'noequals'];

      // Act & Assert
      expect(() => parseHttpCommand(method, args)).toThrow(
        "Invalid query format: expected 'key=value', got 'noequals'",
      );
    });

    it('should throw error for invalid JSON body', () => {
      // Arrange
      const method = 'post';
      const args = ['/api', '{invalid json}'];

      // Act & Assert
      expect(() => parseHttpCommand(method, args)).toThrow('Invalid JSON body');
    });

    it('should throw error for missing header value', () => {
      // Arrange
      const method = 'get';
      const args = ['/api', '-H'];

      // Act & Assert
      expect(() => parseHttpCommand(method, args)).toThrow('Missing value for -H');
    });

    it('should throw error for missing query value', () => {
      // Arrange
      const method = 'get';
      const args = ['/api', '-q'];

      // Act & Assert
      expect(() => parseHttpCommand(method, args)).toThrow('Missing value for -q');
    });

    it('should throw error for unknown flag', () => {
      // Arrange
      const method = 'get';
      const args = ['/api', '--unknown'];

      // Act & Assert
      expect(() => parseHttpCommand(method, args)).toThrow('Unknown flag: --unknown');
    });

    it('should throw error for multiple body arguments', () => {
      // Arrange
      const method = 'post';
      const args = ['/api', '{"a":1}', '{"b":2}'];

      // Act & Assert
      expect(() => parseHttpCommand(method, args)).toThrow('Multiple body arguments provided');
    });
  });
});

describe('getSupportedMethods', () => {
  it('should return all HTTP methods in uppercase', () => {
    // Arrange & Act
    const methods = getSupportedMethods();

    // Assert
    expect(methods).toContain('GET');
    expect(methods).toContain('POST');
    expect(methods).toContain('PUT');
    expect(methods).toContain('PATCH');
    expect(methods).toContain('DELETE');
    expect(methods).toContain('HEAD');
    expect(methods).toContain('OPTIONS');
    expect(methods).toHaveLength(7);
  });
});
