import { describe, expect, it } from 'vitest';
import {
  CollectionNotFoundError,
  findCollectionItem,
  getAvailableCollections,
  getAvailableItems,
  ItemNotFoundError,
  parseRunArgs,
  RunSyntaxError,
  savedRequestToParsedRequest,
} from '../runner.js';
import type { CollectionConfig, CollectionItem, SavedRequest } from '../types.js';

describe('parseRunArgs', () => {
  describe('when valid arguments are provided', () => {
    it('should parse collection/item format', () => {
      // Arrange
      const args = ['smoke/health'];

      // Act
      const result = parseRunArgs(args);

      // Assert
      expect(result).toEqual({
        collectionId: 'smoke',
        itemId: 'health',
      });
    });

    it('should handle collection and item with hyphens', () => {
      // Arrange
      const args = ['api-tests/create-user'];

      // Act
      const result = parseRunArgs(args);

      // Assert
      expect(result).toEqual({
        collectionId: 'api-tests',
        itemId: 'create-user',
      });
    });

    it('should handle nested paths in item ID', () => {
      // Arrange
      const args = ['api/users/list'];

      // Act
      const result = parseRunArgs(args);

      // Assert
      expect(result).toEqual({
        collectionId: 'api',
        itemId: 'users/list',
      });
    });
  });

  describe('when invalid arguments are provided', () => {
    it('should throw RunSyntaxError for empty args', () => {
      // Arrange
      const args: string[] = [];

      // Act & Assert
      expect(() => parseRunArgs(args)).toThrow(RunSyntaxError);
      expect(() => parseRunArgs(args)).toThrow('Usage: run <collection>/<item>');
    });

    it('should throw RunSyntaxError for missing slash', () => {
      // Arrange
      const args = ['smoke'];

      // Act & Assert
      expect(() => parseRunArgs(args)).toThrow(RunSyntaxError);
      expect(() => parseRunArgs(args)).toThrow('run smoke/<item>');
    });

    it('should throw RunSyntaxError for empty collection ID', () => {
      // Arrange
      const args = ['/health'];

      // Act & Assert
      expect(() => parseRunArgs(args)).toThrow(RunSyntaxError);
      expect(() => parseRunArgs(args)).toThrow('Collection ID cannot be empty');
    });

    it('should throw RunSyntaxError for empty item ID', () => {
      // Arrange
      const args = ['smoke/'];

      // Act & Assert
      expect(() => parseRunArgs(args)).toThrow(RunSyntaxError);
      expect(() => parseRunArgs(args)).toThrow('Item ID cannot be empty');
    });
  });
});

describe('findCollectionItem', () => {
  const createConfig = (collections: CollectionConfig['collections']): CollectionConfig => ({
    version: 1,
    collections,
  });

  const createItem = (id: string, method = 'GET', path = '/test'): CollectionItem => ({
    id,
    name: id,
    request: { method: method as CollectionItem['request']['method'], path },
  });

  describe('when collection and item exist', () => {
    it('should return the item', () => {
      // Arrange
      const config = createConfig([
        {
          id: 'smoke',
          name: 'Smoke Tests',
          items: [createItem('health'), createItem('status')],
        },
      ]);

      // Act
      const result = findCollectionItem(config, 'smoke', 'health');

      // Assert
      expect(result.id).toBe('health');
    });

    it('should find item in correct collection when multiple exist', () => {
      // Arrange
      const config = createConfig([
        {
          id: 'smoke',
          name: 'Smoke Tests',
          items: [createItem('health')],
        },
        {
          id: 'api',
          name: 'API Tests',
          items: [createItem('users'), createItem('orders')],
        },
      ]);

      // Act
      const result = findCollectionItem(config, 'api', 'orders');

      // Assert
      expect(result.id).toBe('orders');
    });
  });

  describe('when collection does not exist', () => {
    it('should throw CollectionNotFoundError', () => {
      // Arrange
      const config = createConfig([{ id: 'smoke', name: 'Smoke Tests', items: [createItem('health')] }]);

      // Act & Assert
      expect(() => findCollectionItem(config, 'nonexistent', 'health')).toThrow(CollectionNotFoundError);
    });

    it('should include available collections in error', () => {
      // Arrange
      const config = createConfig([
        { id: 'smoke', name: 'Smoke Tests', items: [] },
        { id: 'api', name: 'API Tests', items: [] },
      ]);

      // Act & Assert
      try {
        findCollectionItem(config, 'nonexistent', 'health');
      } catch (error) {
        expect(error).toBeInstanceOf(CollectionNotFoundError);
        const err = error as CollectionNotFoundError;
        expect(err.availableCollections).toEqual(['smoke', 'api']);
        expect(err.message).toContain('Available: smoke, api');
      }
    });

    it('should indicate no collections when list is empty', () => {
      // Arrange
      const config = createConfig([]);

      // Act & Assert
      try {
        findCollectionItem(config, 'nonexistent', 'health');
      } catch (error) {
        expect(error).toBeInstanceOf(CollectionNotFoundError);
        const err = error as CollectionNotFoundError;
        expect(err.message).toContain('No collections defined');
      }
    });
  });

  describe('when item does not exist', () => {
    it('should throw ItemNotFoundError', () => {
      // Arrange
      const config = createConfig([{ id: 'smoke', name: 'Smoke Tests', items: [createItem('health')] }]);

      // Act & Assert
      expect(() => findCollectionItem(config, 'smoke', 'nonexistent')).toThrow(ItemNotFoundError);
    });

    it('should include available items in error', () => {
      // Arrange
      const config = createConfig([
        {
          id: 'smoke',
          name: 'Smoke Tests',
          items: [createItem('health'), createItem('status')],
        },
      ]);

      // Act & Assert
      try {
        findCollectionItem(config, 'smoke', 'nonexistent');
      } catch (error) {
        expect(error).toBeInstanceOf(ItemNotFoundError);
        const err = error as ItemNotFoundError;
        expect(err.availableItems).toEqual(['health', 'status']);
        expect(err.message).toContain('Available: health, status');
        expect(err.collectionId).toBe('smoke');
      }
    });

    it('should indicate empty collection when no items', () => {
      // Arrange
      const config = createConfig([{ id: 'smoke', name: 'Smoke Tests', items: [] }]);

      // Act & Assert
      try {
        findCollectionItem(config, 'smoke', 'nonexistent');
      } catch (error) {
        expect(error).toBeInstanceOf(ItemNotFoundError);
        const err = error as ItemNotFoundError;
        expect(err.message).toContain('Collection is empty');
      }
    });
  });
});

describe('savedRequestToParsedRequest', () => {
  describe('when converting basic request', () => {
    it('should transform method and path', () => {
      // Arrange
      const saved: SavedRequest = {
        method: 'GET',
        path: '/health',
      };

      // Act
      const result = savedRequestToParsedRequest(saved);

      // Assert
      expect(result.method).toBe('GET');
      expect(result.url).toBe('/health');
      expect(result.headers).toEqual([]);
      expect(result.query).toEqual([]);
      expect(result.body).toBeUndefined();
    });
  });

  describe('when base URL is provided', () => {
    it('should prepend base URL to path', () => {
      // Arrange
      const saved: SavedRequest = {
        method: 'GET',
        path: '/users',
      };

      // Act
      const result = savedRequestToParsedRequest(saved, { baseUrl: 'https://api.example.com' });

      // Assert
      expect(result.url).toBe('https://api.example.com/users');
    });

    it('should handle base URL with trailing slash', () => {
      // Arrange
      const saved: SavedRequest = {
        method: 'GET',
        path: '/users',
      };

      // Act
      const result = savedRequestToParsedRequest(saved, { baseUrl: 'https://api.example.com/' });

      // Assert
      expect(result.url).toBe('https://api.example.com/users');
    });

    it('should handle path without leading slash', () => {
      // Arrange
      const saved: SavedRequest = {
        method: 'GET',
        path: 'users',
      };

      // Act
      const result = savedRequestToParsedRequest(saved, { baseUrl: 'https://api.example.com' });

      // Assert
      expect(result.url).toBe('https://api.example.com/users');
    });
  });

  describe('when headers are provided', () => {
    it('should include headers in output', () => {
      // Arrange
      const saved: SavedRequest = {
        method: 'POST',
        path: '/users',
        headers: ['Authorization: Bearer token', 'Content-Type: application/json'],
      };

      // Act
      const result = savedRequestToParsedRequest(saved);

      // Assert
      expect(result.headers).toEqual(['Authorization: Bearer token', 'Content-Type: application/json']);
    });
  });

  describe('when query params are provided', () => {
    it('should include query in output', () => {
      // Arrange
      const saved: SavedRequest = {
        method: 'GET',
        path: '/users',
        query: ['limit=10', 'offset=0'],
      };

      // Act
      const result = savedRequestToParsedRequest(saved);

      // Assert
      expect(result.query).toEqual(['limit=10', 'offset=0']);
    });
  });

  describe('when body is provided', () => {
    it('should include body in output', () => {
      // Arrange
      const saved: SavedRequest = {
        method: 'POST',
        path: '/users',
        body: '{"name": "Alice"}',
      };

      // Act
      const result = savedRequestToParsedRequest(saved);

      // Assert
      expect(result.body).toBe('{"name": "Alice"}');
    });
  });

  describe('when all fields are provided', () => {
    it('should transform complete request', () => {
      // Arrange
      const saved: SavedRequest = {
        method: 'PUT',
        path: '/users/123',
        headers: ['Authorization: Bearer token'],
        query: ['version=2'],
        body: '{"name": "Updated"}',
      };

      // Act
      const result = savedRequestToParsedRequest(saved, { baseUrl: 'https://api.example.com' });

      // Assert
      expect(result).toEqual({
        method: 'PUT',
        url: 'https://api.example.com/users/123',
        headers: ['Authorization: Bearer token'],
        query: ['version=2'],
        body: '{"name": "Updated"}',
      });
    });
  });

  describe('when vars are provided for interpolation', () => {
    it('should interpolate variables in path', () => {
      // Arrange
      const saved: SavedRequest = {
        method: 'GET',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data
        path: '/users/${var:userId}',
      };

      // Act
      const result = savedRequestToParsedRequest(saved, { vars: { userId: '123' } });

      // Assert
      expect(result.url).toBe('/users/123');
    });

    it('should interpolate variables in headers', () => {
      // Arrange
      const saved: SavedRequest = {
        method: 'GET',
        path: '/users',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data
        headers: ['Authorization: Bearer ${var:token}'],
      };

      // Act
      const result = savedRequestToParsedRequest(saved, { vars: { token: 'jwt.token.here' } });

      // Assert
      expect(result.headers).toEqual(['Authorization: Bearer jwt.token.here']);
    });

    it('should interpolate variables in query', () => {
      // Arrange
      const saved: SavedRequest = {
        method: 'GET',
        path: '/users',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data
        query: ['userId=${var:userId}', 'limit=10'],
      };

      // Act
      const result = savedRequestToParsedRequest(saved, { vars: { userId: 'abc123' } });

      // Assert
      expect(result.query).toEqual(['userId=abc123', 'limit=10']);
    });

    it('should interpolate variables in body', () => {
      // Arrange
      const saved: SavedRequest = {
        method: 'POST',
        path: '/orders',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data
        body: '{"userId": "${var:userId}", "product": "widget"}',
      };

      // Act
      const result = savedRequestToParsedRequest(saved, { vars: { userId: 'user-42' } });

      // Assert
      expect(result.body).toBe('{"userId": "user-42", "product": "widget"}');
    });

    it('should interpolate multiple vars', () => {
      // Arrange
      const saved: SavedRequest = {
        method: 'POST',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data
        path: '/api/${var:version}/users/${var:userId}',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data
        headers: ['X-Token: ${var:token}'],
        // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data
        body: '{"name": "${var:name}"}',
      };

      // Act
      const result = savedRequestToParsedRequest(saved, {
        baseUrl: 'https://api.example.com',
        vars: { version: 'v2', userId: '123', token: 'secret', name: 'Alice' },
      });

      // Assert
      expect(result.url).toBe('https://api.example.com/api/v2/users/123');
      expect(result.headers).toEqual(['X-Token: secret']);
      expect(result.body).toBe('{"name": "Alice"}');
    });

    it('should keep original value if var is not found', () => {
      // Arrange
      const saved: SavedRequest = {
        method: 'GET',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data
        path: '/users/${var:userId}',
      };

      // Act
      const result = savedRequestToParsedRequest(saved, { vars: {} });

      // Assert - original is kept when var not found (no error thrown)
      // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data
      expect(result.url).toBe('/users/${var:userId}');
    });

    it('should interpolate baseUrl with vars', () => {
      // Arrange
      const saved: SavedRequest = {
        method: 'GET',
        path: '/users',
      };

      // Act
      const result = savedRequestToParsedRequest(saved, {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: intentional test data
        baseUrl: 'https://${var:host}/api',
        vars: { host: 'prod.example.com' },
      });

      // Assert
      expect(result.url).toBe('https://prod.example.com/api/users');
    });
  });
});

describe('getAvailableCollections', () => {
  it('should return empty array for empty config', () => {
    // Arrange
    const config: CollectionConfig = { version: 1, collections: [] };

    // Act
    const result = getAvailableCollections(config);

    // Assert
    expect(result).toEqual([]);
  });

  it('should return all collection IDs', () => {
    // Arrange
    const config: CollectionConfig = {
      version: 1,
      collections: [
        { id: 'smoke', name: 'Smoke', items: [] },
        { id: 'api', name: 'API', items: [] },
      ],
    };

    // Act
    const result = getAvailableCollections(config);

    // Assert
    expect(result).toEqual(['smoke', 'api']);
  });
});

describe('getAvailableItems', () => {
  it('should return empty array for non-existent collection', () => {
    // Arrange
    const config: CollectionConfig = { version: 1, collections: [] };

    // Act
    const result = getAvailableItems(config, 'nonexistent');

    // Assert
    expect(result).toEqual([]);
  });

  it('should return all item IDs from collection', () => {
    // Arrange
    const config: CollectionConfig = {
      version: 1,
      collections: [
        {
          id: 'smoke',
          name: 'Smoke',
          items: [
            { id: 'health', name: 'Health', request: { method: 'GET', path: '/health' } },
            { id: 'status', name: 'Status', request: { method: 'GET', path: '/status' } },
          ],
        },
      ],
    };

    // Act
    const result = getAvailableItems(config, 'smoke');

    // Assert
    expect(result).toEqual(['health', 'status']);
  });
});
