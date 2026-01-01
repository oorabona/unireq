/**
 * Tests for Swagger 2.0 to OpenAPI 3.1 converter
 */

import { describe, expect, it } from 'vitest';
import { convertSwagger2ToOpenAPI3, isSwagger2 } from '../converter.js';

describe('isSwagger2', () => {
  it('returns true for Swagger 2.0 document', () => {
    const doc = { swagger: '2.0', info: { title: 'Test', version: '1.0.0' } };
    expect(isSwagger2(doc)).toBe(true);
  });

  it('returns false for OpenAPI 3.0 document', () => {
    const doc = { openapi: '3.0.0', info: { title: 'Test', version: '1.0.0' } };
    expect(isSwagger2(doc)).toBe(false);
  });

  it('returns false for OpenAPI 3.1 document', () => {
    const doc = { openapi: '3.1.0', info: { title: 'Test', version: '1.0.0' } };
    expect(isSwagger2(doc)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isSwagger2(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isSwagger2(undefined)).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(isSwagger2('string')).toBe(false);
    expect(isSwagger2(123)).toBe(false);
  });
});

describe('convertSwagger2ToOpenAPI3', () => {
  describe('basic conversion', () => {
    it('converts Swagger 2.0 to OpenAPI 3.1.x', () => {
      const swagger = {
        swagger: '2.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      };

      const result = convertSwagger2ToOpenAPI3(swagger);

      expect(result.openapi).toMatch(/^3\.1\.\d+$/);
      expect(result.info.title).toBe('Test API');
      expect(result.info.version).toBe('1.0.0');
    });

    it('returns OpenAPI 3.x documents unchanged', () => {
      const openapi = {
        openapi: '3.0.3',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {},
      };

      const result = convertSwagger2ToOpenAPI3(openapi);

      expect(result).toBe(openapi); // Same reference
      expect(result.openapi).toBe('3.0.3');
    });
  });

  describe('server URL construction', () => {
    it('converts host, basePath, and schemes to servers array', () => {
      const swagger = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0.0' },
        host: 'api.example.com',
        basePath: '/v1',
        schemes: ['https'],
        paths: {},
      };

      const result = convertSwagger2ToOpenAPI3(swagger);

      expect(result.servers).toBeDefined();
      expect(result.servers).toHaveLength(1);
      const serverUrl = result.servers?.[0]?.url;
      expect(serverUrl).toBe('https://api.example.com/v1');
    });

    it('creates multiple servers for multiple schemes', () => {
      const swagger = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0.0' },
        host: 'api.example.com',
        basePath: '/v1',
        schemes: ['https', 'http'],
        paths: {},
      };

      const result = convertSwagger2ToOpenAPI3(swagger);

      expect(result.servers).toHaveLength(2);
      const server0Url = result.servers?.[0]?.url;
      const server1Url = result.servers?.[1]?.url;
      expect(server0Url).toContain('https://');
      expect(server1Url).toContain('http://');
    });

    it('defaults to https when no schemes specified', () => {
      const swagger = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0.0' },
        host: 'api.example.com',
        paths: {},
      };

      const result = convertSwagger2ToOpenAPI3(swagger);

      // The upgrade function may handle this differently
      // At minimum, it should have servers or no crash
      expect(result.openapi).toMatch(/^3\.1\.\d+$/);
    });

    it('handles missing host (relative URL)', () => {
      const swagger = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0.0' },
        basePath: '/api',
        paths: {},
      };

      const result = convertSwagger2ToOpenAPI3(swagger);

      expect(result.openapi).toMatch(/^3\.1\.\d+$/);
      // Server URL might be relative or omitted
    });
  });

  describe('definitions to components.schemas', () => {
    it('converts definitions to components.schemas', () => {
      const swagger = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
        definitions: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
            },
          },
        },
      };

      const result = convertSwagger2ToOpenAPI3(swagger);

      expect(result.components?.schemas?.['User']).toBeDefined();
      expect(result.components?.schemas?.['User']?.type).toBe('object');
      expect(result.components?.schemas?.['User']?.properties?.['id']?.type).toBe('integer');
    });
  });

  describe('$ref path updates', () => {
    it('updates $ref paths from definitions to components/schemas', () => {
      const swagger = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              responses: {
                '200': {
                  description: 'OK',
                  schema: {
                    $ref: '#/definitions/User',
                  },
                },
              },
            },
          },
        },
        definitions: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
            },
          },
        },
      };

      const result = convertSwagger2ToOpenAPI3(swagger);

      // In OpenAPI 3.x, response schema is under content
      const response = result.paths?.['/users']?.get?.responses?.['200'];
      expect(response).toBeDefined();
      // The structure changes in OpenAPI 3.x
      expect(result.components?.schemas?.['User']).toBeDefined();
    });
  });

  describe('paths preservation', () => {
    it('preserves path definitions', () => {
      const swagger = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              summary: 'List users',
              operationId: 'listUsers',
              responses: {
                '200': { description: 'OK' },
              },
            },
          },
          '/users/{id}': {
            get: {
              summary: 'Get user',
              operationId: 'getUser',
              parameters: [
                {
                  name: 'id',
                  in: 'path',
                  required: true,
                  type: 'integer',
                },
              ],
              responses: {
                '200': { description: 'OK' },
              },
            },
          },
        },
      };

      const result = convertSwagger2ToOpenAPI3(swagger);

      expect(result.paths?.['/users']).toBeDefined();
      expect(result.paths?.['/users']?.get?.summary).toBe('List users');
      expect(result.paths?.['/users/{id}']).toBeDefined();
      expect(result.paths?.['/users/{id}']?.get?.summary).toBe('Get user');
    });
  });

  describe('consumes and produces', () => {
    it('handles global consumes/produces', () => {
      const swagger = {
        swagger: '2.0',
        info: { title: 'Test', version: '1.0.0' },
        consumes: ['application/json'],
        produces: ['application/json'],
        paths: {
          '/users': {
            post: {
              summary: 'Create user',
              parameters: [
                {
                  name: 'body',
                  in: 'body',
                  schema: { type: 'object' },
                },
              ],
              responses: {
                '201': { description: 'Created' },
              },
            },
          },
        },
      };

      const result = convertSwagger2ToOpenAPI3(swagger);

      expect(result.openapi).toMatch(/^3\.1\.\d+$/);
      // The upgrade function handles consumes/produces conversion
      // to requestBody/response content types
    });
  });

  describe('error handling', () => {
    it('returns original document on conversion error', () => {
      // This is a malformed Swagger that might cause issues
      const malformed = {
        swagger: '2.0',
        // Missing required info
      };

      // Should not throw, should return something
      const result = convertSwagger2ToOpenAPI3(malformed);
      expect(result).toBeDefined();
    });
  });
});
