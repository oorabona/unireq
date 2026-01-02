/**
 * Collection schema validation tests
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  collectionItemSchema,
  collectionSchema,
  httpMethodSchema,
  parseCollectionConfig,
  safeParseCollectionConfig,
  savedRequestSchema,
} from '../schema.js';

describe('Collection Schema', () => {
  describe('httpMethodSchema', () => {
    it('should accept uppercase HTTP methods', () => {
      // Arrange
      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

      // Act & Assert
      for (const method of methods) {
        expect(v.parse(httpMethodSchema, method)).toBe(method);
      }
    });

    it('should normalize lowercase to uppercase', () => {
      // Arrange
      const input = 'post';

      // Act
      const result = v.parse(httpMethodSchema, input);

      // Assert
      expect(result).toBe('POST');
    });

    it('should normalize mixed case to uppercase', () => {
      // Arrange
      const input = 'pAtCh';

      // Act
      const result = v.parse(httpMethodSchema, input);

      // Assert
      expect(result).toBe('PATCH');
    });

    it('should reject invalid HTTP methods', () => {
      // Arrange
      const input = 'INVALID';

      // Act & Assert
      expect(() => v.parse(httpMethodSchema, input)).toThrow();
    });
  });

  describe('savedRequestSchema', () => {
    it('should accept minimal valid request', () => {
      // Arrange
      const input = {
        method: 'GET',
        path: '/health',
      };

      // Act
      const result = v.parse(savedRequestSchema, input);

      // Assert
      expect(result.method).toBe('GET');
      expect(result.path).toBe('/health');
      expect(result.headers).toBeUndefined();
      expect(result.body).toBeUndefined();
    });

    it('should accept request with all optional fields', () => {
      // Arrange
      const input = {
        method: 'POST',
        path: '/users',
        headers: ['Content-Type: application/json', 'Authorization: Bearer token'],
        body: '{"name": "test"}',
        query: ['page=1', 'limit=10'],
      };

      // Act
      const result = v.parse(savedRequestSchema, input);

      // Assert
      expect(result.method).toBe('POST');
      expect(result.path).toBe('/users');
      expect(result.headers).toEqual(['Content-Type: application/json', 'Authorization: Bearer token']);
      expect(result.body).toBe('{"name": "test"}');
      expect(result.query).toEqual(['page=1', 'limit=10']);
    });

    it('should reject empty path', () => {
      // Arrange
      const input = {
        method: 'GET',
        path: '',
      };

      // Act & Assert
      expect(() => v.parse(savedRequestSchema, input)).toThrow();
    });

    it('should reject missing path', () => {
      // Arrange
      const input = {
        method: 'GET',
      };

      // Act & Assert
      expect(() => v.parse(savedRequestSchema, input)).toThrow();
    });

    it('should reject missing method', () => {
      // Arrange
      const input = {
        path: '/health',
      };

      // Act & Assert
      expect(() => v.parse(savedRequestSchema, input)).toThrow();
    });
  });

  describe('collectionItemSchema', () => {
    it('should accept minimal valid item', () => {
      // Arrange
      const input = {
        id: 'health-check',
        name: 'Health Check',
        request: {
          method: 'GET',
          path: '/health',
        },
      };

      // Act
      const result = v.parse(collectionItemSchema, input);

      // Assert
      expect(result.id).toBe('health-check');
      expect(result.name).toBe('Health Check');
      expect(result.description).toBeUndefined();
      expect(result.assert).toBeUndefined();
      expect(result.extract).toBeUndefined();
      expect(result.tags).toBeUndefined();
    });

    it('should accept item with assertions', () => {
      // Arrange
      const input = {
        id: 'health-check',
        name: 'Health Check',
        request: {
          method: 'GET',
          path: '/health',
        },
        assert: {
          status: 200,
          headers: { 'content-type': 'application/json' },
          json: [{ path: '$.status', op: 'equals', value: 'ok' }],
          contains: 'healthy',
        },
      };

      // Act
      const result = v.parse(collectionItemSchema, input);

      // Assert
      expect(result.assert).toBeDefined();
      expect(result.assert?.status).toBe(200);
      expect(result.assert?.headers).toEqual({ 'content-type': 'application/json' });
      expect(result.assert?.json).toHaveLength(1);
      expect(result.assert?.json?.[0]).toEqual({ path: '$.status', op: 'equals', value: 'ok' });
      expect(result.assert?.contains).toBe('healthy');
    });

    it('should accept item with extraction config', () => {
      // Arrange
      const input = {
        id: 'login',
        name: 'Login',
        request: {
          method: 'POST',
          path: '/auth/login',
        },
        extract: {
          vars: {
            token: '$.data.token',
            userId: '$.data.user.id',
          },
        },
      };

      // Act
      const result = v.parse(collectionItemSchema, input);

      // Assert
      expect(result.extract).toBeDefined();
      expect(result.extract?.vars).toEqual({
        token: '$.data.token',
        userId: '$.data.user.id',
      });
    });

    it('should accept item with tags', () => {
      // Arrange
      const input = {
        id: 'health-check',
        name: 'Health Check',
        request: {
          method: 'GET',
          path: '/health',
        },
        tags: ['smoke', 'critical'],
      };

      // Act
      const result = v.parse(collectionItemSchema, input);

      // Assert
      expect(result.tags).toEqual(['smoke', 'critical']);
    });

    it('should reject empty item ID', () => {
      // Arrange
      const input = {
        id: '',
        name: 'Health Check',
        request: {
          method: 'GET',
          path: '/health',
        },
      };

      // Act & Assert
      expect(() => v.parse(collectionItemSchema, input)).toThrow();
    });

    it('should reject empty item name', () => {
      // Arrange
      const input = {
        id: 'health-check',
        name: '',
        request: {
          method: 'GET',
          path: '/health',
        },
      };

      // Act & Assert
      expect(() => v.parse(collectionItemSchema, input)).toThrow();
    });

    it('should validate assertion operators', () => {
      // Arrange
      const validOps = ['equals', 'contains', 'exists', 'matches'];

      for (const op of validOps) {
        const input = {
          id: 'test',
          name: 'Test',
          request: { method: 'GET', path: '/test' },
          assert: { json: [{ path: '$.x', op }] },
        };

        // Act & Assert
        expect(() => v.parse(collectionItemSchema, input)).not.toThrow();
      }
    });

    it('should reject invalid assertion operator', () => {
      // Arrange
      const input = {
        id: 'test',
        name: 'Test',
        request: { method: 'GET', path: '/test' },
        assert: { json: [{ path: '$.x', op: 'invalid' }] },
      };

      // Act & Assert
      expect(() => v.parse(collectionItemSchema, input)).toThrow();
    });

    it('should validate status code range', () => {
      // Arrange
      const validStatuses = [100, 200, 404, 500, 599];

      for (const status of validStatuses) {
        const input = {
          id: 'test',
          name: 'Test',
          request: { method: 'GET', path: '/test' },
          assert: { status },
        };

        // Act & Assert
        expect(() => v.parse(collectionItemSchema, input)).not.toThrow();
      }
    });

    it('should reject invalid status codes', () => {
      // Arrange
      const invalidStatuses = [99, 600, 0, -1];

      for (const status of invalidStatuses) {
        const input = {
          id: 'test',
          name: 'Test',
          request: { method: 'GET', path: '/test' },
          assert: { status },
        };

        // Act & Assert
        expect(() => v.parse(collectionItemSchema, input)).toThrow();
      }
    });
  });

  describe('collectionSchema', () => {
    it('should accept collection with items', () => {
      // Arrange
      const input = {
        id: 'smoke',
        name: 'Smoke Tests',
        description: 'Basic health checks',
        items: [
          {
            id: 'health',
            name: 'Health Check',
            request: { method: 'GET', path: '/health' },
          },
        ],
      };

      // Act
      const result = v.parse(collectionSchema, input);

      // Assert
      expect(result.id).toBe('smoke');
      expect(result.name).toBe('Smoke Tests');
      expect(result.description).toBe('Basic health checks');
      expect(result.items).toHaveLength(1);
    });

    it('should accept collection without items', () => {
      // Arrange
      const input = {
        id: 'empty',
        name: 'Empty Collection',
      };

      // Act
      const result = v.parse(collectionSchema, input);

      // Assert
      expect(result.id).toBe('empty');
      expect(result.items).toEqual([]);
    });

    it('should reject empty collection ID', () => {
      // Arrange
      const input = {
        id: '',
        name: 'Test',
      };

      // Act & Assert
      expect(() => v.parse(collectionSchema, input)).toThrow();
    });
  });

  describe('collectionConfigSchema', () => {
    it('should accept valid config with collections', () => {
      // Arrange
      const input = {
        version: 1,
        collections: [
          {
            id: 'smoke',
            name: 'Smoke Tests',
            items: [
              {
                id: 'health',
                name: 'Health Check',
                request: { method: 'GET', path: '/health' },
              },
            ],
          },
        ],
      };

      // Act
      const result = parseCollectionConfig(input);

      // Assert
      expect(result.version).toBe(1);
      expect(result.collections).toHaveLength(1);
      expect(result.collections[0]?.id).toBe('smoke');
    });

    it('should accept empty config', () => {
      // Arrange
      const input = {};

      // Act
      const result = parseCollectionConfig(input);

      // Assert
      expect(result.version).toBe(1);
      expect(result.collections).toEqual([]);
    });

    it('should accept config with empty collections array', () => {
      // Arrange
      const input = { collections: [] };

      // Act
      const result = parseCollectionConfig(input);

      // Assert
      expect(result.collections).toEqual([]);
    });

    it('should accept null/undefined as empty config', () => {
      // Arrange & Act
      const result = safeParseCollectionConfig(null);

      // Assert - null is not a valid object, should fail
      expect(result.success).toBe(false);
    });

    it('should default version to 1 when not provided', () => {
      // Arrange
      const input = {
        collections: [],
      };

      // Act
      const result = parseCollectionConfig(input);

      // Assert
      expect(result.version).toBe(1);
    });
  });

  describe('safeParseCollectionConfig', () => {
    it('should return success result for valid config', () => {
      // Arrange
      const input = {
        version: 1,
        collections: [],
      };

      // Act
      const result = safeParseCollectionConfig(input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.version).toBe(1);
      }
    });

    it('should return failure result for invalid config', () => {
      // Arrange
      const input = {
        collections: [
          {
            id: 'test',
            name: 'Test',
            items: [
              {
                id: 'item',
                name: 'Item',
                request: {
                  method: 'INVALID_METHOD',
                  path: '/test',
                },
              },
            ],
          },
        ],
      };

      // Act
      const result = safeParseCollectionConfig(input);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});
