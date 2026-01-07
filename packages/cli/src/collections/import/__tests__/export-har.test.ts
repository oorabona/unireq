import { describe, expect, it } from 'vitest';
import type { Collection, CollectionItem } from '../../types.js';
import { expandVariables, exportCollectionToHar, exportToHar } from '../export-har.js';
import type { HarArchive } from '../types.js';

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

describe('exportToHar', () => {
  describe('basic export', () => {
    it('should export empty collections array', () => {
      // Act
      const result = exportToHar([]);

      // Assert
      expect(result.format).toBe('har');
      expect(result.warnings).toContain('No collections to export');
      expect(result.stats.totalItems).toBe(0);
    });

    it('should export single collection', () => {
      // Arrange
      const collection = createCollection('Test API', [createItem('get-users')]);

      // Act
      const result = exportToHar([collection]);
      const data = result.data as HarArchive;

      // Assert
      expect(result.format).toBe('har');
      expect(data.log.entries).toHaveLength(1);
      expect(result.stats.totalItems).toBe(1);
      expect(result.stats.exportedItems).toBe(1);
    });

    it('should include HAR version 1.2', () => {
      // Arrange
      const collection = createCollection('Test', []);

      // Act
      const result = exportToHar([collection]);
      const data = result.data as HarArchive;

      // Assert
      expect(data.log.version).toBe('1.2');
    });

    it('should include default creator metadata', () => {
      // Arrange
      const collection = createCollection('Test', [createItem('item-1')]);

      // Act
      const result = exportToHar([collection]);
      const data = result.data as HarArchive;

      // Assert
      expect(data.log.creator.name).toBe('unireq');
      expect(data.log.creator.version).toBe('1.0.0');
    });

    it('should use custom creator metadata', () => {
      // Arrange
      const collection = createCollection('Test', [createItem('item-1')]);

      // Act
      const result = exportToHar([collection], {
        creatorName: 'my-tool',
        creatorVersion: '2.0.0',
      });
      const data = result.data as HarArchive;

      // Assert
      expect(data.log.creator.name).toBe('my-tool');
      expect(data.log.creator.version).toBe('2.0.0');
    });
  });

  describe('request conversion', () => {
    it('should convert GET request', () => {
      // Arrange
      const collection = createCollection('Test', [createItem('get-users', { method: 'GET', path: '/api/users' })]);

      // Act
      const result = exportToHar([collection]);
      const data = result.data as HarArchive;

      // Assert
      const entry = data.log.entries[0]!;
      expect(entry.request.method).toBe('GET');
      expect(entry.request.url).toContain('/api/users');
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
      const result = exportToHar([collection]);
      const data = result.data as HarArchive;

      // Assert
      const entry = data.log.entries[0]!;
      expect(entry.request.method).toBe('POST');
      expect(entry.request.postData?.text).toBe('{"name":"Alice"}');
      expect(entry.request.postData?.mimeType).toBe('application/json');
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
      const result = exportToHar([collection]);
      const data = result.data as HarArchive;

      // Assert
      const headers = data.log.entries[0]!.request.headers;
      expect(headers).toHaveLength(2);
      expect(headers[0]!.name).toBe('Authorization');
      expect(headers[0]!.value).toBe('Bearer token123');
      expect(headers[1]!.name).toBe('X-Custom');
      expect(headers[1]!.value).toBe('value');
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
      const result = exportToHar([collection]);
      const data = result.data as HarArchive;

      // Assert
      const entry = data.log.entries[0]!;
      expect(entry.request.queryString).toHaveLength(2);
      expect(entry.request.queryString[0]!.name).toBe('q');
      expect(entry.request.queryString[0]!.value).toBe('test');
      expect(entry.request.queryString[1]!.name).toBe('limit');
      expect(entry.request.queryString[1]!.value).toBe('10');
      expect(entry.request.url).toContain('?q=test&limit=10');
    });

    it('should include item name as comment', () => {
      // Arrange
      const collection = createCollection('Test', [createItem('my-request', { method: 'GET', path: '/api/data' })]);

      // Act
      const result = exportToHar([collection]);
      const data = result.data as HarArchive;

      // Assert
      expect(data.log.entries[0]!.comment).toBe('my-request');
    });
  });

  describe('variable conversion', () => {
    it('should convert ${var} to :var placeholder in path', () => {
      // Arrange
      const collection = createCollection('Test', [
        createItem('get-user', { method: 'GET', path: '/users/${userId}' }),
      ]);

      // Act
      const result = exportToHar([collection]);
      const data = result.data as HarArchive;

      // Assert
      expect(data.log.entries[0]!.request.url).toContain('/users/:userId');
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
      const result = exportToHar([collection]);
      const data = result.data as HarArchive;

      // Assert
      expect(data.log.entries[0]!.request.headers[0]!.value).toBe('Bearer :token');
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
      const result = exportToHar([collection]);
      const data = result.data as HarArchive;

      // Assert
      expect(data.log.entries[0]!.request.postData?.text).toBe('{"userId":":userId"}');
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
      const result = exportToHar([collection]);
      const data = result.data as HarArchive;

      // Assert
      expect(data.log.entries[0]!.request.queryString[0]!.value).toBe(':apiToken');
    });
  });

  describe('response handling', () => {
    it('should include mock response by default', () => {
      // Arrange
      const collection = createCollection('Test', [createItem('get-users')]);

      // Act
      const result = exportToHar([collection]);
      const data = result.data as HarArchive;

      // Assert
      const response = data.log.entries[0]!.response;
      expect(response.status).toBe(200);
      expect(response.statusText).toBe('OK');
    });

    it('should include minimal response when includeResponse is false', () => {
      // Arrange
      const collection = createCollection('Test', [createItem('get-users')]);

      // Act
      const result = exportToHar([collection], { includeResponse: false });
      const data = result.data as HarArchive;

      // Assert
      const response = data.log.entries[0]!.response;
      expect(response.status).toBe(0);
      expect(response.statusText).toBe('');
    });
  });

  describe('multiple collections', () => {
    it('should merge items from multiple collections', () => {
      // Arrange
      const collections = [
        createCollection('Users API', [createItem('get-users')]),
        createCollection('Posts API', [createItem('get-posts')]),
      ];

      // Act
      const result = exportToHar(collections);
      const data = result.data as HarArchive;

      // Assert
      expect(data.log.entries).toHaveLength(2);
    });

    it('should count items across all collections', () => {
      // Arrange
      const collections = [
        createCollection('A', [createItem('a1'), createItem('a2')]),
        createCollection('B', [createItem('b1')]),
      ];

      // Act
      const result = exportToHar(collections);

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
      const result = exportToHar([collection], { baseUrl: 'https://api.example.com' });
      const data = result.data as HarArchive;

      // Assert
      expect(data.log.entries[0]!.request.url).toBe('https://api.example.com/users');
    });

    it('should use default baseUrl', () => {
      // Arrange
      const collection = createCollection('Test', [createItem('get-users', { path: '/users' })]);

      // Act
      const result = exportToHar([collection]);
      const data = result.data as HarArchive;

      // Assert
      expect(data.log.entries[0]!.request.url).toBe('http://localhost/users');
    });

    it('should handle baseUrl with trailing slash', () => {
      // Arrange
      const collection = createCollection('Test', [createItem('get-users', { path: '/users' })]);

      // Act
      const result = exportToHar([collection], { baseUrl: 'https://api.example.com/' });
      const data = result.data as HarArchive;

      // Assert
      expect(data.log.entries[0]!.request.url).toBe('https://api.example.com/users');
    });

    it('should handle path without leading slash', () => {
      // Arrange
      const collection = createCollection('Test', [createItem('get-users', { path: 'users' })]);

      // Act
      const result = exportToHar([collection], { baseUrl: 'https://api.example.com' });
      const data = result.data as HarArchive;

      // Assert
      expect(data.log.entries[0]!.request.url).toBe('https://api.example.com/users');
    });
  });

  describe('HAR structure compliance', () => {
    it('should include required timings object', () => {
      // Arrange
      const collection = createCollection('Test', [createItem('get-users')]);

      // Act
      const result = exportToHar([collection]);
      const data = result.data as HarArchive;

      // Assert
      const timings = data.log.entries[0]!.timings;
      expect(timings).toBeDefined();
      expect(timings.send).toBeDefined();
      expect(timings.wait).toBeDefined();
      expect(timings.receive).toBeDefined();
    });

    it('should include required cache object', () => {
      // Arrange
      const collection = createCollection('Test', [createItem('get-users')]);

      // Act
      const result = exportToHar([collection]);
      const data = result.data as HarArchive;

      // Assert
      expect(data.log.entries[0]!.cache).toBeDefined();
    });

    it('should include startedDateTime', () => {
      // Arrange
      const collection = createCollection('Test', [createItem('get-users')]);

      // Act
      const result = exportToHar([collection]);
      const data = result.data as HarArchive;

      // Assert
      expect(data.log.entries[0]!.startedDateTime).toBeDefined();
      expect(new Date(data.log.entries[0]!.startedDateTime).toISOString()).toBeTruthy();
    });

    it('should include httpVersion in request', () => {
      // Arrange
      const collection = createCollection('Test', [createItem('get-users')]);

      // Act
      const result = exportToHar([collection]);
      const data = result.data as HarArchive;

      // Assert
      expect(data.log.entries[0]!.request.httpVersion).toBe('HTTP/1.1');
    });
  });
});

describe('expandVariables', () => {
  it('should convert ${var} to :var', () => {
    const { result, hasVariables } = expandVariables('${foo}');
    expect(result).toBe(':foo');
    expect(hasVariables).toBe(true);
  });

  it('should convert multiple variables', () => {
    const { result, hasVariables } = expandVariables('/users/${userId}/posts/${postId}');
    expect(result).toBe('/users/:userId/posts/:postId');
    expect(hasVariables).toBe(true);
  });

  it('should handle variables with underscores', () => {
    const { result, hasVariables } = expandVariables('${my_var}');
    expect(result).toBe(':my_var');
    expect(hasVariables).toBe(true);
  });

  it('should leave text without variables unchanged', () => {
    const { result, hasVariables } = expandVariables('/users/123');
    expect(result).toBe('/users/123');
    expect(hasVariables).toBe(false);
  });
});

describe('exportCollectionToHar', () => {
  it('should export single collection', () => {
    // Arrange
    const collection = createCollection('Test', [createItem('item-1')]);

    // Act
    const result = exportCollectionToHar(collection);

    // Assert
    expect(result.format).toBe('har');
    expect(result.stats.exportedItems).toBe(1);
  });
});
