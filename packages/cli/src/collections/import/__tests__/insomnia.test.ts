/**
 * Tests for Insomnia v4 importer
 */

import { describe, expect, it } from 'vitest';
import { convertVariableSyntax, importInsomniaExport } from '../insomnia.js';
import type { InsomniaExport } from '../types.js';

describe('importInsomniaExport', () => {
  describe('basic export import', () => {
    it('should import a simple export with one request', () => {
      // Arrange
      const data: InsomniaExport = {
        _type: 'export',
        __export_format: 4,
        resources: [
          {
            _id: 'wrk_1',
            _type: 'workspace',
            name: 'My API',
          },
          {
            _id: 'req_1',
            _type: 'request',
            parentId: 'wrk_1',
            name: 'Get Users',
            method: 'GET',
            url: 'https://api.example.com/users',
          },
        ],
      };

      // Act
      const result = importInsomniaExport(data);

      // Assert
      expect(result.format).toBe('insomnia');
      expect(result.version).toBe('4');
      expect(result.collections).toHaveLength(1);
      expect(result.collections[0]?.id).toBe('my-api');
      expect(result.collections[0]?.name).toBe('My API');
      expect(result.collections[0]?.items).toHaveLength(1);
      expect(result.collections[0]?.items[0]?.id).toBe('get-users');
      expect(result.collections[0]?.items[0]?.request.method).toBe('GET');
      expect(result.collections[0]?.items[0]?.request.path).toBe('/users');
    });

    it('should import export with workspace description', () => {
      // Arrange
      const data: InsomniaExport = {
        _type: 'export',
        __export_format: 4,
        resources: [
          {
            _id: 'wrk_1',
            _type: 'workspace',
            name: 'API',
            description: 'My API workspace',
          },
        ],
      };

      // Act
      const result = importInsomniaExport(data);

      // Assert
      expect(result.collections[0]?.description).toBe('My API workspace');
    });

    it('should create default workspace when none exists', () => {
      // Arrange
      const data: InsomniaExport = {
        _type: 'export',
        __export_format: 4,
        resources: [
          {
            _id: 'req_1',
            _type: 'request',
            name: 'Request',
            method: 'GET',
            url: '/test',
          },
        ],
      };

      // Act
      const result = importInsomniaExport(data);

      // Assert
      expect(result.collections).toHaveLength(1);
      expect(result.collections[0]?.name).toBe('Imported Requests');
    });

    it('should handle empty resources', () => {
      // Arrange
      const data: InsomniaExport = {
        _type: 'export',
        __export_format: 4,
        resources: [],
      };

      // Act
      const result = importInsomniaExport(data);

      // Assert
      expect(result.collections).toHaveLength(1);
      expect(result.collections[0]?.items).toHaveLength(0);
      expect(result.stats.totalItems).toBe(0);
    });
  });

  describe('URL handling', () => {
    it('should extract path from full URL', () => {
      // Arrange
      const data: InsomniaExport = {
        _type: 'export',
        __export_format: 4,
        resources: [
          {
            _id: 'wrk_1',
            _type: 'workspace',
            name: 'Test',
          },
          {
            _id: 'req_1',
            _type: 'request',
            parentId: 'wrk_1',
            name: 'Request',
            method: 'GET',
            url: 'https://api.example.com/users/123',
          },
        ],
      };

      // Act
      const result = importInsomniaExport(data);

      // Assert
      expect(result.collections[0]?.items[0]?.request.path).toBe('/users/123');
    });

    it('should extract query parameters from URL', () => {
      // Arrange
      const data: InsomniaExport = {
        _type: 'export',
        __export_format: 4,
        resources: [
          {
            _id: 'wrk_1',
            _type: 'workspace',
            name: 'Test',
          },
          {
            _id: 'req_1',
            _type: 'request',
            parentId: 'wrk_1',
            name: 'Request',
            method: 'GET',
            url: 'https://api.example.com/users?page=1&limit=10',
          },
        ],
      };

      // Act
      const result = importInsomniaExport(data);

      // Assert
      expect(result.collections[0]?.items[0]?.request.query).toEqual(['page=1', 'limit=10']);
    });

    it('should handle URL with variable', () => {
      // Arrange
      const data: InsomniaExport = {
        _type: 'export',
        __export_format: 4,
        resources: [
          {
            _id: 'wrk_1',
            _type: 'workspace',
            name: 'Test',
          },
          {
            _id: 'req_1',
            _type: 'request',
            parentId: 'wrk_1',
            name: 'Request',
            method: 'GET',
            url: '{{baseUrl}}/users',
          },
        ],
      };

      // Act
      const result = importInsomniaExport(data);

      // Assert
      expect(result.collections[0]?.items[0]?.request.path).toBe('/users');
    });

    it('should handle Insomnia template tag syntax', () => {
      // Arrange
      const data: InsomniaExport = {
        _type: 'export',
        __export_format: 4,
        resources: [
          {
            _id: 'wrk_1',
            _type: 'workspace',
            name: 'Test',
          },
          {
            _id: 'req_1',
            _type: 'request',
            parentId: 'wrk_1',
            name: 'Request',
            method: 'GET',
            url: '_.baseUrl/users',
          },
        ],
      };

      // Act
      const result = importInsomniaExport(data);

      // Assert
      expect(result.collections[0]?.items[0]?.request.path).toBe('/users');
    });
  });

  describe('headers handling', () => {
    it('should convert headers to unireq format', () => {
      // Arrange
      const data: InsomniaExport = {
        _type: 'export',
        __export_format: 4,
        resources: [
          {
            _id: 'wrk_1',
            _type: 'workspace',
            name: 'Test',
          },
          {
            _id: 'req_1',
            _type: 'request',
            parentId: 'wrk_1',
            name: 'Request',
            method: 'GET',
            url: '/test',
            headers: [
              { name: 'Content-Type', value: 'application/json' },
              { name: 'Accept', value: 'application/json' },
            ],
          },
        ],
      };

      // Act
      const result = importInsomniaExport(data);

      // Assert
      expect(result.collections[0]?.items[0]?.request.headers).toEqual([
        'Content-Type: application/json',
        'Accept: application/json',
      ]);
    });

    it('should skip disabled headers', () => {
      // Arrange
      const data: InsomniaExport = {
        _type: 'export',
        __export_format: 4,
        resources: [
          {
            _id: 'wrk_1',
            _type: 'workspace',
            name: 'Test',
          },
          {
            _id: 'req_1',
            _type: 'request',
            parentId: 'wrk_1',
            name: 'Request',
            method: 'GET',
            url: '/test',
            headers: [
              { name: 'Active', value: 'yes' },
              { name: 'Inactive', value: 'no', disabled: true },
            ],
          },
        ],
      };

      // Act
      const result = importInsomniaExport(data);

      // Assert
      expect(result.collections[0]?.items[0]?.request.headers).toEqual(['Active: yes']);
    });
  });

  describe('body handling', () => {
    it('should convert raw text body', () => {
      // Arrange
      const data: InsomniaExport = {
        _type: 'export',
        __export_format: 4,
        resources: [
          {
            _id: 'wrk_1',
            _type: 'workspace',
            name: 'Test',
          },
          {
            _id: 'req_1',
            _type: 'request',
            parentId: 'wrk_1',
            name: 'Request',
            method: 'POST',
            url: '/users',
            body: {
              mimeType: 'application/json',
              text: '{"name": "John"}',
            },
          },
        ],
      };

      // Act
      const result = importInsomniaExport(data);

      // Assert
      expect(result.collections[0]?.items[0]?.request.body).toBe('{"name": "John"}');
    });

    it('should convert urlencoded body', () => {
      // Arrange
      const data: InsomniaExport = {
        _type: 'export',
        __export_format: 4,
        resources: [
          {
            _id: 'wrk_1',
            _type: 'workspace',
            name: 'Test',
          },
          {
            _id: 'req_1',
            _type: 'request',
            parentId: 'wrk_1',
            name: 'Request',
            method: 'POST',
            url: '/login',
            body: {
              mimeType: 'application/x-www-form-urlencoded',
              params: [
                { name: 'username', value: 'john' },
                { name: 'password', value: 'secret' },
              ],
            },
          },
        ],
      };

      // Act
      const result = importInsomniaExport(data);

      // Assert
      expect(result.collections[0]?.items[0]?.request.body).toBe('username=john&password=secret');
    });

    it('should skip disabled form params', () => {
      // Arrange
      const data: InsomniaExport = {
        _type: 'export',
        __export_format: 4,
        resources: [
          {
            _id: 'wrk_1',
            _type: 'workspace',
            name: 'Test',
          },
          {
            _id: 'req_1',
            _type: 'request',
            parentId: 'wrk_1',
            name: 'Request',
            method: 'POST',
            url: '/form',
            body: {
              mimeType: 'application/x-www-form-urlencoded',
              params: [
                { name: 'active', value: 'yes' },
                { name: 'inactive', value: 'no', disabled: true },
              ],
            },
          },
        ],
      };

      // Act
      const result = importInsomniaExport(data);

      // Assert
      expect(result.collections[0]?.items[0]?.request.body).toBe('active=yes');
    });

    it('should convert multipart form to JSON', () => {
      // Arrange
      const data: InsomniaExport = {
        _type: 'export',
        __export_format: 4,
        resources: [
          {
            _id: 'wrk_1',
            _type: 'workspace',
            name: 'Test',
          },
          {
            _id: 'req_1',
            _type: 'request',
            parentId: 'wrk_1',
            name: 'Request',
            method: 'POST',
            url: '/upload',
            body: {
              mimeType: 'multipart/form-data',
              params: [
                { name: 'name', value: 'John', type: 'text' },
                { name: 'age', value: '30', type: 'text' },
              ],
            },
          },
        ],
      };

      // Act
      const result = importInsomniaExport(data);

      // Assert
      const bodyStr = result.collections[0]?.items[0]?.request.body;
      expect(bodyStr).toBeDefined();
      expect(JSON.parse(bodyStr as string)).toEqual({
        name: 'John',
        age: '30',
      });
    });
  });

  describe('request groups handling', () => {
    it('should flatten request groups', () => {
      // Arrange
      const data: InsomniaExport = {
        _type: 'export',
        __export_format: 4,
        resources: [
          {
            _id: 'wrk_1',
            _type: 'workspace',
            name: 'Test',
          },
          {
            _id: 'grp_1',
            _type: 'request_group',
            parentId: 'wrk_1',
            name: 'Users',
          },
          {
            _id: 'req_1',
            _type: 'request',
            parentId: 'grp_1',
            name: 'Get User',
            method: 'GET',
            url: '/users/:id',
          },
          {
            _id: 'req_2',
            _type: 'request',
            parentId: 'grp_1',
            name: 'Create User',
            method: 'POST',
            url: '/users',
          },
        ],
      };

      // Act
      const result = importInsomniaExport(data);

      // Assert
      expect(result.collections[0]?.items).toHaveLength(2);
      expect(result.collections[0]?.items[0]?.id).toBe('users-get-user');
      expect(result.collections[0]?.items[1]?.id).toBe('users-create-user');
    });

    it('should add group name as tag', () => {
      // Arrange
      const data: InsomniaExport = {
        _type: 'export',
        __export_format: 4,
        resources: [
          {
            _id: 'wrk_1',
            _type: 'workspace',
            name: 'Test',
          },
          {
            _id: 'grp_1',
            _type: 'request_group',
            parentId: 'wrk_1',
            name: 'Auth',
          },
          {
            _id: 'req_1',
            _type: 'request',
            parentId: 'grp_1',
            name: 'Login',
            method: 'POST',
            url: '/login',
          },
        ],
      };

      // Act
      const result = importInsomniaExport(data);

      // Assert
      expect(result.collections[0]?.items[0]?.tags).toEqual(['Auth']);
    });

    it('should handle deeply nested groups', () => {
      // Arrange
      const data: InsomniaExport = {
        _type: 'export',
        __export_format: 4,
        resources: [
          {
            _id: 'wrk_1',
            _type: 'workspace',
            name: 'Test',
          },
          {
            _id: 'grp_1',
            _type: 'request_group',
            parentId: 'wrk_1',
            name: 'API',
          },
          {
            _id: 'grp_2',
            _type: 'request_group',
            parentId: 'grp_1',
            name: 'V1',
          },
          {
            _id: 'grp_3',
            _type: 'request_group',
            parentId: 'grp_2',
            name: 'Users',
          },
          {
            _id: 'req_1',
            _type: 'request',
            parentId: 'grp_3',
            name: 'List',
            method: 'GET',
            url: '/api/v1/users',
          },
        ],
      };

      // Act
      const result = importInsomniaExport(data);

      // Assert
      expect(result.collections[0]?.items[0]?.id).toBe('api-v1-users-list');
      expect(result.items[0]?.sourcePath).toBe('API/V1/Users');
    });
  });

  describe('variable syntax conversion', () => {
    it('should convert variables in URL path', () => {
      // Arrange
      const data: InsomniaExport = {
        _type: 'export',
        __export_format: 4,
        resources: [
          {
            _id: 'wrk_1',
            _type: 'workspace',
            name: 'Test',
          },
          {
            _id: 'req_1',
            _type: 'request',
            parentId: 'wrk_1',
            name: 'Request',
            method: 'GET',
            url: '/users/{{userId}}',
          },
        ],
      };

      // Act
      const result = importInsomniaExport(data);

      // Assert
      expect(result.collections[0]?.items[0]?.request.path).toBe('/users/${userId}');
    });

    it('should convert template tag syntax', () => {
      // Arrange
      const data: InsomniaExport = {
        _type: 'export',
        __export_format: 4,
        resources: [
          {
            _id: 'wrk_1',
            _type: 'workspace',
            name: 'Test',
          },
          {
            _id: 'req_1',
            _type: 'request',
            parentId: 'wrk_1',
            name: 'Request',
            method: 'GET',
            url: '/users/_.userId',
          },
        ],
      };

      // Act
      const result = importInsomniaExport(data);

      // Assert
      expect(result.collections[0]?.items[0]?.request.path).toBe('/users/${userId}');
    });

    it('should convert variables in headers', () => {
      // Arrange
      const data: InsomniaExport = {
        _type: 'export',
        __export_format: 4,
        resources: [
          {
            _id: 'wrk_1',
            _type: 'workspace',
            name: 'Test',
          },
          {
            _id: 'req_1',
            _type: 'request',
            parentId: 'wrk_1',
            name: 'Request',
            method: 'GET',
            url: '/test',
            headers: [{ name: 'Authorization', value: 'Bearer {{token}}' }],
          },
        ],
      };

      // Act
      const result = importInsomniaExport(data);

      // Assert
      expect(result.collections[0]?.items[0]?.request.headers).toEqual(['Authorization: Bearer ${token}']);
    });

    it('should count and warn about variables', () => {
      // Arrange
      const data: InsomniaExport = {
        _type: 'export',
        __export_format: 4,
        resources: [
          {
            _id: 'wrk_1',
            _type: 'workspace',
            name: 'Test',
          },
          {
            _id: 'req_1',
            _type: 'request',
            parentId: 'wrk_1',
            name: 'Request',
            method: 'GET',
            url: '{{baseUrl}}/{{path}}',
            headers: [{ name: 'Auth', value: '{{token}}' }],
          },
        ],
      };

      // Act
      const result = importInsomniaExport(data);

      // Assert
      expect(result.warnings).toContainEqual(expect.stringContaining('3 Insomnia variable(s)'));
    });
  });

  describe('warnings for ignored features', () => {
    it('should warn about environments', () => {
      // Arrange
      const data: InsomniaExport = {
        _type: 'export',
        __export_format: 4,
        resources: [
          {
            _id: 'wrk_1',
            _type: 'workspace',
            name: 'Test',
          },
          {
            _id: 'env_1',
            _type: 'environment',
            parentId: 'wrk_1',
            name: 'Development',
          },
          {
            _id: 'env_2',
            _type: 'environment',
            parentId: 'wrk_1',
            name: 'Production',
          },
        ],
      };

      // Act
      const result = importInsomniaExport(data);

      // Assert
      expect(result.warnings).toContainEqual(expect.stringContaining('2 environment(s)'));
    });
  });

  describe('import options', () => {
    it('should use idPrefix option', () => {
      // Arrange
      const data: InsomniaExport = {
        _type: 'export',
        __export_format: 4,
        resources: [
          {
            _id: 'wrk_1',
            _type: 'workspace',
            name: 'Test',
          },
          {
            _id: 'req_1',
            _type: 'request',
            parentId: 'wrk_1',
            name: 'Request',
            method: 'GET',
            url: '/test',
          },
        ],
      };

      // Act
      const result = importInsomniaExport(data, { idPrefix: 'imported' });

      // Assert
      expect(result.collections[0]?.items[0]?.id).toBe('imported-request');
    });
  });

  describe('stats tracking', () => {
    it('should track import statistics', () => {
      // Arrange
      const data: InsomniaExport = {
        _type: 'export',
        __export_format: 4,
        resources: [
          {
            _id: 'wrk_1',
            _type: 'workspace',
            name: 'Test',
          },
          { _id: 'req_1', _type: 'request', parentId: 'wrk_1', name: 'R1', method: 'GET', url: '/a' },
          { _id: 'req_2', _type: 'request', parentId: 'wrk_1', name: 'R2', method: 'POST', url: '/b' },
          { _id: 'req_3', _type: 'request', parentId: 'wrk_1', name: 'R3', method: 'DELETE', url: '/c' },
        ],
      };

      // Act
      const result = importInsomniaExport(data);

      // Assert
      expect(result.stats.totalItems).toBe(3);
      expect(result.stats.convertedItems).toBe(3);
      expect(result.stats.skippedItems).toBe(0);
    });
  });
});

describe('convertVariableSyntax (Insomnia)', () => {
  it('should convert {{variable}} syntax', () => {
    expect(convertVariableSyntax('{{baseUrl}}')).toBe('${baseUrl}');
  });

  it('should convert _.variable syntax', () => {
    expect(convertVariableSyntax('_.baseUrl')).toBe('${baseUrl}');
  });

  it('should convert multiple variables', () => {
    expect(convertVariableSyntax('{{baseUrl}}/users/_.userId')).toBe('${baseUrl}/users/${userId}');
  });

  it('should leave non-variable text unchanged', () => {
    expect(convertVariableSyntax('/users/123')).toBe('/users/123');
  });

  it('should handle empty string', () => {
    expect(convertVariableSyntax('')).toBe('');
  });
});
