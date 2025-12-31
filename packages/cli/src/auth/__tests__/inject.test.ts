/**
 * Tests for credential injection into requests
 */

import { describe, expect, it } from 'vitest';
import type { ParsedRequest } from '../../types.js';
import { injectCredential, injectCredentials } from '../inject.js';
import type { ResolvedCredential } from '../types.js';

/**
 * Helper to create a minimal ParsedRequest
 */
function createRequest(overrides: Partial<ParsedRequest> = {}): ParsedRequest {
  return {
    method: 'GET',
    url: '/api/test',
    headers: [],
    query: [],
    ...overrides,
  };
}

describe('injectCredential', () => {
  describe('header injection', () => {
    it('should inject header into empty headers array', () => {
      // Arrange
      const request = createRequest();
      const credential: ResolvedCredential = {
        location: 'header',
        name: 'Authorization',
        value: 'Bearer token123',
      };

      // Act
      const result = injectCredential(request, credential);

      // Assert
      expect(result.headers).toEqual(['Authorization:Bearer token123']);
    });

    it('should append header to existing headers', () => {
      // Arrange
      const request = createRequest({
        headers: ['Content-Type:application/json'],
      });
      const credential: ResolvedCredential = {
        location: 'header',
        name: 'Authorization',
        value: 'Bearer token123',
      };

      // Act
      const result = injectCredential(request, credential);

      // Assert
      expect(result.headers).toEqual(['Content-Type:application/json', 'Authorization:Bearer token123']);
    });

    it('should replace existing header with same name (case-insensitive)', () => {
      // Arrange
      const request = createRequest({
        headers: ['authorization:old-token', 'Content-Type:application/json'],
      });
      const credential: ResolvedCredential = {
        location: 'header',
        name: 'Authorization',
        value: 'Bearer new-token',
      };

      // Act
      const result = injectCredential(request, credential);

      // Assert
      expect(result.headers).toEqual(['Content-Type:application/json', 'Authorization:Bearer new-token']);
    });

    it('should not modify original request', () => {
      // Arrange
      const request = createRequest();
      const credential: ResolvedCredential = {
        location: 'header',
        name: 'X-API-Key',
        value: 'secret',
      };

      // Act
      injectCredential(request, credential);

      // Assert
      expect(request.headers).toEqual([]);
    });

    it('should handle API key header', () => {
      // Arrange
      const request = createRequest();
      const credential: ResolvedCredential = {
        location: 'header',
        name: 'X-API-Key',
        value: 'my-api-key-123',
      };

      // Act
      const result = injectCredential(request, credential);

      // Assert
      expect(result.headers).toEqual(['X-API-Key:my-api-key-123']);
    });
  });

  describe('query injection', () => {
    it('should inject query param into empty query array', () => {
      // Arrange
      const request = createRequest();
      const credential: ResolvedCredential = {
        location: 'query',
        name: 'api_key',
        value: 'secret123',
      };

      // Act
      const result = injectCredential(request, credential);

      // Assert
      expect(result.query).toEqual(['api_key=secret123']);
    });

    it('should append query param to existing params', () => {
      // Arrange
      const request = createRequest({
        query: ['limit=10', 'offset=0'],
      });
      const credential: ResolvedCredential = {
        location: 'query',
        name: 'token',
        value: 'abc123',
      };

      // Act
      const result = injectCredential(request, credential);

      // Assert
      expect(result.query).toEqual(['limit=10', 'offset=0', 'token=abc123']);
    });

    it('should replace existing query param with same name', () => {
      // Arrange
      const request = createRequest({
        query: ['api_key=old-key', 'limit=10'],
      });
      const credential: ResolvedCredential = {
        location: 'query',
        name: 'api_key',
        value: 'new-key',
      };

      // Act
      const result = injectCredential(request, credential);

      // Assert
      expect(result.query).toEqual(['limit=10', 'api_key=new-key']);
    });

    it('should not modify original request', () => {
      // Arrange
      const request = createRequest();
      const credential: ResolvedCredential = {
        location: 'query',
        name: 'token',
        value: 'abc',
      };

      // Act
      injectCredential(request, credential);

      // Assert
      expect(request.query).toEqual([]);
    });
  });

  describe('cookie injection', () => {
    it('should inject cookie as Cookie header when no cookies exist', () => {
      // Arrange
      const request = createRequest();
      const credential: ResolvedCredential = {
        location: 'cookie',
        name: 'session',
        value: 'abc123',
      };

      // Act
      const result = injectCredential(request, credential);

      // Assert
      expect(result.headers).toEqual(['Cookie:session=abc123']);
    });

    it('should append to existing Cookie header', () => {
      // Arrange
      const request = createRequest({
        headers: ['Cookie:existing=value'],
      });
      const credential: ResolvedCredential = {
        location: 'cookie',
        name: 'session',
        value: 'abc123',
      };

      // Act
      const result = injectCredential(request, credential);

      // Assert
      expect(result.headers).toEqual(['Cookie:existing=value; session=abc123']);
    });

    it('should handle Cookie header case-insensitively', () => {
      // Arrange
      const request = createRequest({
        headers: ['cookie:existing=value'],
      });
      const credential: ResolvedCredential = {
        location: 'cookie',
        name: 'token',
        value: 'xyz',
      };

      // Act
      const result = injectCredential(request, credential);

      // Assert
      expect(result.headers).toEqual(['Cookie:existing=value; token=xyz']);
    });

    it('should preserve other headers when adding cookie', () => {
      // Arrange
      const request = createRequest({
        headers: ['Content-Type:application/json', 'Accept:*/*'],
      });
      const credential: ResolvedCredential = {
        location: 'cookie',
        name: 'auth',
        value: 'token',
      };

      // Act
      const result = injectCredential(request, credential);

      // Assert
      expect(result.headers).toEqual(['Content-Type:application/json', 'Accept:*/*', 'Cookie:auth=token']);
    });

    it('should not modify original request', () => {
      // Arrange
      const request = createRequest();
      const credential: ResolvedCredential = {
        location: 'cookie',
        name: 'session',
        value: 'abc',
      };

      // Act
      injectCredential(request, credential);

      // Assert
      expect(request.headers).toEqual([]);
    });
  });
});

describe('injectCredentials', () => {
  it('should inject multiple credentials of different types', () => {
    // Arrange
    const request = createRequest();
    const credentials: ResolvedCredential[] = [
      { location: 'header', name: 'Authorization', value: 'Bearer token' },
      { location: 'query', name: 'client_id', value: 'abc' },
      { location: 'cookie', name: 'session', value: 'xyz' },
    ];

    // Act
    const result = injectCredentials(request, credentials);

    // Assert
    expect(result.headers).toEqual(['Authorization:Bearer token', 'Cookie:session=xyz']);
    expect(result.query).toEqual(['client_id=abc']);
  });

  it('should return unchanged request for empty credentials array', () => {
    // Arrange
    const request = createRequest({
      headers: ['Existing:header'],
      query: ['existing=param'],
    });

    // Act
    const result = injectCredentials(request, []);

    // Assert
    expect(result.headers).toEqual(['Existing:header']);
    expect(result.query).toEqual(['existing=param']);
  });

  it('should inject multiple cookies into same Cookie header', () => {
    // Arrange
    const request = createRequest();
    const credentials: ResolvedCredential[] = [
      { location: 'cookie', name: 'session', value: 'sess123' },
      { location: 'cookie', name: 'token', value: 'tok456' },
    ];

    // Act
    const result = injectCredentials(request, credentials);

    // Assert
    expect(result.headers).toEqual(['Cookie:session=sess123; token=tok456']);
  });

  it('should handle later credential overwriting earlier one', () => {
    // Arrange
    const request = createRequest();
    const credentials: ResolvedCredential[] = [
      { location: 'header', name: 'Authorization', value: 'Bearer old' },
      { location: 'header', name: 'Authorization', value: 'Bearer new' },
    ];

    // Act
    const result = injectCredentials(request, credentials);

    // Assert
    expect(result.headers).toEqual(['Authorization:Bearer new']);
  });
});
