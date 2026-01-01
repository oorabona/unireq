/**
 * Tests for OpenAPI Input Validator (orchestration)
 */

import { describe, expect, it } from 'vitest';
import type { OpenAPIDocument, OpenAPIOperation } from '../../types.js';
import { findMatchingPath, getOperationFromPathItem, validateRequest, validateRequestFull } from '../index.js';
import type { ValidatorContext } from '../types.js';

describe('validateRequest', () => {
  describe('Scenario 1: Missing Required Path Parameter', () => {
    it('should warn when required path parameter is missing', () => {
      // Given: an operation with required path param 'id'
      const operation: OpenAPIOperation = {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      };

      // When: user executes with empty id
      const context: ValidatorContext = {
        operation,
        pathTemplate: '/users/{id}',
        actualPath: '/users/',
        queryParams: [],
        headerParams: [],
        hasBody: false,
      };

      const result = validateRequest(context);

      // Then: warning is displayed
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.message).toContain('Missing required path parameter: id');
    });
  });

  describe('Scenario 2: Missing Required Query Parameter', () => {
    it('should warn when required query parameter is missing', () => {
      // Given: an operation with required query param 'status'
      const operation: OpenAPIOperation = {
        parameters: [{ name: 'status', in: 'query', required: true, schema: { type: 'string' } }],
      };

      // When: user executes without -q status=...
      const context: ValidatorContext = {
        operation,
        pathTemplate: '/orders',
        actualPath: '/orders',
        queryParams: [],
        headerParams: [],
        hasBody: false,
      };

      const result = validateRequest(context);

      // Then: warning is displayed
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.message).toContain('Missing required query parameter: status');
    });
  });

  describe('Scenario 3: Invalid Enum Value', () => {
    it('should warn when enum value is invalid', () => {
      // Given: an operation with enum query param
      const operation: OpenAPIOperation = {
        parameters: [{ name: 'status', in: 'query', required: false, schema: { enum: ['pending', 'shipped'] } }],
      };

      // When: user provides invalid enum value
      const context: ValidatorContext = {
        operation,
        pathTemplate: '/orders',
        actualPath: '/orders',
        queryParams: ['status=invalid'],
        headerParams: [],
        hasBody: false,
      };

      const result = validateRequest(context);

      // Then: warning about invalid enum is displayed
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.message).toContain('must be one of: pending, shipped');
    });
  });

  describe('Scenario 4: Type Mismatch - Integer', () => {
    it('should warn when integer parameter receives non-integer', () => {
      // Given: an operation with integer path param
      const operation: OpenAPIOperation = {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      };

      // When: user provides non-integer value
      const context: ValidatorContext = {
        operation,
        pathTemplate: '/users/{id}',
        actualPath: '/users/abc',
        queryParams: [],
        headerParams: [],
        hasBody: false,
      };

      const result = validateRequest(context);

      // Then: warning about type mismatch is displayed
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.message).toContain("should be integer, got 'abc'");
    });
  });

  describe('Scenario 5: Type Mismatch - Number', () => {
    it('should warn when number parameter receives non-number', () => {
      // Given: an operation with number query param
      const operation: OpenAPIOperation = {
        parameters: [{ name: 'price', in: 'query', required: false, schema: { type: 'number' } }],
      };

      // When: user provides non-number value
      const context: ValidatorContext = {
        operation,
        pathTemplate: '/products',
        actualPath: '/products',
        queryParams: ['price=expensive'],
        headerParams: [],
        hasBody: false,
      };

      const result = validateRequest(context);

      // Then: warning about type mismatch is displayed
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.message).toContain("should be number, got 'expensive'");
    });
  });

  describe('Scenario 6: Missing Required Request Body', () => {
    it('should warn when required body is missing', () => {
      // Given: an operation with required request body
      const operation: OpenAPIOperation = {
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
      };

      // When: user executes without body
      const context: ValidatorContext = {
        operation,
        pathTemplate: '/users',
        actualPath: '/users',
        queryParams: [],
        headerParams: [],
        hasBody: false,
      };

      const result = validateRequest(context);

      // Then: warning about missing body is displayed
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.message).toBe('Missing required request body');
    });
  });

  describe('Scenario 9: Optional Parameter Missing (No Warning)', () => {
    it('should not warn when optional parameter is missing', () => {
      // Given: an operation with optional query param
      const operation: OpenAPIOperation = {
        parameters: [{ name: 'limit', in: 'query', required: false, schema: { type: 'integer' } }],
      };

      // When: user executes without -q limit=...
      const context: ValidatorContext = {
        operation,
        pathTemplate: '/users',
        actualPath: '/users',
        queryParams: [],
        headerParams: [],
        hasBody: false,
      };

      const result = validateRequest(context);

      // Then: no warning is displayed
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Scenario 10: Valid Request (No Warnings)', () => {
    it('should not warn when request is valid', () => {
      // Given: an operation with required path param
      const operation: OpenAPIOperation = {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      };

      // When: user executes with valid integer
      const context: ValidatorContext = {
        operation,
        pathTemplate: '/users/{id}',
        actualPath: '/users/123',
        queryParams: [],
        headerParams: [],
        hasBody: false,
      };

      const result = validateRequest(context);

      // Then: no warnings
      expect(result.warnings).toHaveLength(0);
      expect(result.skipped).toBe(false);
    });
  });
});

describe('findMatchingPath', () => {
  const createDoc = (paths: Record<string, unknown>): OpenAPIDocument => ({
    openapi: '3.0.0',
    info: { title: 'Test', version: '1.0.0' },
    paths: paths as OpenAPIDocument['paths'],
  });

  describe('when path exists', () => {
    it('should find exact path', () => {
      const doc = createDoc({ '/users': { get: {} } });
      const result = findMatchingPath(doc, '/users');

      expect(result).toBeDefined();
      expect(result?.template).toBe('/users');
    });

    it('should find path with parameter', () => {
      const doc = createDoc({ '/users/{id}': { get: {} } });
      const result = findMatchingPath(doc, '/users/123');

      expect(result).toBeDefined();
      expect(result?.template).toBe('/users/{id}');
    });

    it('should find path with multiple parameters', () => {
      const doc = createDoc({ '/users/{userId}/posts/{postId}': { get: {} } });
      const result = findMatchingPath(doc, '/users/1/posts/2');

      expect(result).toBeDefined();
      expect(result?.template).toBe('/users/{userId}/posts/{postId}');
    });
  });

  describe('when path does not exist', () => {
    it('should return undefined for unmatched path', () => {
      const doc = createDoc({ '/users': { get: {} } });
      const result = findMatchingPath(doc, '/products');

      expect(result).toBeUndefined();
    });

    it('should return undefined when segment count differs', () => {
      const doc = createDoc({ '/users/{id}': { get: {} } });
      const result = findMatchingPath(doc, '/users/123/extra');

      expect(result).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty paths object', () => {
      const doc = createDoc({});
      const result = findMatchingPath(doc, '/users');

      expect(result).toBeUndefined();
    });

    it('should return path-level parameters', () => {
      const doc = createDoc({
        '/users/{id}': {
          parameters: [{ name: 'id', in: 'path', required: true }],
          get: {},
        },
      });
      const result = findMatchingPath(doc, '/users/123');

      expect(result?.pathParameters).toHaveLength(1);
    });
  });
});

describe('getOperationFromPathItem', () => {
  it('should get operation by lowercase method', () => {
    const pathItem = { get: { summary: 'List users' }, post: { summary: 'Create user' } };

    expect(getOperationFromPathItem(pathItem, 'get')?.summary).toBe('List users');
    expect(getOperationFromPathItem(pathItem, 'GET')?.summary).toBe('List users');
    expect(getOperationFromPathItem(pathItem, 'post')?.summary).toBe('Create user');
  });

  it('should return undefined for non-existent method', () => {
    const pathItem = { get: { summary: 'List users' } };

    expect(getOperationFromPathItem(pathItem, 'delete')).toBeUndefined();
  });
});

describe('validateRequestFull', () => {
  const createDoc = (paths: Record<string, unknown>): OpenAPIDocument => ({
    openapi: '3.0.0',
    info: { title: 'Test', version: '1.0.0' },
    paths: paths as OpenAPIDocument['paths'],
  });

  describe('Scenario 7: No OpenAPI Spec Loaded', () => {
    it('should skip validation when no spec is loaded', () => {
      // Given: no OpenAPI spec loaded
      // When: user executes request
      const result = validateRequestFull(undefined, 'GET', '/users', [], [], false);

      // Then: validation is skipped
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe('No OpenAPI spec loaded');
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Scenario 8: Path Not in Spec', () => {
    it('should skip validation when path not in spec', () => {
      // Given: an OpenAPI spec without path "/custom"
      const doc = createDoc({ '/users': { get: {} } });

      // When: user executes request to /custom
      const result = validateRequestFull(doc, 'GET', '/custom', [], [], false);

      // Then: validation is skipped
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe('Path not found in OpenAPI spec');
    });
  });

  describe('when method not defined', () => {
    it('should skip validation when method not in spec', () => {
      const doc = createDoc({ '/users': { get: {} } });
      const result = validateRequestFull(doc, 'DELETE', '/users', [], [], false);

      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain('Method DELETE not defined');
    });
  });

  describe('full integration', () => {
    it('should validate and return warnings', () => {
      const doc = createDoc({
        '/users/{id}': {
          get: {
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          },
        },
      });

      const result = validateRequestFull(doc, 'GET', '/users/abc', [], [], false);

      expect(result.skipped).toBe(false);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]?.message).toContain('should be integer');
    });

    it('should merge path-level parameters', () => {
      const doc = createDoc({
        '/tenants/{tenantId}/users': {
          parameters: [{ name: 'tenantId', in: 'path', required: true, schema: { type: 'integer' } }],
          get: {
            parameters: [{ name: 'limit', in: 'query', required: true }],
          },
        },
      });

      // Provide non-integer tenantId (type error) and missing limit (required error)
      const result = validateRequestFull(doc, 'GET', '/tenants/abc/users', [], [], false);

      // Should have warnings for both: tenantId type error, limit missing
      expect(result.warnings.some((w) => w.param === 'tenantId')).toBe(true);
      expect(result.warnings.some((w) => w.param === 'limit')).toBe(true);
    });
  });
});
