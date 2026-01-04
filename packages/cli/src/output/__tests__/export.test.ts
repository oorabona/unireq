/**
 * Tests for export formatters (curl, HTTPie, HAR)
 */

import { describe, expect, it } from 'vitest';
import type { ParsedRequest } from '../../types.js';
import { escapeShell, exportRequest, toCurl, toHar, toHttpie, type ResponseData } from '../export.js';

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

  it('should export to HAR format', () => {
    const result = exportRequest(request, 'har');
    const parsed = JSON.parse(result);
    expect(parsed.log.version).toBe('1.2');
    expect(parsed.log.creator.name).toBe('unireq');
  });
});

describe('toHar', () => {
  describe('basic structure', () => {
    it('should generate valid HAR 1.2 structure', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: [],
        query: [],
      };

      // Act
      const result = toHar(request);

      // Assert
      expect(result.log.version).toBe('1.2');
      expect(result.log.creator.name).toBe('unireq');
      expect(result.log.creator.version).toBe('0.0.1');
      expect(result.log.entries).toHaveLength(1);
    });

    it('should include startedDateTime in ISO format', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: [],
        query: [],
      };

      // Act
      const result = toHar(request);

      // Assert
      expect(result.log.entries[0].startedDateTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('request details', () => {
    it('should include request method and URL', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: [],
        query: [],
      };

      // Act
      const result = toHar(request);
      const harRequest = result.log.entries[0].request;

      // Assert
      expect(harRequest.method).toBe('POST');
      expect(harRequest.url).toBe('https://api.example.com/users');
      expect(harRequest.httpVersion).toBe('HTTP/1.1');
    });

    it('should parse headers into name-value format', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: ['Content-Type: application/json', 'Authorization: Bearer token123'],
        query: [],
      };

      // Act
      const result = toHar(request);
      const harRequest = result.log.entries[0].request;

      // Assert
      expect(harRequest.headers).toHaveLength(2);
      expect(harRequest.headers[0]).toEqual({ name: 'Content-Type', value: 'application/json' });
      expect(harRequest.headers[1]).toEqual({ name: 'Authorization', value: 'Bearer token123' });
    });

    it('should parse query parameters into queryString', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: [],
        query: ['limit=10', 'offset=20'],
      };

      // Act
      const result = toHar(request);
      const harRequest = result.log.entries[0].request;

      // Assert
      expect(harRequest.queryString).toHaveLength(2);
      expect(harRequest.queryString[0]).toEqual({ name: 'limit', value: '10' });
      expect(harRequest.queryString[1]).toEqual({ name: 'offset', value: '20' });
    });

    it('should include body as postData', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: ['Content-Type: application/json'],
        query: [],
        body: '{"name":"Alice"}',
      };

      // Act
      const result = toHar(request);
      const harRequest = result.log.entries[0].request;

      // Assert
      expect(harRequest.postData).toBeDefined();
      expect(harRequest.postData?.mimeType).toBe('application/json');
      expect(harRequest.postData?.text).toBe('{"name":"Alice"}');
      expect(harRequest.bodySize).toBe(16);
    });

    it('should handle empty body', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: [],
        query: [],
      };

      // Act
      const result = toHar(request);
      const harRequest = result.log.entries[0].request;

      // Assert
      expect(harRequest.postData).toBeUndefined();
      expect(harRequest.bodySize).toBe(0);
    });
  });

  describe('response details', () => {
    it('should include response when provided', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: [],
        query: [],
      };
      const response: ResponseData = {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
        body: '{"users":[]}',
      };

      // Act
      const result = toHar(request, response);
      const harResponse = result.log.entries[0].response;

      // Assert
      expect(harResponse.status).toBe(200);
      expect(harResponse.statusText).toBe('OK');
      expect(harResponse.headers[0]).toEqual({ name: 'Content-Type', value: 'application/json' });
      expect(harResponse.content.text).toBe('{"users":[]}');
      expect(harResponse.content.mimeType).toBe('application/json');
    });

    it('should use default values when no response provided', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: [],
        query: [],
      };

      // Act
      const result = toHar(request);
      const harResponse = result.log.entries[0].response;

      // Assert
      expect(harResponse.status).toBe(0);
      expect(harResponse.statusText).toBe('');
      expect(harResponse.headers).toHaveLength(0);
    });

    it('should calculate timing from response', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: [],
        query: [],
      };
      const response: ResponseData = {
        status: 200,
        statusText: 'OK',
        headers: {},
        timing: {
          start: 1000,
          end: 1150,
        },
      };

      // Act
      const result = toHar(request, response);
      const entry = result.log.entries[0];

      // Assert
      expect(entry.time).toBe(150);
      expect(entry.timings.wait).toBe(150);
    });
  });

  describe('URL handling', () => {
    it('should include query params in URL', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: [],
        query: ['limit=10'],
      };

      // Act
      const result = toHar(request);
      const harRequest = result.log.entries[0].request;

      // Assert
      expect(harRequest.url).toContain('limit=10');
    });
  });
});
