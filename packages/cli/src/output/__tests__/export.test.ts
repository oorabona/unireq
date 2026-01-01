/**
 * Tests for export formatters (curl, HTTPie)
 */

import { describe, expect, it } from 'vitest';
import type { ParsedRequest } from '../../types.js';
import { escapeShell, exportRequest, toCurl, toHttpie } from '../export.js';

describe('escapeShell', () => {
  it('should return simple values unquoted', () => {
    expect(escapeShell('hello')).toBe('hello');
    expect(escapeShell('https://api.example.com/users')).toBe('https://api.example.com/users');
    expect(escapeShell('application/json')).toBe('application/json');
  });

  it('should quote values with spaces', () => {
    expect(escapeShell('hello world')).toBe("'hello world'");
  });

  it('should escape single quotes in values', () => {
    expect(escapeShell("don't")).toBe("'don'\\''t'");
  });

  it('should quote values with special characters', () => {
    expect(escapeShell('{"name":"Alice"}')).toBe('\'{"name":"Alice"}\'');
  });
});

describe('toCurl', () => {
  describe('basic requests', () => {
    it('should format GET request', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: [],
        query: [],
      };

      // Act
      const result = toCurl(request);

      // Assert
      expect(result).toBe('curl -X GET https://api.example.com/users');
    });

    it('should format POST request', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: [],
        query: [],
      };

      // Act
      const result = toCurl(request);

      // Assert
      expect(result).toBe('curl -X POST https://api.example.com/users');
    });

    it('should format all HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

      for (const method of methods) {
        const request: ParsedRequest = {
          method,
          url: 'https://api.example.com',
          headers: [],
          query: [],
        };
        expect(toCurl(request)).toContain(`-X ${method}`);
      }
    });
  });

  describe('with headers', () => {
    it('should include single header', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: ['Authorization: Bearer token123'],
        query: [],
      };

      // Act
      const result = toCurl(request);

      // Assert
      expect(result).toBe("curl -X GET -H 'Authorization: Bearer token123' https://api.example.com/users");
    });

    it('should include multiple headers', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: ['Content-Type: application/json', 'Authorization: Bearer token'],
        query: [],
      };

      // Act
      const result = toCurl(request);

      // Assert
      expect(result).toContain("-H 'Content-Type: application/json'");
      expect(result).toContain("-H 'Authorization: Bearer token'");
    });
  });

  describe('with body', () => {
    it('should include JSON body', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: [],
        query: [],
        body: '{"name":"Alice"}',
      };

      // Act
      const result = toCurl(request);

      // Assert
      expect(result).toContain('-d \'{"name":"Alice"}\'');
    });

    it('should include text body', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: [],
        query: [],
        body: 'plain text content',
      };

      // Act
      const result = toCurl(request);

      // Assert
      expect(result).toContain("-d 'plain text content'");
    });
  });

  describe('with query parameters', () => {
    it('should append query params to URL', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: [],
        query: ['limit=10', 'offset=20'],
      };

      // Act
      const result = toCurl(request);

      // Assert
      expect(result).toContain('limit=10');
      expect(result).toContain('offset=20');
    });

    it('should merge with existing URL query params', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'GET',
        url: 'https://api.example.com/users?page=1',
        headers: [],
        query: ['limit=10'],
      };

      // Act
      const result = toCurl(request);

      // Assert
      expect(result).toContain('page=1');
      expect(result).toContain('limit=10');
    });
  });

  describe('complex requests', () => {
    it('should handle full request with all options', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: ['Content-Type: application/json', 'Authorization: Bearer token'],
        query: ['format=json'],
        body: '{"name":"Alice","age":30}',
      };

      // Act
      const result = toCurl(request);

      // Assert
      expect(result).toMatch(/^curl -X POST/);
      expect(result).toContain("-H 'Content-Type: application/json'");
      expect(result).toContain("-H 'Authorization: Bearer token'");
      expect(result).toContain('-d \'{"name":"Alice","age":30}\'');
      expect(result).toContain('format=json');
    });
  });
});

describe('toHttpie', () => {
  describe('basic requests', () => {
    it('should format GET request', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: [],
        query: [],
      };

      // Act
      const result = toHttpie(request);

      // Assert
      expect(result).toBe('http GET https://api.example.com/users');
    });

    it('should format POST request', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: [],
        query: [],
      };

      // Act
      const result = toHttpie(request);

      // Assert
      expect(result).toBe('http POST https://api.example.com/users');
    });
  });

  describe('with headers', () => {
    it('should use colon format for headers', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: ['Authorization: Bearer token123'],
        query: [],
      };

      // Act
      const result = toHttpie(request);

      // Assert
      expect(result).toContain("Authorization:'Bearer token123'");
    });

    it('should include multiple headers', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: ['Content-Type: application/json', 'X-Custom: value'],
        query: [],
      };

      // Act
      const result = toHttpie(request);

      // Assert
      expect(result).toContain('Content-Type:application/json');
      expect(result).toContain('X-Custom:value');
    });
  });

  describe('with query parameters', () => {
    it('should use double equals for query params', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: [],
        query: ['limit=10', 'offset=20'],
      };

      // Act
      const result = toHttpie(request);

      // Assert
      expect(result).toContain('limit==10');
      expect(result).toContain('offset==20');
    });
  });

  describe('with body', () => {
    it('should use --raw for JSON body', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: [],
        query: [],
        body: '{"name":"Alice"}',
      };

      // Act
      const result = toHttpie(request);

      // Assert
      expect(result).toContain('--raw \'{"name":"Alice"}\'');
    });

    it('should use --raw for text body', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: [],
        query: [],
        body: 'plain text',
      };

      // Act
      const result = toHttpie(request);

      // Assert
      expect(result).toContain("--raw 'plain text'");
    });
  });

  describe('complex requests', () => {
    it('should handle full request with all options', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: ['Content-Type: application/json'],
        query: ['format=json'],
        body: '{"name":"Alice"}',
      };

      // Act
      const result = toHttpie(request);

      // Assert
      expect(result).toMatch(/^http POST/);
      expect(result).toContain('Content-Type:application/json');
      expect(result).toContain('format==json');
      expect(result).toContain('--raw \'{"name":"Alice"}\'');
    });
  });
});

describe('exportRequest', () => {
  const request: ParsedRequest = {
    method: 'GET',
    url: 'https://api.example.com/users',
    headers: [],
    query: [],
  };

  it('should export to curl format', () => {
    const result = exportRequest(request, 'curl');
    expect(result).toContain('curl');
  });

  it('should export to httpie format', () => {
    const result = exportRequest(request, 'httpie');
    expect(result).toContain('http');
  });

  it('should throw for unknown format', () => {
    expect(() => exportRequest(request, 'unknown' as never)).toThrow('Unknown export format');
  });
});
