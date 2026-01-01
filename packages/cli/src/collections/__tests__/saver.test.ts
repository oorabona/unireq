/**
 * Tests for collection saver functions
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ParsedRequest } from '../../types.js';
import {
  InvalidIdError,
  parsedRequestToSavedRequest,
  parseSaveArgs,
  SaveSyntaxError,
  saveToCollections,
  validateId,
} from '../saver.js';

describe('parseSaveArgs', () => {
  describe('when valid arguments are provided', () => {
    it('should parse collection/item syntax', () => {
      // Arrange
      const args = ['smoke/health'];

      // Act
      const result = parseSaveArgs(args);

      // Assert
      expect(result.collectionId).toBe('smoke');
      expect(result.itemId).toBe('health');
      expect(result.name).toBeUndefined();
    });

    it('should parse with --name flag', () => {
      // Arrange
      const args = ['smoke/health', '--name', 'Health Check'];

      // Act
      const result = parseSaveArgs(args);

      // Assert
      expect(result.collectionId).toBe('smoke');
      expect(result.itemId).toBe('health');
      expect(result.name).toBe('Health Check');
    });

    it('should parse with -n flag', () => {
      // Arrange
      const args = ['api/create-user', '-n', 'Create User'];

      // Act
      const result = parseSaveArgs(args);

      // Assert
      expect(result.collectionId).toBe('api');
      expect(result.itemId).toBe('create-user');
      expect(result.name).toBe('Create User');
    });

    it('should accept IDs with underscores', () => {
      // Arrange
      const args = ['my_collection/my_item'];

      // Act
      const result = parseSaveArgs(args);

      // Assert
      expect(result.collectionId).toBe('my_collection');
      expect(result.itemId).toBe('my_item');
    });

    it('should accept IDs with dashes', () => {
      // Arrange
      const args = ['my-collection/my-item'];

      // Act
      const result = parseSaveArgs(args);

      // Assert
      expect(result.collectionId).toBe('my-collection');
      expect(result.itemId).toBe('my-item');
    });

    it('should accept IDs with numbers', () => {
      // Arrange
      const args = ['test123/item456'];

      // Act
      const result = parseSaveArgs(args);

      // Assert
      expect(result.collectionId).toBe('test123');
      expect(result.itemId).toBe('item456');
    });
  });

  describe('when invalid arguments are provided', () => {
    it('should throw on empty args', () => {
      // Arrange
      const args: string[] = [];

      // Act & Assert
      expect(() => parseSaveArgs(args)).toThrow(SaveSyntaxError);
      expect(() => parseSaveArgs(args)).toThrow('Usage: save <collection>/<item>');
    });

    it('should throw on missing slash', () => {
      // Arrange
      const args = ['smoke'];

      // Act & Assert
      expect(() => parseSaveArgs(args)).toThrow(SaveSyntaxError);
      expect(() => parseSaveArgs(args)).toThrow("Use 'save smoke/<item>' format");
    });

    it('should throw on empty collection ID', () => {
      // Arrange
      const args = ['/health'];

      // Act & Assert
      expect(() => parseSaveArgs(args)).toThrow(SaveSyntaxError);
      expect(() => parseSaveArgs(args)).toThrow('Collection ID cannot be empty');
    });

    it('should throw on empty item ID', () => {
      // Arrange
      const args = ['smoke/'];

      // Act & Assert
      expect(() => parseSaveArgs(args)).toThrow(SaveSyntaxError);
      expect(() => parseSaveArgs(args)).toThrow('Item ID cannot be empty');
    });

    it('should throw on missing --name value', () => {
      // Arrange
      const args = ['smoke/health', '--name'];

      // Act & Assert
      expect(() => parseSaveArgs(args)).toThrow(SaveSyntaxError);
      expect(() => parseSaveArgs(args)).toThrow('Missing value for --name flag');
    });

    it('should throw on unknown flag', () => {
      // Arrange
      const args = ['smoke/health', '--unknown'];

      // Act & Assert
      expect(() => parseSaveArgs(args)).toThrow(SaveSyntaxError);
      expect(() => parseSaveArgs(args)).toThrow('Unknown flag: --unknown');
    });

    it('should throw on invalid collection ID characters', () => {
      // Arrange
      const args = ['smoke test/health'];

      // Act & Assert
      expect(() => parseSaveArgs(args)).toThrow(InvalidIdError);
      expect(() => parseSaveArgs(args)).toThrow('Invalid collection ID');
    });

    it('should throw on invalid item ID characters', () => {
      // Arrange
      const args = ['smoke/health check'];

      // Act & Assert
      expect(() => parseSaveArgs(args)).toThrow(InvalidIdError);
      expect(() => parseSaveArgs(args)).toThrow('Invalid item ID');
    });
  });
});

describe('validateId', () => {
  describe('when valid ID is provided', () => {
    it('should not throw for alphanumeric IDs', () => {
      // Arrange & Act & Assert
      expect(() => validateId('test123', 'collection')).not.toThrow();
    });

    it('should not throw for IDs with dashes', () => {
      // Arrange & Act & Assert
      expect(() => validateId('my-test', 'item')).not.toThrow();
    });

    it('should not throw for IDs with underscores', () => {
      // Arrange & Act & Assert
      expect(() => validateId('my_test', 'collection')).not.toThrow();
    });
  });

  describe('when invalid ID is provided', () => {
    it('should throw for empty ID', () => {
      // Arrange & Act & Assert
      expect(() => validateId('', 'collection')).toThrow(InvalidIdError);
    });

    it('should throw for ID with spaces', () => {
      // Arrange & Act & Assert
      expect(() => validateId('my test', 'item')).toThrow(InvalidIdError);
    });

    it('should throw for ID with special characters', () => {
      // Arrange & Act & Assert
      expect(() => validateId('test@123', 'collection')).toThrow(InvalidIdError);
    });
  });
});

describe('parsedRequestToSavedRequest', () => {
  describe('when converting simple requests', () => {
    it('should convert GET request with path only', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'GET',
        url: '/health',
        headers: [],
        query: [],
      };

      // Act
      const result = parsedRequestToSavedRequest(request);

      // Assert
      expect(result.method).toBe('GET');
      expect(result.path).toBe('/health');
      expect(result.headers).toBeUndefined();
      expect(result.body).toBeUndefined();
      expect(result.query).toBeUndefined();
    });

    it('should convert request with headers', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'GET',
        url: '/users',
        headers: ['Authorization:Bearer token', 'Accept:application/json'],
        query: [],
      };

      // Act
      const result = parsedRequestToSavedRequest(request);

      // Assert
      expect(result.headers).toEqual(['Authorization:Bearer token', 'Accept:application/json']);
    });

    it('should convert request with body', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'POST',
        url: '/users',
        headers: [],
        query: [],
        body: '{"name":"Alice"}',
      };

      // Act
      const result = parsedRequestToSavedRequest(request);

      // Assert
      expect(result.body).toBe('{"name":"Alice"}');
    });

    it('should convert request with query params', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'GET',
        url: '/users',
        headers: [],
        query: ['page=1', 'limit=10'],
      };

      // Act
      const result = parsedRequestToSavedRequest(request);

      // Assert
      expect(result.query).toEqual(['page=1', 'limit=10']);
    });
  });

  describe('when converting full URLs', () => {
    it('should extract path from full URL', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'GET',
        url: 'https://api.example.com/users',
        headers: [],
        query: [],
      };

      // Act
      const result = parsedRequestToSavedRequest(request);

      // Assert
      expect(result.path).toBe('/users');
    });

    it('should extract query params from URL', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'GET',
        url: 'https://api.example.com/users?page=1&limit=10',
        headers: [],
        query: [],
      };

      // Act
      const result = parsedRequestToSavedRequest(request);

      // Assert
      expect(result.path).toBe('/users');
      expect(result.query).toEqual(['page=1', 'limit=10']);
    });

    it('should merge URL query params with explicit query params', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'GET',
        url: 'https://api.example.com/users?page=1',
        headers: [],
        query: ['limit=10'],
      };

      // Act
      const result = parsedRequestToSavedRequest(request);

      // Assert
      expect(result.query).toContain('page=1');
      expect(result.query).toContain('limit=10');
    });

    it('should deduplicate query params', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'GET',
        url: 'https://api.example.com/users?page=1',
        headers: [],
        query: ['page=1', 'limit=10'],
      };

      // Act
      const result = parsedRequestToSavedRequest(request);

      // Assert
      expect(result.query).toEqual(['page=1', 'limit=10']);
    });
  });

  describe('when converting path with query string', () => {
    it('should extract path and query from path with query string', () => {
      // Arrange
      const request: ParsedRequest = {
        method: 'GET',
        url: '/users?page=1&limit=10',
        headers: [],
        query: [],
      };

      // Act
      const result = parsedRequestToSavedRequest(request);

      // Assert
      expect(result.path).toBe('/users');
      expect(result.query).toEqual(['page=1', 'limit=10']);
    });
  });
});

describe('saveToCollections', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create temp directory for tests
    tempDir = join(tmpdir(), `unireq-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup temp directory
    await rm(tempDir, { recursive: true, force: true });
  });

  const createTestRequest = (overrides: Partial<ParsedRequest> = {}): ParsedRequest => ({
    method: 'GET',
    url: '/health',
    headers: [],
    query: [],
    ...overrides,
  });

  describe('when creating new collection', () => {
    it('should create collections.yaml with new collection and item', async () => {
      // Arrange
      const request = createTestRequest();

      // Act
      const result = await saveToCollections(tempDir, 'smoke', 'health', request);

      // Assert
      expect(result.action).toBe('created');
      expect(result.collectionCreated).toBe(true);
      expect(result.collectionId).toBe('smoke');
      expect(result.itemId).toBe('health');

      // Verify file contents
      const content = await readFile(join(tempDir, 'collections.yaml'), 'utf-8');
      expect(content).toContain('smoke');
      expect(content).toContain('health');
    });

    it('should use ID as default name', async () => {
      // Arrange
      const request = createTestRequest();

      // Act
      await saveToCollections(tempDir, 'smoke', 'health', request);

      // Assert
      const content = await readFile(join(tempDir, 'collections.yaml'), 'utf-8');
      expect(content).toContain('name: health');
    });

    it('should use custom name when provided', async () => {
      // Arrange
      const request = createTestRequest();

      // Act
      await saveToCollections(tempDir, 'smoke', 'health', request, 'Health Check');

      // Assert
      const content = await readFile(join(tempDir, 'collections.yaml'), 'utf-8');
      expect(content).toContain('name: Health Check');
    });
  });

  describe('when adding to existing collection', () => {
    it('should add item to existing collection', async () => {
      // Arrange
      const existingYaml = `version: 1
collections:
  - id: smoke
    name: smoke
    items:
      - id: existing
        name: existing
        request:
          method: GET
          path: /existing
`;
      await writeFile(join(tempDir, 'collections.yaml'), existingYaml);
      const request = createTestRequest();

      // Act
      const result = await saveToCollections(tempDir, 'smoke', 'health', request);

      // Assert
      expect(result.action).toBe('created');
      expect(result.collectionCreated).toBe(false);

      const content = await readFile(join(tempDir, 'collections.yaml'), 'utf-8');
      expect(content).toContain('existing');
      expect(content).toContain('health');
    });
  });

  describe('when updating existing item', () => {
    it('should update item in place', async () => {
      // Arrange
      const existingYaml = `version: 1
collections:
  - id: smoke
    name: smoke
    items:
      - id: health
        name: Old Health
        request:
          method: GET
          path: /old-health
`;
      await writeFile(join(tempDir, 'collections.yaml'), existingYaml);
      const request = createTestRequest({ url: '/new-health' });

      // Act
      const result = await saveToCollections(tempDir, 'smoke', 'health', request, 'New Health');

      // Assert
      expect(result.action).toBe('updated');
      expect(result.collectionCreated).toBe(false);

      const content = await readFile(join(tempDir, 'collections.yaml'), 'utf-8');
      expect(content).toContain('New Health');
      expect(content).toContain('/new-health');
      expect(content).not.toContain('Old Health');
      expect(content).not.toContain('/old-health');
    });
  });

  describe('when collections.yaml does not exist', () => {
    it('should create new file with version 1', async () => {
      // Arrange
      const request = createTestRequest();

      // Act
      await saveToCollections(tempDir, 'smoke', 'health', request);

      // Assert
      const content = await readFile(join(tempDir, 'collections.yaml'), 'utf-8');
      expect(content).toContain('version: 1');
    });
  });

  describe('when collections.yaml is empty', () => {
    it('should create valid structure', async () => {
      // Arrange
      await writeFile(join(tempDir, 'collections.yaml'), '');
      const request = createTestRequest();

      // Act
      await saveToCollections(tempDir, 'smoke', 'health', request);

      // Assert
      const content = await readFile(join(tempDir, 'collections.yaml'), 'utf-8');
      expect(content).toContain('version: 1');
      expect(content).toContain('smoke');
    });
  });

  describe('when saving request with all fields', () => {
    it('should save headers, body, and query', async () => {
      // Arrange
      const request = createTestRequest({
        method: 'POST',
        url: '/users',
        headers: ['Content-Type:application/json', 'Authorization:Bearer token'],
        query: ['validate=true'],
        body: '{"name":"Alice"}',
      });

      // Act
      await saveToCollections(tempDir, 'api', 'create-user', request);

      // Assert
      const content = await readFile(join(tempDir, 'collections.yaml'), 'utf-8');
      expect(content).toContain('method: POST');
      expect(content).toContain('path: /users');
      expect(content).toContain('Content-Type:application/json');
      expect(content).toContain('Authorization:Bearer token');
      expect(content).toContain('validate=true');
      expect(content).toContain('{"name":"Alice"}');
    });
  });
});
