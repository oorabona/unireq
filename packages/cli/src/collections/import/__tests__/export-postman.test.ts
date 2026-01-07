import { describe, expect, it } from 'vitest';
import type { Collection, CollectionItem } from '../../types.js';
import { convertVariableSyntax, exportCollectionToPostman, exportToPostman } from '../export-postman.js';
import type { PostmanCollection, PostmanRequest, PostmanUrl } from '../types.js';

/**
 * Create a minimal collection item for testing
 */
function createItem(id: string, request?: Partial<CollectionItem['request']>): CollectionItem {
  return {
    id,
    name: id,
    request: {
      method: request?.method || 'GET',
      path: request?.path || `/${id}`,
      headers: request?.headers,
      body: request?.body,
      query: request?.query,
    },
  };
}

/**
 * Create a minimal collection for testing
 */
function createCollection(name: string, items: CollectionItem[]): Collection {
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    items,
  };
}

describe('exportToPostman', () => {
  describe('basic export', () => {
    it('should export empty collections array', () => {
      // Act
      const result = exportToPostman([]);

      // Assert
      expect(result.format).toBe('postman');
      expect(result.warnings).toContain('No collections to export');
      expect(result.stats.totalItems).toBe(0);
    });

    it('should export single collection', () => {
      // Arrange
      const collection = createCollection('Test API', [createItem('get-users')]);

      // Act
      const result = exportToPostman([collection]);
      const data = result.data as PostmanCollection;

      // Assert
      expect(result.format).toBe('postman');
      expect(data.info.name).toBe('Test API');
      expect(data.item).toHaveLength(1);
      expect(result.stats.totalItems).toBe(1);
      expect(result.stats.exportedItems).toBe(1);
    });

    it('should include Postman schema URL', () => {
      // Arrange
      const collection = createCollection('Test', []);

      // Act
      const result = exportToPostman([collection]);
      const data = result.data as PostmanCollection;

      // Assert
      expect(data.info.schema).toBe('https://schema.getpostman.com/json/collection/v2.1.0/collection.json');
    });
  });

  describe('request conversion', () => {
    it('should convert GET request', () => {
      // Arrange
      const collection = createCollection('Test', [createItem('get-users', { method: 'GET', path: '/api/users' })]);

      // Act
      const result = exportToPostman([collection]);
      const data = result.data as PostmanCollection;

      // Assert
      const item = data.item[0]!;
      const req = item.request as PostmanRequest;
      expect(req?.method).toBe('GET');
      expect((req?.url as PostmanUrl)?.raw).toContain('/api/users');
    });

    it('should convert POST request with body', () => {
      // Arrange
      const collection = createCollection('Test', [
        createItem('create-user', {
          method: 'POST',
          path: '/api/users',
          body: '{"name":"Alice"}',
          headers: ['Content-Type: application/json'],
        }),
      ]);

      // Act
      const result = exportToPostman([collection]);
      const data = result.data as PostmanCollection;

      // Assert
      const item = data.item[0]!;
      const req = item.request as PostmanRequest;
      expect(req?.method).toBe('POST');
      expect(req?.body?.mode).toBe('raw');
      expect(req?.body?.raw).toBe('{"name":"Alice"}');
      expect(req?.body?.options?.raw?.language).toBe('json');
    });

    it('should convert headers', () => {
      // Arrange
      const collection = createCollection('Test', [
        createItem('with-headers', {
          method: 'GET',
          path: '/api/data',
          headers: ['Authorization: Bearer token123', 'X-Custom: value'],
        }),
      ]);

      // Act
      const result = exportToPostman([collection]);
      const data = result.data as PostmanCollection;

      // Assert
      const req = data.item[0]!.request as PostmanRequest;
      const headers = req?.header;
      expect(headers).toHaveLength(2);
      expect(headers?.[0]!.key).toBe('Authorization');
      expect(headers?.[0]!.value).toBe('Bearer token123');
      expect(headers?.[1]!.key).toBe('X-Custom');
      expect(headers?.[1]!.value).toBe('value');
    });

    it('should convert query parameters', () => {
      // Arrange
      const collection = createCollection('Test', [
        createItem('with-query', {
          method: 'GET',
          path: '/api/search',
          query: ['q=test', 'limit=10'],
        }),
      ]);

      // Act
      const result = exportToPostman([collection]);
      const data = result.data as PostmanCollection;

      // Assert
      const req = data.item[0]!.request as PostmanRequest;
      const url = req?.url as PostmanUrl;
      expect(url?.query).toHaveLength(2);
      expect(url?.query?.[0]!.key).toBe('q');
      expect(url?.query?.[0]!.value).toBe('test');
      expect(url?.query?.[1]!.key).toBe('limit');
      expect(url?.query?.[1]!.value).toBe('10');
      expect(url?.raw).toContain('?q=test&limit=10');
    });
  });

  describe('variable conversion', () => {
    it('should convert ${var} to {{var}} in path', () => {
      // Arrange
      const collection = createCollection('Test', [
        createItem('get-user', { method: 'GET', path: '/users/${userId}' }),
      ]);

      // Act
      const result = exportToPostman([collection]);
      const data = result.data as PostmanCollection;

      // Assert
      expect(((data.item[0]!.request as PostmanRequest)?.url as PostmanUrl)?.raw).toContain('/users/{{userId}}');
      expect(result.warnings.some((w) => w.includes('Variables converted'))).toBe(true);
    });

    it('should convert variables in headers', () => {
      // Arrange
      const collection = createCollection('Test', [
        createItem('with-var-header', {
          method: 'GET',
          path: '/api/data',
          headers: ['Authorization: Bearer ${token}'],
        }),
      ]);

      // Act
      const result = exportToPostman([collection]);
      const data = result.data as PostmanCollection;

      // Assert
      expect((data.item[0]!.request as PostmanRequest)?.header?.[0]!.value).toBe('Bearer {{token}}');
    });

    it('should convert variables in body', () => {
      // Arrange
      const collection = createCollection('Test', [
        createItem('with-var-body', {
          method: 'POST',
          path: '/api/data',
          body: '{"userId":"${userId}"}',
        }),
      ]);

      // Act
      const result = exportToPostman([collection]);
      const data = result.data as PostmanCollection;

      // Assert
      expect((data.item[0]!.request as PostmanRequest)?.body?.raw).toBe('{"userId":"{{userId}}"}');
    });

    it('should convert variables in query params', () => {
      // Arrange
      const collection = createCollection('Test', [
        createItem('with-var-query', {
          method: 'GET',
          path: '/api/search',
          query: ['token=${apiToken}'],
        }),
      ]);

      // Act
      const result = exportToPostman([collection]);
      const data = result.data as PostmanCollection;

      // Assert
      expect(((data.item[0]!.request as PostmanRequest)?.url as PostmanUrl)?.query?.[0]!.value).toBe('{{apiToken}}');
    });
  });

  describe('body type detection', () => {
    it('should detect JSON body by content type', () => {
      // Arrange
      const collection = createCollection('Test', [
        createItem('json-body', {
          method: 'POST',
          path: '/api/data',
          body: '{"key":"value"}',
          headers: ['Content-Type: application/json'],
        }),
      ]);

      // Act
      const result = exportToPostman([collection]);
      const data = result.data as PostmanCollection;

      // Assert
      expect((data.item[0]!.request as PostmanRequest)?.body?.mode).toBe('raw');
      expect((data.item[0]!.request as PostmanRequest)?.body?.options?.raw?.language).toBe('json');
    });

    it('should detect JSON body by content structure', () => {
      // Arrange
      const collection = createCollection('Test', [
        createItem('json-body', {
          method: 'POST',
          path: '/api/data',
          body: '{"key":"value"}',
        }),
      ]);

      // Act
      const result = exportToPostman([collection]);
      const data = result.data as PostmanCollection;

      // Assert
      expect((data.item[0]!.request as PostmanRequest)?.body?.options?.raw?.language).toBe('json');
    });

    it('should detect URL encoded body', () => {
      // Arrange
      const collection = createCollection('Test', [
        createItem('form-body', {
          method: 'POST',
          path: '/api/login',
          body: 'username=alice&password=secret',
          headers: ['Content-Type: application/x-www-form-urlencoded'],
        }),
      ]);

      // Act
      const result = exportToPostman([collection]);
      const data = result.data as PostmanCollection;

      // Assert
      const req = data.item[0]!.request as PostmanRequest;
      expect(req?.body?.mode).toBe('urlencoded');
      expect(req?.body?.urlencoded).toHaveLength(2);
      expect(req?.body?.urlencoded?.[0]!.key).toBe('username');
      expect(req?.body?.urlencoded?.[0]!.value).toBe('alice');
    });
  });

  describe('multiple collections', () => {
    it('should create folders for multiple collections', () => {
      // Arrange
      const collections = [
        createCollection('Users API', [createItem('get-users')]),
        createCollection('Posts API', [createItem('get-posts')]),
      ];

      // Act
      const result = exportToPostman(collections);
      const data = result.data as PostmanCollection;

      // Assert
      expect(data.info.name).toBe('Users API');
      expect(data.item).toHaveLength(2);
      expect(data.item[0]!.name).toBe('Users API');
      expect(data.item[0]!.item).toHaveLength(1);
      expect(data.item[1]!.name).toBe('Posts API');
      expect(data.item[1]!.item).toHaveLength(1);
    });

    it('should count items across all collections', () => {
      // Arrange
      const collections = [
        createCollection('A', [createItem('a1'), createItem('a2')]),
        createCollection('B', [createItem('b1')]),
      ];

      // Act
      const result = exportToPostman(collections);

      // Assert
      expect(result.stats.totalItems).toBe(3);
      expect(result.stats.exportedItems).toBe(3);
    });
  });

  describe('options', () => {
    it('should use custom baseUrl', () => {
      // Arrange
      const collection = createCollection('Test', [createItem('get-users', { path: '/users' })]);

      // Act
      const result = exportToPostman([collection], { baseUrl: 'https://api.example.com' });
      const data = result.data as PostmanCollection;

      // Assert
      expect(((data.item[0]!.request as PostmanRequest)?.url as PostmanUrl)?.raw).toBe('https://api.example.com/users');
    });

    it('should use default baseUrl variable', () => {
      // Arrange
      const collection = createCollection('Test', [createItem('get-users', { path: '/users' })]);

      // Act
      const result = exportToPostman([collection]);
      const data = result.data as PostmanCollection;

      // Assert
      expect(((data.item[0]!.request as PostmanRequest)?.url as PostmanUrl)?.raw).toContain('{{baseUrl}}/users');
    });
  });
});

describe('convertVariableSyntax', () => {
  it('should convert ${var} to {{var}}', () => {
    expect(convertVariableSyntax('${foo}')).toBe('{{foo}}');
  });

  it('should convert multiple variables', () => {
    expect(convertVariableSyntax('/users/${userId}/posts/${postId}')).toBe('/users/{{userId}}/posts/{{postId}}');
  });

  it('should handle variables with underscores', () => {
    expect(convertVariableSyntax('${my_var}')).toBe('{{my_var}}');
  });

  it('should leave text without variables unchanged', () => {
    expect(convertVariableSyntax('/users/123')).toBe('/users/123');
  });
});

describe('exportCollectionToPostman', () => {
  it('should export single collection', () => {
    // Arrange
    const collection = createCollection('Test', [createItem('item-1')]);

    // Act
    const result = exportCollectionToPostman(collection);

    // Assert
    expect(result.format).toBe('postman');
    expect(result.stats.exportedItems).toBe(1);
  });
});
