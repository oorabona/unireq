/**
 * Tests for import format schemas
 */

import { describe, expect, it } from 'vitest';
import { parseHarArchive, parseInsomniaExport, parsePostmanCollection } from '../schemas.js';

describe('parsePostmanCollection', () => {
  describe('when input is valid Postman v2.1 collection', () => {
    it('should parse minimal collection', () => {
      // Arrange
      const data = {
        info: {
          name: 'Test Collection',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [],
      };

      // Act
      const result = parsePostmanCollection(data);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.info.name).toBe('Test Collection');
        expect(result.output.item).toEqual([]);
      }
    });

    it('should parse collection with simple request', () => {
      // Arrange
      const data = {
        info: {
          name: 'API Tests',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Get Users',
            request: {
              method: 'GET',
              url: 'https://api.example.com/users',
            },
          },
        ],
      };

      // Act
      const result = parsePostmanCollection(data);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        const output = result.output as { item: Array<{ name: string }> };
        expect(output.item).toHaveLength(1);
        expect(output.item[0]?.name).toBe('Get Users');
      }
    });

    it('should parse collection with complex URL object', () => {
      // Arrange
      const data = {
        info: {
          name: 'API Tests',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Get User',
            request: {
              method: 'GET',
              url: {
                raw: 'https://api.example.com/users/{{userId}}?include=profile',
                protocol: 'https',
                host: ['api', 'example', 'com'],
                path: ['users', '{{userId}}'],
                query: [{ key: 'include', value: 'profile' }],
              },
            },
          },
        ],
      };

      // Act
      const result = parsePostmanCollection(data);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should parse collection with headers and body', () => {
      // Arrange
      const data = {
        info: {
          name: 'API Tests',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Create User',
            request: {
              method: 'POST',
              url: 'https://api.example.com/users',
              header: [
                { key: 'Content-Type', value: 'application/json' },
                { key: 'Authorization', value: 'Bearer {{token}}' },
              ],
              body: {
                mode: 'raw',
                raw: '{"name": "John"}',
                options: {
                  raw: {
                    language: 'json',
                  },
                },
              },
            },
          },
        ],
      };

      // Act
      const result = parsePostmanCollection(data);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should parse collection with nested folders', () => {
      // Arrange
      const data = {
        info: {
          name: 'API Tests',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Auth',
            item: [
              {
                name: 'Login',
                request: {
                  method: 'POST',
                  url: '/login',
                },
              },
              {
                name: 'Logout',
                request: {
                  method: 'POST',
                  url: '/logout',
                },
              },
            ],
          },
          {
            name: 'Users',
            item: [
              {
                name: 'List Users',
                request: {
                  method: 'GET',
                  url: '/users',
                },
              },
            ],
          },
        ],
      };

      // Act
      const result = parsePostmanCollection(data);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        const output = result.output as { item: Array<{ item: unknown[] }> };
        expect(output.item).toHaveLength(2);
        expect(output.item[0]?.item).toHaveLength(2);
      }
    });

    it('should parse collection with variables', () => {
      // Arrange
      const data = {
        info: {
          name: 'API Tests',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [],
        variable: [
          { key: 'baseUrl', value: 'https://api.example.com' },
          { key: 'apiKey', value: 'secret123', type: 'secret' },
        ],
      };

      // Act
      const result = parsePostmanCollection(data);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.variable).toHaveLength(2);
      }
    });
  });

  describe('when input is invalid', () => {
    it('should fail for missing info', () => {
      // Arrange
      const data = {
        item: [],
      };

      // Act
      const result = parsePostmanCollection(data);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should fail for missing item array', () => {
      // Arrange
      const data = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
      };

      // Act
      const result = parsePostmanCollection(data);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should fail for missing info.name', () => {
      // Arrange
      const data = {
        info: {
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [],
      };

      // Act
      const result = parsePostmanCollection(data);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});

describe('parseInsomniaExport', () => {
  describe('when input is valid Insomnia v4 export', () => {
    it('should parse minimal export', () => {
      // Arrange
      const data = {
        _type: 'export',
        __export_format: 4,
        resources: [],
      };

      // Act
      const result = parseInsomniaExport(data);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.__export_format).toBe(4);
        expect(result.output.resources).toEqual([]);
      }
    });

    it('should parse export with workspace and requests', () => {
      // Arrange
      const data = {
        _type: 'export',
        __export_format: 4,
        __export_date: '2026-01-07T10:00:00.000Z',
        __export_source: 'insomnia.desktop.app:v2023.5.8',
        resources: [
          {
            _id: 'wrk_abc123',
            _type: 'workspace',
            parentId: null,
            name: 'My API',
            scope: 'collection',
          },
          {
            _id: 'req_def456',
            _type: 'request',
            parentId: 'wrk_abc123',
            name: 'Get Users',
            method: 'GET',
            url: 'https://api.example.com/users',
            headers: [{ name: 'Accept', value: 'application/json' }],
            body: {},
          },
        ],
      };

      // Act
      const result = parseInsomniaExport(data);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.resources).toHaveLength(2);
      }
    });

    it('should parse export with request groups (folders)', () => {
      // Arrange
      const data = {
        _type: 'export',
        __export_format: 4,
        resources: [
          {
            _id: 'wrk_abc123',
            _type: 'workspace',
            parentId: null,
            name: 'API',
          },
          {
            _id: 'fld_grp1',
            _type: 'request_group',
            parentId: 'wrk_abc123',
            name: 'Auth',
          },
          {
            _id: 'req_login',
            _type: 'request',
            parentId: 'fld_grp1',
            name: 'Login',
          },
        ],
      };

      // Act
      const result = parseInsomniaExport(data);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should parse export with environment (to be skipped during import)', () => {
      // Arrange
      const data = {
        _type: 'export',
        __export_format: 4,
        resources: [
          {
            _id: 'env_base',
            _type: 'environment',
            parentId: null,
            name: 'Base Environment',
          },
        ],
      };

      // Act
      const result = parseInsomniaExport(data);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe('when input is invalid', () => {
    it('should fail for missing _type', () => {
      // Arrange
      const data = {
        __export_format: 4,
        resources: [],
      };

      // Act
      const result = parseInsomniaExport(data);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should fail for wrong export format', () => {
      // Arrange
      const data = {
        _type: 'export',
        __export_format: 3, // Must be 4
        resources: [],
      };

      // Act
      const result = parseInsomniaExport(data);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should fail for missing resources array', () => {
      // Arrange
      const data = {
        _type: 'export',
        __export_format: 4,
      };

      // Act
      const result = parseInsomniaExport(data);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});

describe('parseHarArchive', () => {
  describe('when input is valid HAR 1.2 archive', () => {
    it('should parse minimal archive', () => {
      // Arrange
      const data = {
        log: {
          version: '1.2',
          creator: {
            name: 'Test Tool',
            version: '1.0.0',
          },
          entries: [],
        },
      };

      // Act
      const result = parseHarArchive(data);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.log.version).toBe('1.2');
        expect(result.output.log.entries).toEqual([]);
      }
    });

    it('should parse archive with entries', () => {
      // Arrange
      const data = {
        log: {
          version: '1.2',
          creator: {
            name: 'Chrome DevTools',
            version: '120.0.0',
          },
          entries: [
            {
              startedDateTime: '2026-01-07T10:00:00.000Z',
              time: 150,
              request: {
                method: 'GET',
                url: 'https://api.example.com/users',
                httpVersion: 'HTTP/1.1',
                cookies: [],
                headers: [
                  { name: 'Accept', value: 'application/json' },
                  { name: 'Host', value: 'api.example.com' },
                ],
                queryString: [{ name: 'page', value: '1' }],
                headersSize: 120,
                bodySize: 0,
              },
              response: {
                status: 200,
                statusText: 'OK',
                httpVersion: 'HTTP/1.1',
                cookies: [],
                headers: [{ name: 'Content-Type', value: 'application/json' }],
                content: {
                  size: 1024,
                  mimeType: 'application/json',
                  text: '{"users":[]}',
                },
                redirectURL: '',
                headersSize: 80,
                bodySize: 1024,
              },
              cache: {},
              timings: {
                blocked: 10,
                dns: 5,
                connect: 20,
                send: 1,
                wait: 100,
                receive: 14,
              },
            },
          ],
        },
      };

      // Act
      const result = parseHarArchive(data);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.log.entries).toHaveLength(1);
        expect(result.output.log.entries[0]?.request.method).toBe('GET');
      }
    });

    it('should parse archive with POST data', () => {
      // Arrange
      const data = {
        log: {
          version: '1.2',
          creator: { name: 'Test', version: '1.0' },
          entries: [
            {
              startedDateTime: '2026-01-07T10:00:00.000Z',
              time: 200,
              request: {
                method: 'POST',
                url: 'https://api.example.com/users',
                httpVersion: 'HTTP/1.1',
                cookies: [],
                headers: [{ name: 'Content-Type', value: 'application/json' }],
                queryString: [],
                postData: {
                  mimeType: 'application/json',
                  text: '{"name":"John","email":"john@example.com"}',
                },
                headersSize: 100,
                bodySize: 42,
              },
              response: {
                status: 201,
                statusText: 'Created',
                httpVersion: 'HTTP/1.1',
                cookies: [],
                headers: [],
                content: {
                  size: 50,
                  mimeType: 'application/json',
                },
                redirectURL: '',
                headersSize: -1,
                bodySize: -1,
              },
              cache: {},
              timings: {
                send: 5,
                wait: 180,
                receive: 15,
              },
            },
          ],
        },
      };

      // Act
      const result = parseHarArchive(data);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.log.entries[0]?.request.postData?.text).toBe('{"name":"John","email":"john@example.com"}');
      }
    });

    it('should parse archive with pages', () => {
      // Arrange
      const data = {
        log: {
          version: '1.2',
          creator: { name: 'Test', version: '1.0' },
          pages: [
            {
              startedDateTime: '2026-01-07T10:00:00.000Z',
              id: 'page_1',
              title: 'API Test Page',
              pageTimings: {
                onContentLoad: 500,
                onLoad: 1000,
              },
            },
          ],
          entries: [
            {
              pageref: 'page_1',
              startedDateTime: '2026-01-07T10:00:00.000Z',
              time: 100,
              request: {
                method: 'GET',
                url: 'https://example.com',
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
                content: { size: 0, mimeType: 'text/html' },
                redirectURL: '',
                headersSize: -1,
                bodySize: -1,
              },
              cache: {},
              timings: { send: 1, wait: 90, receive: 9 },
            },
          ],
        },
      };

      // Act
      const result = parseHarArchive(data);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.log.pages).toHaveLength(1);
      }
    });
  });

  describe('when input is invalid', () => {
    it('should fail for missing log', () => {
      // Arrange
      const data = {};

      // Act
      const result = parseHarArchive(data);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should fail for missing log.version', () => {
      // Arrange
      const data = {
        log: {
          creator: { name: 'Test', version: '1.0' },
          entries: [],
        },
      };

      // Act
      const result = parseHarArchive(data);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should fail for missing log.creator', () => {
      // Arrange
      const data = {
        log: {
          version: '1.2',
          entries: [],
        },
      };

      // Act
      const result = parseHarArchive(data);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should fail for missing log.entries', () => {
      // Arrange
      const data = {
        log: {
          version: '1.2',
          creator: { name: 'Test', version: '1.0' },
        },
      };

      // Act
      const result = parseHarArchive(data);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should fail for invalid entry (missing required timings)', () => {
      // Arrange
      const data = {
        log: {
          version: '1.2',
          creator: { name: 'Test', version: '1.0' },
          entries: [
            {
              startedDateTime: '2026-01-07T10:00:00.000Z',
              time: 100,
              request: {
                method: 'GET',
                url: 'https://example.com',
                httpVersion: 'HTTP/1.1',
              },
              response: {
                status: 200,
                statusText: 'OK',
                httpVersion: 'HTTP/1.1',
                content: { size: 0, mimeType: 'text/html' },
              },
              cache: {},
              timings: {
                // Missing required: send, wait, receive
              },
            },
          ],
        },
      };

      // Act
      const result = parseHarArchive(data);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});
