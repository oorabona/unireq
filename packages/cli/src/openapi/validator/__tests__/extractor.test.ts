/**
 * Tests for OpenAPI Parameter Extractor
 */

import { describe, expect, it } from 'vitest';
import type { OpenAPIOperation, OpenAPIParameter } from '../../types.js';
import {
  extractAllParams,
  extractHeaderParams,
  extractPathParams,
  extractQueryParams,
  resolveParameters,
} from '../extractor.js';

describe('extractPathParams', () => {
  describe('when path matches template', () => {
    it('should extract single path parameter', () => {
      // Arrange
      const actualPath = '/users/123';
      const pathTemplate = '/users/{id}';

      // Act
      const params = extractPathParams(actualPath, pathTemplate);

      // Assert
      expect(params.get('id')).toBe('123');
    });

    it('should extract multiple path parameters', () => {
      // Arrange
      const actualPath = '/users/123/posts/456';
      const pathTemplate = '/users/{userId}/posts/{postId}';

      // Act
      const params = extractPathParams(actualPath, pathTemplate);

      // Assert
      expect(params.get('userId')).toBe('123');
      expect(params.get('postId')).toBe('456');
    });

    it('should handle path with no parameters', () => {
      // Arrange
      const actualPath = '/users';
      const pathTemplate = '/users';

      // Act
      const params = extractPathParams(actualPath, pathTemplate);

      // Assert
      expect(params.size).toBe(0);
    });
  });

  describe('when path does not match template', () => {
    it('should return empty map when segment counts differ', () => {
      // Arrange
      const actualPath = '/users/123/extra';
      const pathTemplate = '/users/{id}';

      // Act
      const params = extractPathParams(actualPath, pathTemplate);

      // Assert
      expect(params.size).toBe(0);
    });
  });

  describe('path normalization', () => {
    it('should handle trailing slashes', () => {
      const params = extractPathParams('/users/123/', '/users/{id}');
      expect(params.get('id')).toBe('123');
    });

    it('should handle missing leading slashes', () => {
      const params = extractPathParams('users/123', '/users/{id}');
      expect(params.get('id')).toBe('123');
    });

    it('should remove query strings', () => {
      const params = extractPathParams('/users/123?foo=bar', '/users/{id}');
      expect(params.get('id')).toBe('123');
    });
  });
});

describe('extractQueryParams', () => {
  it('should extract key=value pairs', () => {
    // Arrange
    const queryParams = ['status=active', 'limit=10'];

    // Act
    const params = extractQueryParams(queryParams);

    // Assert
    expect(params.get('status')).toBe('active');
    expect(params.get('limit')).toBe('10');
  });

  it('should handle empty values', () => {
    const params = extractQueryParams(['flag=']);
    expect(params.get('flag')).toBe('');
  });

  it('should handle keys without equals sign', () => {
    const params = extractQueryParams(['flag']);
    expect(params.get('flag')).toBe('');
  });

  it('should handle values with equals signs', () => {
    const params = extractQueryParams(['filter=a=b']);
    expect(params.get('filter')).toBe('a=b');
  });

  it('should trim whitespace', () => {
    const params = extractQueryParams(['  status  =  active  ']);
    expect(params.get('status')).toBe('active');
  });

  it('should handle empty array', () => {
    const params = extractQueryParams([]);
    expect(params.size).toBe(0);
  });
});

describe('extractHeaderParams', () => {
  it('should extract key:value pairs', () => {
    // Arrange
    const headerParams = ['Authorization:Bearer token', 'Content-Type:application/json'];

    // Act
    const params = extractHeaderParams(headerParams);

    // Assert
    expect(params.get('authorization')).toBe('Bearer token');
    expect(params.get('content-type')).toBe('application/json');
  });

  it('should lowercase header names', () => {
    const params = extractHeaderParams(['X-Custom-Header:value']);
    expect(params.get('x-custom-header')).toBe('value');
    expect(params.has('X-Custom-Header')).toBe(false);
  });

  it('should handle values with colons', () => {
    const params = extractHeaderParams(['X-Time:10:30:00']);
    expect(params.get('x-time')).toBe('10:30:00');
  });

  it('should skip entries without colons', () => {
    const params = extractHeaderParams(['InvalidHeader']);
    expect(params.size).toBe(0);
  });

  it('should handle empty array', () => {
    const params = extractHeaderParams([]);
    expect(params.size).toBe(0);
  });
});

describe('extractAllParams', () => {
  it('should extract all parameter types', () => {
    // Arrange
    const actualPath = '/users/123';
    const pathTemplate = '/users/{id}';
    const queryParams = ['status=active'];
    const headerParams = ['X-Token:abc'];

    // Act
    const params = extractAllParams(actualPath, pathTemplate, queryParams, headerParams);

    // Assert
    expect(params.path.get('id')).toBe('123');
    expect(params.query.get('status')).toBe('active');
    expect(params.header.get('x-token')).toBe('abc');
  });
});

describe('resolveParameters', () => {
  describe('when operation has parameters', () => {
    it('should resolve operation parameters', () => {
      // Arrange
      const operation: OpenAPIOperation = {
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'status', in: 'query', required: false, schema: { type: 'string' } },
        ],
      };

      // Act
      const params = resolveParameters(operation);

      // Assert
      expect(params).toHaveLength(2);
      expect(params[0]).toEqual({
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'integer' },
        deprecated: undefined,
      });
    });
  });

  describe('when path has parameters', () => {
    it('should include path-level parameters', () => {
      // Arrange
      const operation: OpenAPIOperation = {};
      const pathParams: OpenAPIParameter[] = [{ name: 'tenantId', in: 'header', required: true }];

      // Act
      const params = resolveParameters(operation, pathParams);

      // Assert
      expect(params).toHaveLength(1);
      expect(params[0]?.name).toBe('tenantId');
    });

    it('should let operation parameters override path parameters', () => {
      // Arrange
      const operation: OpenAPIOperation = {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      };
      const pathParams: OpenAPIParameter[] = [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }];

      // Act
      const params = resolveParameters(operation, pathParams);

      // Assert
      expect(params).toHaveLength(1);
      expect(params[0]?.schema?.type).toBe('string'); // Operation wins
    });
  });

  describe('when parameters have special cases', () => {
    it('should skip cookie parameters', () => {
      // Arrange
      const operation: OpenAPIOperation = {
        parameters: [{ name: 'session', in: 'cookie', required: true }],
      };

      // Act
      const params = resolveParameters(operation);

      // Assert
      expect(params).toHaveLength(0);
    });

    it('should mark path parameters as required by default', () => {
      // Arrange
      const operation: OpenAPIOperation = {
        parameters: [{ name: 'id', in: 'path' }], // No explicit required
      };

      // Act
      const params = resolveParameters(operation);

      // Assert
      expect(params[0]?.required).toBe(true);
    });

    it('should preserve deprecated flag', () => {
      // Arrange
      const operation: OpenAPIOperation = {
        parameters: [{ name: 'old', in: 'query', deprecated: true }],
      };

      // Act
      const params = resolveParameters(operation);

      // Assert
      expect(params[0]?.deprecated).toBe(true);
    });
  });
});
