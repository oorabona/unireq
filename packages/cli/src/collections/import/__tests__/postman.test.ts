/**
 * Tests for Postman v2.1 importer
 */

import { describe, expect, it } from 'vitest';
import { convertVariableSyntax, importPostmanCollection, slugify } from '../postman.js';
import type { PostmanCollection } from '../types.js';

describe('importPostmanCollection', () => {
  describe('basic collection import', () => {
    it('should import a simple collection with one request', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'My API',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Get Users',
            request: {
              method: 'GET',
              url: {
                raw: 'https://api.example.com/users',
                path: ['users'],
              },
            },
          },
        ],
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      expect(result.format).toBe('postman');
      expect(result.version).toBe('2.1.0');
      expect(result.collections).toHaveLength(1);
      expect(result.collections[0]?.id).toBe('my-api');
      expect(result.collections[0]?.name).toBe('My API');
      expect(result.collections[0]?.items).toHaveLength(1);
      expect(result.collections[0]?.items[0]?.id).toBe('get-users');
      expect(result.collections[0]?.items[0]?.request.method).toBe('GET');
      expect(result.collections[0]?.items[0]?.request.path).toBe('/users');
    });

    it('should import collection with description', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'API',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          description: 'My API collection',
        },
        item: [],
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      expect(result.collections[0]?.description).toBe('My API collection');
    });

    it('should handle empty item array', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'Empty',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [],
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      expect(result.collections[0]?.items).toHaveLength(0);
      expect(result.stats.totalItems).toBe(0);
    });
  });

  describe('URL handling', () => {
    it('should extract path from URL object', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Request',
            request: {
              method: 'GET',
              url: {
                raw: 'https://api.example.com/users/123',
                path: ['users', '123'],
              },
            },
          },
        ],
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      expect(result.collections[0]?.items[0]?.request.path).toBe('/users/123');
    });

    it('should extract query parameters', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Request',
            request: {
              method: 'GET',
              url: {
                raw: 'https://api.example.com/users?page=1&limit=10',
                path: ['users'],
                query: [
                  { key: 'page', value: '1' },
                  { key: 'limit', value: '10' },
                ],
              },
            },
          },
        ],
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      expect(result.collections[0]?.items[0]?.request.query).toEqual(['page=1', 'limit=10']);
    });

    it('should skip disabled query parameters', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Request',
            request: {
              method: 'GET',
              url: {
                raw: 'https://api.example.com/users',
                path: ['users'],
                query: [
                  { key: 'active', value: 'true' },
                  { key: 'disabled', value: 'ignored', disabled: true },
                ],
              },
            },
          },
        ],
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      expect(result.collections[0]?.items[0]?.request.query).toEqual(['active=true']);
    });

    it('should handle string URL (raw request)', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Raw Request',
            request: 'https://api.example.com/endpoint',
          },
        ],
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      expect(result.collections[0]?.items[0]?.request.method).toBe('GET');
      expect(result.collections[0]?.items[0]?.request.path).toBe('/endpoint');
    });

    it('should handle URL with variable', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Request',
            request: {
              method: 'GET',
              url: {
                raw: '{{baseUrl}}/users',
              },
            },
          },
        ],
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      expect(result.collections[0]?.items[0]?.request.path).toBe('/users');
    });
  });

  describe('headers handling', () => {
    it('should convert headers to unireq format', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Request',
            request: {
              method: 'GET',
              url: { path: ['test'] },
              header: [
                { key: 'Content-Type', value: 'application/json' },
                { key: 'Accept', value: 'application/json' },
              ],
            },
          },
        ],
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      expect(result.collections[0]?.items[0]?.request.headers).toEqual([
        'Content-Type: application/json',
        'Accept: application/json',
      ]);
    });

    it('should skip disabled headers', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Request',
            request: {
              method: 'GET',
              url: { path: ['test'] },
              header: [
                { key: 'Active', value: 'yes' },
                { key: 'Inactive', value: 'no', disabled: true },
              ],
            },
          },
        ],
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      expect(result.collections[0]?.items[0]?.request.headers).toEqual(['Active: yes']);
    });
  });

  describe('body handling', () => {
    it('should convert raw body', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Request',
            request: {
              method: 'POST',
              url: { path: ['users'] },
              body: {
                mode: 'raw',
                raw: '{"name": "John"}',
              },
            },
          },
        ],
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      expect(result.collections[0]?.items[0]?.request.body).toBe('{"name": "John"}');
    });

    it('should convert urlencoded body', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Request',
            request: {
              method: 'POST',
              url: { path: ['login'] },
              body: {
                mode: 'urlencoded',
                urlencoded: [
                  { key: 'username', value: 'john' },
                  { key: 'password', value: 'secret' },
                ],
              },
            },
          },
        ],
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      expect(result.collections[0]?.items[0]?.request.body).toBe('username=john&password=secret');
    });

    it('should skip disabled urlencoded params', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Request',
            request: {
              method: 'POST',
              url: { path: ['form'] },
              body: {
                mode: 'urlencoded',
                urlencoded: [
                  { key: 'active', value: 'yes' },
                  { key: 'inactive', value: 'no', disabled: true },
                ],
              },
            },
          },
        ],
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      expect(result.collections[0]?.items[0]?.request.body).toBe('active=yes');
    });

    it('should convert formdata to JSON', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Request',
            request: {
              method: 'POST',
              url: { path: ['upload'] },
              body: {
                mode: 'formdata',
                formdata: [
                  { key: 'name', value: 'John', type: 'text' },
                  { key: 'age', value: '30', type: 'text' },
                ],
              },
            },
          },
        ],
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      const body = result.collections[0]?.items[0]?.request.body;
      expect(body).toBeDefined();
      expect(JSON.parse(body as string)).toEqual({
        name: 'John',
        age: '30',
      });
    });

    it('should convert GraphQL body', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Request',
            request: {
              method: 'POST',
              url: { path: ['graphql'] },
              body: {
                mode: 'graphql',
                graphql: {
                  query: 'query { users { id name } }',
                  variables: '{"limit": 10}',
                },
              },
            },
          },
        ],
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      const bodyStr = result.collections[0]?.items[0]?.request.body;
      expect(bodyStr).toBeDefined();
      const body = JSON.parse(bodyStr as string);
      expect(body.query).toBe('query { users { id name } }');
      expect(body.variables).toBe('{"limit": 10}');
    });
  });

  describe('folder handling', () => {
    it('should flatten nested folders', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Users',
            item: [
              {
                name: 'Get User',
                request: {
                  method: 'GET',
                  url: { path: ['users', ':id'] },
                },
              },
              {
                name: 'Create User',
                request: {
                  method: 'POST',
                  url: { path: ['users'] },
                },
              },
            ],
          },
        ],
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      expect(result.collections[0]?.items).toHaveLength(2);
      expect(result.collections[0]?.items[0]?.id).toBe('users-get-user');
      expect(result.collections[0]?.items[1]?.id).toBe('users-create-user');
    });

    it('should add folder name as tag', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'Test',
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
                  url: { path: ['login'] },
                },
              },
            ],
          },
        ],
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      expect(result.collections[0]?.items[0]?.tags).toEqual(['Auth']);
    });

    it('should handle deeply nested folders', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'API',
            item: [
              {
                name: 'V1',
                item: [
                  {
                    name: 'Users',
                    item: [
                      {
                        name: 'List',
                        request: {
                          method: 'GET',
                          url: { path: ['api', 'v1', 'users'] },
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      expect(result.collections[0]?.items[0]?.id).toBe('api-v1-users-list');
      expect(result.items[0]?.sourcePath).toBe('API/V1/Users');
    });
  });

  describe('variable syntax conversion', () => {
    it('should convert variables in URL path', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Request',
            request: {
              method: 'GET',
              url: {
                raw: '{{baseUrl}}/users/{{userId}}',
                path: ['users', '{{userId}}'],
              },
            },
          },
        ],
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      expect(result.collections[0]?.items[0]?.request.path).toBe('/users/${userId}');
    });

    it('should convert variables in headers', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Request',
            request: {
              method: 'GET',
              url: { path: ['test'] },
              header: [{ key: 'Authorization', value: 'Bearer {{token}}' }],
            },
          },
        ],
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      expect(result.collections[0]?.items[0]?.request.headers).toEqual(['Authorization: Bearer ${token}']);
    });

    it('should convert variables in body', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Request',
            request: {
              method: 'POST',
              url: { path: ['users'] },
              body: {
                mode: 'raw',
                raw: '{"userId": "{{userId}}", "name": "{{name}}"}',
              },
            },
          },
        ],
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      expect(result.collections[0]?.items[0]?.request.body).toBe('{"userId": "${userId}", "name": "${name}"}');
    });

    it('should count and warn about variables', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Request',
            request: {
              method: 'GET',
              url: {
                raw: '{{baseUrl}}/{{path}}',
              },
              header: [{ key: 'Auth', value: '{{token}}' }],
            },
          },
        ],
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      expect(result.warnings).toContainEqual(expect.stringContaining('3 Postman variable(s)'));
    });
  });

  describe('warnings and ignored features', () => {
    it('should warn about collection-level auth', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [],
        auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}' }] },
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      expect(result.warnings).toContainEqual(expect.stringContaining('authentication was ignored'));
    });

    it('should warn about pre-request/test scripts', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [],
        event: [{ listen: 'prerequest', script: { exec: ['console.log("pre")'] } }],
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      expect(result.warnings).toContainEqual(expect.stringContaining('scripts were ignored'));
    });

    it('should warn about collection variables', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [],
        variable: [
          { key: 'baseUrl', value: 'https://api.example.com' },
          { key: 'token', value: 'abc123' },
        ],
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      expect(result.warnings).toContainEqual(expect.stringContaining('Collection variables (2) were ignored'));
    });
  });

  describe('import options', () => {
    it('should use idPrefix option', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          {
            name: 'Request',
            request: {
              method: 'GET',
              url: { path: ['test'] },
            },
          },
        ],
      };

      // Act
      const result = importPostmanCollection(data, { idPrefix: 'imported' });

      // Assert
      expect(result.collections[0]?.items[0]?.id).toBe('imported-request');
    });
  });

  describe('stats tracking', () => {
    it('should track import statistics', () => {
      // Arrange
      const data: PostmanCollection = {
        info: {
          name: 'Test',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: [
          { name: 'R1', request: { method: 'GET', url: { path: ['a'] } } },
          { name: 'R2', request: { method: 'POST', url: { path: ['b'] } } },
          { name: 'R3', request: { method: 'DELETE', url: { path: ['c'] } } },
        ],
      };

      // Act
      const result = importPostmanCollection(data);

      // Assert
      expect(result.stats.totalItems).toBe(3);
      expect(result.stats.convertedItems).toBe(3);
      expect(result.stats.skippedItems).toBe(0);
    });
  });
});

describe('convertVariableSyntax', () => {
  it('should convert single variable', () => {
    expect(convertVariableSyntax('{{baseUrl}}')).toBe('${baseUrl}');
  });

  it('should convert multiple variables', () => {
    expect(convertVariableSyntax('{{baseUrl}}/users/{{userId}}')).toBe('${baseUrl}/users/${userId}');
  });

  it('should leave non-variable text unchanged', () => {
    expect(convertVariableSyntax('/users/123')).toBe('/users/123');
  });

  it('should handle mixed content', () => {
    expect(convertVariableSyntax('Bearer {{token}}')).toBe('Bearer ${token}');
  });

  it('should handle empty string', () => {
    expect(convertVariableSyntax('')).toBe('');
  });
});

describe('slugify', () => {
  it('should lowercase and hyphenate', () => {
    expect(slugify('Get Users')).toBe('get-users');
  });

  it('should remove special characters', () => {
    expect(slugify('Get /users/:id')).toBe('get-usersid');
  });

  it('should collapse multiple spaces', () => {
    expect(slugify('Get  Multiple   Spaces')).toBe('get-multiple-spaces');
  });

  it('should trim leading/trailing hyphens', () => {
    expect(slugify('-trimmed-')).toBe('trimmed');
  });

  it('should handle underscores', () => {
    expect(slugify('snake_case_name')).toBe('snake-case-name');
  });

  it('should handle empty string', () => {
    expect(slugify('')).toBe('');
  });
});
