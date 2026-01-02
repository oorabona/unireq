/**
 * Collection loader tests
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  COLLECTIONS_FILE_NAME,
  CollectionDuplicateIdError,
  CollectionParseError,
  CollectionValidationError,
  collectionsFileExists,
  loadCollections,
} from '../index.js';

describe('Collection Loader', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary directory for each test
    testDir = join(tmpdir(), `unireq-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup
    await rm(testDir, { recursive: true, force: true });
  });

  describe('loadCollections', () => {
    describe('Given a workspace with valid collections.yaml', () => {
      it('should return CollectionConfig with parsed collections', async () => {
        // Given
        const yaml = `
version: 1
collections:
  - id: smoke
    name: Smoke Tests
    description: Basic health checks
    items:
      - id: health
        name: Health Check
        request:
          method: GET
          path: /health
`;
        await writeFile(join(testDir, COLLECTIONS_FILE_NAME), yaml);

        // When
        const config = await loadCollections(testDir);

        // Then
        expect(config.version).toBe(1);
        expect(config.collections).toHaveLength(1);
        expect(config.collections[0]?.id).toBe('smoke');
        expect(config.collections[0]?.name).toBe('Smoke Tests');
        expect(config.collections[0]?.items).toHaveLength(1);
        expect(config.collections[0]?.items[0]?.request.method).toBe('GET');
        expect(config.collections[0]?.items[0]?.request.path).toBe('/health');
      });

      it('should parse item with headers array', async () => {
        // Given
        const yaml = `
collections:
  - id: auth
    name: Auth Tests
    items:
      - id: login
        name: Login
        request:
          method: POST
          path: /auth/login
          headers:
            - "Content-Type: application/json"
            - "X-Request-ID: test-123"
`;
        await writeFile(join(testDir, COLLECTIONS_FILE_NAME), yaml);

        // When
        const config = await loadCollections(testDir);

        // Then
        const item = config.collections[0]?.items[0];
        expect(item?.request.headers).toEqual(['Content-Type: application/json', 'X-Request-ID: test-123']);
      });

      it('should parse item with complete structure', async () => {
        // Given
        const yaml = `
collections:
  - id: e2e
    name: E2E Tests
    items:
      - id: full-item
        name: Full Item Test
        description: Item with all optional fields
        request:
          method: POST
          path: /api/test
          headers:
            - "Authorization: Bearer token"
          body: '{"key": "value"}'
          query:
            - "page=1"
        assert:
          status: 200
          headers:
            content-type: application/json
          json:
            - path: "$.id"
              op: exists
          contains: "success"
        extract:
          vars:
            itemId: "$.data.id"
        tags:
          - smoke
          - critical
`;
        await writeFile(join(testDir, COLLECTIONS_FILE_NAME), yaml);

        // When
        const config = await loadCollections(testDir);

        // Then
        const item = config.collections[0]?.items[0];
        expect(item?.description).toBe('Item with all optional fields');
        expect(item?.request.body).toBe('{"key": "value"}');
        expect(item?.request.query).toEqual(['page=1']);
        expect(item?.assert?.status).toBe(200);
        expect(item?.assert?.headers).toEqual({ 'content-type': 'application/json' });
        expect(item?.assert?.json).toHaveLength(1);
        expect(item?.assert?.contains).toBe('success');
        expect(item?.extract?.vars).toEqual({ itemId: '$.data.id' });
        expect(item?.tags).toEqual(['smoke', 'critical']);
      });
    });

    describe('Given a workspace without collections.yaml', () => {
      it('should return empty collections array', async () => {
        // Given - no file created

        // When
        const config = await loadCollections(testDir);

        // Then
        expect(config.version).toBe(1);
        expect(config.collections).toEqual([]);
      });
    });

    describe('Given a collections.yaml with YAML syntax error', () => {
      it('should throw CollectionParseError with line info', async () => {
        // Given
        const invalidYaml = `
collections:
  - id: smoke
    name: Test
    items:
      - id: bad
        request:
          method: GET
          path: /test
          bad_indent
`;
        await writeFile(join(testDir, COLLECTIONS_FILE_NAME), invalidYaml);

        // When/Then
        await expect(loadCollections(testDir)).rejects.toThrow(CollectionParseError);

        try {
          await loadCollections(testDir);
        } catch (error) {
          expect(error).toBeInstanceOf(CollectionParseError);
          const parseError = error as CollectionParseError;
          expect(parseError.message).toContain('Failed to parse collections YAML');
          // Line info should be present
          expect(parseError.line).toBeDefined();
        }
      });
    });

    describe('Given a collections.yaml with schema validation failure', () => {
      it('should throw CollectionValidationError with path', async () => {
        // Given
        const yaml = `
collections:
  - id: smoke
    name: Test
    items:
      - id: bad
        name: Bad Item
        request:
          method: INVALID_METHOD
          path: /test
`;
        await writeFile(join(testDir, COLLECTIONS_FILE_NAME), yaml);

        // When/Then
        await expect(loadCollections(testDir)).rejects.toThrow(CollectionValidationError);

        try {
          await loadCollections(testDir);
        } catch (error) {
          expect(error).toBeInstanceOf(CollectionValidationError);
          const validationError = error as CollectionValidationError;
          expect(validationError.path).toContain('collections');
          expect(validationError.message).toContain('validation failed');
        }
      });

      it('should throw for missing required path', async () => {
        // Given
        const yaml = `
collections:
  - id: smoke
    name: Test
    items:
      - id: bad
        name: Bad Item
        request:
          method: GET
`;
        await writeFile(join(testDir, COLLECTIONS_FILE_NAME), yaml);

        // When/Then
        await expect(loadCollections(testDir)).rejects.toThrow(CollectionValidationError);
      });
    });

    describe('Given a collections.yaml with duplicate collection IDs', () => {
      it('should throw CollectionDuplicateIdError', async () => {
        // Given
        const yaml = `
collections:
  - id: smoke
    name: Smoke Tests 1
    items: []
  - id: smoke
    name: Smoke Tests 2
    items: []
`;
        await writeFile(join(testDir, COLLECTIONS_FILE_NAME), yaml);

        // When/Then
        await expect(loadCollections(testDir)).rejects.toThrow(CollectionDuplicateIdError);

        try {
          await loadCollections(testDir);
        } catch (error) {
          expect(error).toBeInstanceOf(CollectionDuplicateIdError);
          const dupError = error as CollectionDuplicateIdError;
          expect(dupError.duplicateId).toBe('smoke');
          expect(dupError.type).toBe('collection');
          expect(dupError.message).toContain('Duplicate collection ID: smoke');
        }
      });
    });

    describe('Given a collection with duplicate item IDs', () => {
      it('should throw CollectionDuplicateIdError with collection context', async () => {
        // Given
        const yaml = `
collections:
  - id: smoke
    name: Smoke Tests
    items:
      - id: health
        name: Health 1
        request:
          method: GET
          path: /health
      - id: health
        name: Health 2
        request:
          method: GET
          path: /health2
`;
        await writeFile(join(testDir, COLLECTIONS_FILE_NAME), yaml);

        // When/Then
        await expect(loadCollections(testDir)).rejects.toThrow(CollectionDuplicateIdError);

        try {
          await loadCollections(testDir);
        } catch (error) {
          expect(error).toBeInstanceOf(CollectionDuplicateIdError);
          const dupError = error as CollectionDuplicateIdError;
          expect(dupError.duplicateId).toBe('health');
          expect(dupError.type).toBe('item');
          expect(dupError.collectionId).toBe('smoke');
          expect(dupError.message).toContain('Duplicate item ID: health in collection: smoke');
        }
      });
    });

    describe('Given an empty collections file', () => {
      it('should return empty collections for "---" only', async () => {
        // Given
        await writeFile(join(testDir, COLLECTIONS_FILE_NAME), '---\n');

        // When
        const config = await loadCollections(testDir);

        // Then
        expect(config.version).toBe(1);
        expect(config.collections).toEqual([]);
      });

      it('should return empty collections for empty file', async () => {
        // Given
        await writeFile(join(testDir, COLLECTIONS_FILE_NAME), '');

        // When
        const config = await loadCollections(testDir);

        // Then
        expect(config.collections).toEqual([]);
      });
    });

    describe('Given collections with empty items array', () => {
      it('should return collection with empty items', async () => {
        // Given
        const yaml = `
collections:
  - id: empty
    name: Empty Collection
    items: []
`;
        await writeFile(join(testDir, COLLECTIONS_FILE_NAME), yaml);

        // When
        const config = await loadCollections(testDir);

        // Then
        expect(config.collections[0]?.items).toEqual([]);
      });
    });

    describe('Method normalization', () => {
      it('should normalize lowercase methods to uppercase', async () => {
        // Given
        const yaml = `
collections:
  - id: test
    name: Test
    items:
      - id: lowercase
        name: Lowercase Method
        request:
          method: post
          path: /test
`;
        await writeFile(join(testDir, COLLECTIONS_FILE_NAME), yaml);

        // When
        const config = await loadCollections(testDir);

        // Then
        expect(config.collections[0]?.items[0]?.request.method).toBe('POST');
      });
    });
  });

  describe('collectionsFileExists', () => {
    it('should return true when file exists', async () => {
      // Given
      await writeFile(join(testDir, COLLECTIONS_FILE_NAME), 'collections: []');

      // When
      const exists = await collectionsFileExists(testDir);

      // Then
      expect(exists).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      // Given - no file

      // When
      const exists = await collectionsFileExists(testDir);

      // Then
      expect(exists).toBe(false);
    });
  });
});
