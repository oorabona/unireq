import { describe, expect, it } from 'vitest';
import { importHarArchive } from '../har.js';
import type { HarArchive, HarEntry } from '../types.js';

/**
 * Create a minimal valid HAR archive for testing
 */
function createHarArchive(entries: Partial<HarEntry>[] = []): HarArchive {
  return {
    log: {
      version: '1.2',
      creator: {
        name: 'Test',
        version: '1.0',
      },
      entries: entries.map((entry) => ({
        startedDateTime: entry.startedDateTime || '2024-01-01T00:00:00.000Z',
        time: entry.time ?? 100,
        request: {
          method: entry.request?.method || 'GET',
          url: entry.request?.url || 'http://api.example.com/',
          httpVersion: entry.request?.httpVersion || 'HTTP/1.1',
          cookies: entry.request?.cookies || [],
          headers: entry.request?.headers || [],
          queryString: entry.request?.queryString || [],
          postData: entry.request?.postData,
          headersSize: entry.request?.headersSize ?? -1,
          bodySize: entry.request?.bodySize ?? -1,
        },
        response: {
          status: entry.response?.status ?? 200,
          statusText: entry.response?.statusText || 'OK',
          httpVersion: entry.response?.httpVersion || 'HTTP/1.1',
          cookies: entry.response?.cookies || [],
          headers: entry.response?.headers || [],
          content: entry.response?.content || {
            size: 0,
            mimeType: 'application/json',
          },
          redirectURL: entry.response?.redirectURL || '',
          headersSize: entry.response?.headersSize ?? -1,
          bodySize: entry.response?.bodySize ?? -1,
        },
        cache: entry.cache || {},
        timings: entry.timings || {
          send: 0,
          wait: 50,
          receive: 50,
        },
        serverIPAddress: entry.serverIPAddress,
        connection: entry.connection,
      })),
    },
  };
}

describe('importHarArchive', () => {
  describe('basic import', () => {
    it('should import empty HAR archive', () => {
      // Arrange
      const har = createHarArchive([]);

      // Act
      const result = importHarArchive(har);

      // Assert
      expect(result.format).toBe('har');
      expect(result.version).toBe('1.2');
      expect(result.collections).toHaveLength(1);
      expect(result.collections[0]!.name).toBe('HAR Import');
      expect(result.items).toHaveLength(0);
      expect(result.stats.totalItems).toBe(0);
      expect(result.stats.convertedItems).toBe(0);
    });

    it('should import single GET request', () => {
      // Arrange
      const har = createHarArchive([
        {
          request: {
            method: 'GET',
            url: 'http://api.example.com/users',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
      ]);

      // Act
      const result = importHarArchive(har);

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.item.request.method).toBe('GET');
      expect(result.items[0]!.item.request.path).toBe('/users');
    });

    it('should import multiple requests', () => {
      // Arrange
      const har = createHarArchive([
        {
          request: {
            method: 'GET',
            url: 'http://api.example.com/users',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
        {
          request: {
            method: 'POST',
            url: 'http://api.example.com/users',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
        {
          request: {
            method: 'GET',
            url: 'http://api.example.com/posts',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
      ]);

      // Act
      const result = importHarArchive(har);

      // Assert
      expect(result.items).toHaveLength(3);
      expect(result.stats.totalItems).toBe(3);
      expect(result.stats.convertedItems).toBe(3);
    });

    it('should use custom collection name', () => {
      // Arrange
      const har = createHarArchive([]);

      // Act
      const result = importHarArchive(har, { collectionName: 'My API Capture' });

      // Assert
      expect(result.collections[0]!.name).toBe('My API Capture');
      expect(result.collections[0]!.id).toBe('my-api-capture');
    });
  });

  describe('URL handling', () => {
    it('should extract path from full URL', () => {
      // Arrange
      const har = createHarArchive([
        {
          request: {
            method: 'GET',
            url: 'https://api.example.com/v1/users/123/profile',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
      ]);

      // Act
      const result = importHarArchive(har);

      // Assert
      expect(result.items[0]!.item.request.path).toBe('/v1/users/123/profile');
    });

    it('should extract query parameters from URL', () => {
      // Arrange
      const har = createHarArchive([
        {
          request: {
            method: 'GET',
            url: 'http://api.example.com/search?q=test&limit=10',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [
              { name: 'q', value: 'test' },
              { name: 'limit', value: '10' },
            ],
            headersSize: -1,
            bodySize: -1,
          },
        },
      ]);

      // Act
      const result = importHarArchive(har);

      // Assert
      expect(result.items[0]!.item.request.path).toBe('/search');
      expect(result.items[0]!.item.request.query).toContain('q=test');
      expect(result.items[0]!.item.request.query).toContain('limit=10');
    });

    it('should strip baseUrl from path', () => {
      // Arrange
      const har = createHarArchive([
        {
          request: {
            method: 'GET',
            url: 'https://api.example.com/v1/users',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
      ]);

      // Act
      const result = importHarArchive(har, { baseUrl: 'https://api.example.com/v1' });

      // Assert
      expect(result.items[0]!.item.request.path).toBe('/users');
    });

    it('should handle root path', () => {
      // Arrange
      const har = createHarArchive([
        {
          request: {
            method: 'GET',
            url: 'http://api.example.com/',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
      ]);

      // Act
      const result = importHarArchive(har);

      // Assert
      expect(result.items[0]!.item.request.path).toBe('/');
      expect(result.items[0]!.item.name).toBe('GET root');
    });
  });

  describe('headers', () => {
    it('should convert custom headers', () => {
      // Arrange
      const har = createHarArchive([
        {
          request: {
            method: 'GET',
            url: 'http://api.example.com/users',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [
              { name: 'Authorization', value: 'Bearer token123' },
              { name: 'X-Custom-Header', value: 'custom-value' },
            ],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
      ]);

      // Act
      const result = importHarArchive(har);

      // Assert
      expect(result.items[0]!.item.request.headers).toContain('Authorization: Bearer token123');
      expect(result.items[0]!.item.request.headers).toContain('X-Custom-Header: custom-value');
    });

    it('should exclude browser-added headers', () => {
      // Arrange
      const har = createHarArchive([
        {
          request: {
            method: 'GET',
            url: 'http://api.example.com/users',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [
              { name: 'User-Agent', value: 'Mozilla/5.0' },
              { name: 'Accept-Encoding', value: 'gzip, deflate' },
              { name: 'Cookie', value: 'session=abc123' },
              { name: 'Referer', value: 'http://example.com/' },
              { name: 'X-API-Key', value: 'key123' },
            ],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
      ]);

      // Act
      const result = importHarArchive(har);

      // Assert
      expect(result.items[0]!.item.request.headers).toHaveLength(1);
      expect(result.items[0]!.item.request.headers).toContain('X-API-Key: key123');
    });
  });

  describe('body handling', () => {
    it('should convert text body', () => {
      // Arrange
      const har = createHarArchive([
        {
          request: {
            method: 'POST',
            url: 'http://api.example.com/users',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            postData: {
              mimeType: 'application/json',
              text: '{"name":"Alice","email":"alice@example.com"}',
              params: [],
            },
            headersSize: -1,
            bodySize: -1,
          },
        },
      ]);

      // Act
      const result = importHarArchive(har);

      // Assert
      expect(result.items[0]!.item.request.body).toBe('{"name":"Alice","email":"alice@example.com"}');
    });

    it('should convert form-urlencoded params', () => {
      // Arrange
      const har = createHarArchive([
        {
          request: {
            method: 'POST',
            url: 'http://api.example.com/login',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            postData: {
              mimeType: 'application/x-www-form-urlencoded',
              params: [
                { name: 'username', value: 'alice' },
                { name: 'password', value: 'secret123' },
              ],
            },
            headersSize: -1,
            bodySize: -1,
          },
        },
      ]);

      // Act
      const result = importHarArchive(har);

      // Assert
      expect(result.items[0]!.item.request.body).toBe('username=alice&password=secret123');
    });

    it('should convert multipart params to JSON', () => {
      // Arrange
      const har = createHarArchive([
        {
          request: {
            method: 'POST',
            url: 'http://api.example.com/upload',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            postData: {
              mimeType: 'multipart/form-data',
              params: [
                { name: 'title', value: 'My Document' },
                { name: 'description', value: 'A test file' },
              ],
            },
            headersSize: -1,
            bodySize: -1,
          },
        },
      ]);

      // Act
      const result = importHarArchive(har);

      // Assert
      const body = result.items[0]!.item.request.body as string;
      expect(JSON.parse(body)).toEqual({
        title: 'My Document',
        description: 'A test file',
      });
    });
  });

  describe('static asset filtering', () => {
    it('should skip static assets by default', () => {
      // Arrange
      const har = createHarArchive([
        {
          request: {
            method: 'GET',
            url: 'http://example.com/api/users',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
        {
          request: {
            method: 'GET',
            url: 'http://example.com/styles.css',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
        {
          request: {
            method: 'GET',
            url: 'http://example.com/script.js',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
        {
          request: {
            method: 'GET',
            url: 'http://example.com/logo.png',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
      ]);

      // Act
      const result = importHarArchive(har);

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.item.request.path).toBe('/api/users');
      expect(result.stats.skippedItems).toBe(3);
      expect(result.warnings.some((w) => w.includes('static asset'))).toBe(true);
    });

    it('should detect static assets by MIME type', () => {
      // Arrange
      const har = createHarArchive([
        {
          request: {
            method: 'GET',
            url: 'http://example.com/api/users',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
          response: {
            status: 200,
            statusText: 'OK',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            content: { size: 100, mimeType: 'application/json' },
            redirectURL: '',
            headersSize: -1,
            bodySize: -1,
          },
        },
        {
          request: {
            method: 'GET',
            url: 'http://example.com/data',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
          response: {
            status: 200,
            statusText: 'OK',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            content: { size: 100, mimeType: 'image/png' },
            redirectURL: '',
            headersSize: -1,
            bodySize: -1,
          },
        },
      ]);

      // Act
      const result = importHarArchive(har);

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.item.request.path).toBe('/api/users');
    });

    it('should include static assets when skipStatic is false', () => {
      // Arrange
      const har = createHarArchive([
        {
          request: {
            method: 'GET',
            url: 'http://example.com/api/users',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
        {
          request: {
            method: 'GET',
            url: 'http://example.com/styles.css',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
      ]);

      // Act
      const result = importHarArchive(har, { skipStatic: false });

      // Assert
      expect(result.items).toHaveLength(2);
    });
  });

  describe('domain filtering', () => {
    it('should filter by domain', () => {
      // Arrange
      const har = createHarArchive([
        {
          request: {
            method: 'GET',
            url: 'http://api.example.com/users',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
        {
          request: {
            method: 'GET',
            url: 'http://cdn.example.com/asset',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
        {
          request: {
            method: 'GET',
            url: 'http://other.com/resource',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
      ]);

      // Act
      const result = importHarArchive(har, { filterDomain: 'api.example.com' });

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.item.request.path).toBe('/users');
      expect(result.warnings.some((w) => w.includes('domain filter'))).toBe(true);
    });

    it('should match subdomains', () => {
      // Arrange
      const har = createHarArchive([
        {
          request: {
            method: 'GET',
            url: 'http://api.example.com/users',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
        {
          request: {
            method: 'GET',
            url: 'http://www.example.com/page',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
        {
          request: {
            method: 'GET',
            url: 'http://other.com/resource',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
      ]);

      // Act
      const result = importHarArchive(har, { filterDomain: 'example.com' });

      // Assert
      expect(result.items).toHaveLength(2);
    });
  });

  describe('ID generation', () => {
    it('should generate unique IDs for duplicate paths', () => {
      // Arrange
      const har = createHarArchive([
        {
          request: {
            method: 'GET',
            url: 'http://api.example.com/users',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
        {
          request: {
            method: 'GET',
            url: 'http://api.example.com/users',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
        {
          request: {
            method: 'GET',
            url: 'http://api.example.com/users',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
      ]);

      // Act
      const result = importHarArchive(har);

      // Assert
      const ids = result.items.map((i) => i.item.id);
      expect(ids[0]).toBe('get-users');
      expect(ids[1]).toBe('get-users-2');
      expect(ids[2]).toBe('get-users-3');
    });

    it('should use idPrefix option', () => {
      // Arrange
      const har = createHarArchive([
        {
          request: {
            method: 'GET',
            url: 'http://api.example.com/users',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
      ]);

      // Act
      const result = importHarArchive(har, { idPrefix: 'prod' });

      // Assert
      expect(result.items[0]!.item.id).toBe('prod-get-users');
    });
  });

  describe('metadata and warnings', () => {
    it('should include creator info in warnings', () => {
      // Arrange
      const har: HarArchive = {
        log: {
          version: '1.2',
          creator: {
            name: 'Chrome DevTools',
            version: '120.0.0',
          },
          entries: [],
        },
      };

      // Act
      const result = importHarArchive(har);

      // Assert
      expect(result.warnings.some((w) => w.includes('Chrome DevTools'))).toBe(true);
      expect(result.warnings.some((w) => w.includes('120.0.0'))).toBe(true);
    });

    it('should include collection description with entry count', () => {
      // Arrange
      const har = createHarArchive([
        {
          request: {
            method: 'GET',
            url: 'http://api.example.com/users',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
        {
          request: {
            method: 'POST',
            url: 'http://api.example.com/users',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
      ]);

      // Act
      const result = importHarArchive(har);

      // Assert
      expect(result.collections[0]!.description).toBe('Imported from HAR archive (2 entries)');
    });
  });

  describe('stats', () => {
    it('should track conversion statistics', () => {
      // Arrange
      const har = createHarArchive([
        {
          request: {
            method: 'GET',
            url: 'http://api.example.com/users',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
        {
          request: {
            method: 'GET',
            url: 'http://api.example.com/style.css',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
        {
          request: {
            method: 'GET',
            url: 'http://api.example.com/posts',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
        },
      ]);

      // Act
      const result = importHarArchive(har);

      // Assert
      expect(result.stats.totalItems).toBe(3);
      expect(result.stats.convertedItems).toBe(2);
      expect(result.stats.skippedItems).toBe(1);
    });
  });
});
