/**
 * Tests for CLI command parsing with citty
 */

import { describe, expect, it } from 'vitest';
import { handleRequest } from '../commands/request.js';
import type { HttpMethod, ParsedRequest } from '../types.js';

describe('@unireq/cli commands', () => {
  describe('handleRequest', () => {
    it('should parse GET request with URL', () => {
      // Arrange
      const method: HttpMethod = 'GET';
      const url = 'https://api.example.com/users';

      // Act
      const result: ParsedRequest = handleRequest(method, url, {});

      // Assert
      expect(result.method).toBe('GET');
      expect(result.url).toBe('https://api.example.com/users');
      expect(result.headers).toEqual([]);
      expect(result.query).toEqual([]);
      expect(result.body).toBeUndefined();
      expect(result.timeout).toBeUndefined();
    });

    it('should parse POST request with headers and body', () => {
      // Arrange
      const method: HttpMethod = 'POST';
      const url = '/users';
      const options = {
        header: ['Content-Type: application/json', 'Accept: application/json'],
        body: '{"name":"test"}',
      };

      // Act
      const result = handleRequest(method, url, options);

      // Assert
      expect(result.method).toBe('POST');
      expect(result.url).toBe('/users');
      expect(result.headers).toEqual(['Content-Type: application/json', 'Accept: application/json']);
      expect(result.body).toBe('{"name":"test"}');
    });

    it('should collect single header as array', () => {
      // Arrange
      const method: HttpMethod = 'GET';
      const url = '/test';
      const options = {
        header: 'Authorization: Bearer token123',
      };

      // Act
      const result = handleRequest(method, url, options);

      // Assert
      expect(result.headers).toEqual(['Authorization: Bearer token123']);
    });

    it('should parse query parameters', () => {
      // Arrange
      const method: HttpMethod = 'GET';
      const url = '/search';
      const options = {
        query: ['q=test', 'limit=10'],
      };

      // Act
      const result = handleRequest(method, url, options);

      // Assert
      expect(result.query).toEqual(['q=test', 'limit=10']);
    });

    it('should parse timeout option', () => {
      // Arrange
      const method: HttpMethod = 'GET';
      const url = '/slow-endpoint';
      const options = {
        timeout: '5000',
      };

      // Act
      const result = handleRequest(method, url, options);

      // Assert
      expect(result.timeout).toBe(5000);
    });

    it('should handle all HTTP methods', () => {
      // Arrange
      const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

      // Act & Assert
      for (const method of methods) {
        const result = handleRequest(method, '/test', {});
        expect(result.method).toBe(method);
      }
    });

    it('should handle empty options', () => {
      // Arrange
      const method: HttpMethod = 'DELETE';
      const url = '/resource/123';

      // Act
      const result = handleRequest(method, url, {});

      // Assert
      expect(result.method).toBe('DELETE');
      expect(result.url).toBe('/resource/123');
      expect(result.headers).toEqual([]);
      expect(result.query).toEqual([]);
      expect(result.body).toBeUndefined();
      expect(result.timeout).toBeUndefined();
    });

    it('should handle relative URLs', () => {
      // Arrange
      const method: HttpMethod = 'GET';
      const url = '/api/v1/users';

      // Act
      const result = handleRequest(method, url, {});

      // Assert
      expect(result.url).toBe('/api/v1/users');
    });

    it('should handle body with @filepath syntax', () => {
      // Arrange
      const method: HttpMethod = 'POST';
      const url = '/upload';
      const options = {
        body: '@./data.json',
      };

      // Act
      const result = handleRequest(method, url, options);

      // Assert
      expect(result.body).toBe('@./data.json');
    });

    it('should return NaN for non-numeric timeout', () => {
      // Arrange
      const method: HttpMethod = 'GET';
      const url = '/test';
      const options = {
        timeout: 'invalid',
      };

      // Act
      const result = handleRequest(method, url, options);

      // Assert
      expect(result.timeout).toBeNaN();
    });
  });
});
