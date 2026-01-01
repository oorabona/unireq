/**
 * File Cache Tests
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LoadedSpec } from '../../types.js';
import { cacheFileSpec, getCachedFileSpec, getFileMetadata, validateFileCache } from '../file-cache.js';
import type { CacheEntry } from '../types.js';
import { CACHE_VERSION } from '../types.js';

describe('File Cache', () => {
  let testDir: string;
  let workspaceDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `unireq-file-cache-test-${Date.now()}`);
    workspaceDir = join(testDir, 'workspace');
    await mkdir(join(workspaceDir, '.unireq', 'cache'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  const createTestSpec = (source: string): LoadedSpec => ({
    version: '3.0',
    versionFull: '3.0.3',
    source,
    document: {
      openapi: '3.0.3',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {
        '/users': {
          get: { summary: 'List users', responses: { '200': { description: 'OK' } } },
        },
      },
    },
  });

  describe('getFileMetadata', () => {
    it('should return mtime and size for existing file', async () => {
      const filePath = join(testDir, 'test.yaml');
      await writeFile(filePath, 'openapi: 3.0.0');

      const metadata = await getFileMetadata(filePath);

      expect(metadata).not.toBeNull();
      expect(metadata?.mtime).toBeGreaterThan(0);
      expect(metadata?.size).toBeGreaterThan(0);
    });

    it('should return null for non-existent file', async () => {
      const metadata = await getFileMetadata(join(testDir, 'nonexistent.yaml'));
      expect(metadata).toBeNull();
    });
  });

  describe('validateFileCache', () => {
    it('should return true when file unchanged', async () => {
      const filePath = join(testDir, 'api.yaml');
      await writeFile(filePath, 'openapi: 3.0.0');

      const metadata = await getFileMetadata(filePath);
      const entry: CacheEntry = {
        cacheVersion: CACHE_VERSION,
        source: filePath,
        version: '3.0',
        versionFull: '3.0.0',
        validation: {
          mtime: metadata?.mtime,
          size: metadata?.size,
          cachedAt: Date.now(),
        },
        document: { openapi: '3.0.0', info: { title: 'Test', version: '1.0' }, paths: {} },
      };

      const isValid = await validateFileCache(filePath, entry);
      expect(isValid).toBe(true);
    });

    it('should return false when file modified', async () => {
      const filePath = join(testDir, 'api.yaml');
      await writeFile(filePath, 'openapi: 3.0.0');

      const entry: CacheEntry = {
        cacheVersion: CACHE_VERSION,
        source: filePath,
        version: '3.0',
        versionFull: '3.0.0',
        validation: {
          mtime: 1000, // Old mtime
          size: 15,
          cachedAt: Date.now(),
        },
        document: { openapi: '3.0.0', info: { title: 'Test', version: '1.0' }, paths: {} },
      };

      const isValid = await validateFileCache(filePath, entry);
      expect(isValid).toBe(false);
    });

    it('should return false when file deleted', async () => {
      const entry: CacheEntry = {
        cacheVersion: CACHE_VERSION,
        source: join(testDir, 'deleted.yaml'),
        version: '3.0',
        versionFull: '3.0.0',
        validation: {
          mtime: 1000,
          size: 100,
          cachedAt: Date.now(),
        },
        document: { openapi: '3.0.0', info: { title: 'Test', version: '1.0' }, paths: {} },
      };

      const isValid = await validateFileCache(join(testDir, 'deleted.yaml'), entry);
      expect(isValid).toBe(false);
    });

    it('should return false when entry has no file metadata', async () => {
      const filePath = join(testDir, 'api.yaml');
      await writeFile(filePath, 'openapi: 3.0.0');

      const entry: CacheEntry = {
        cacheVersion: CACHE_VERSION,
        source: filePath,
        version: '3.0',
        versionFull: '3.0.0',
        validation: {
          // No mtime or size - URL-style entry
          etag: '"abc123"',
          cachedAt: Date.now(),
        },
        document: { openapi: '3.0.0', info: { title: 'Test', version: '1.0' }, paths: {} },
      };

      const isValid = await validateFileCache(filePath, entry);
      expect(isValid).toBe(false);
    });
  });

  describe('getCachedFileSpec / cacheFileSpec', () => {
    it('should return null when no cache exists', async () => {
      const filePath = join(testDir, 'api.yaml');
      await writeFile(filePath, 'openapi: 3.0.0');

      const cached = await getCachedFileSpec(filePath, workspaceDir);
      expect(cached).toBeNull();
    });

    it('should cache and retrieve spec', async () => {
      const filePath = join(testDir, 'api.yaml');
      await writeFile(filePath, 'openapi: 3.0.0');

      const spec = createTestSpec(filePath);

      // Cache the spec
      const cacheResult = await cacheFileSpec(filePath, spec, workspaceDir);
      expect(cacheResult).toBe(true);

      // Retrieve from cache
      const cached = await getCachedFileSpec(filePath, workspaceDir);
      expect(cached).not.toBeNull();
      expect(cached?.version).toBe('3.0');
      expect(cached?.source).toBe(filePath);
      expect(cached?.document.paths?.['/users']).toBeDefined();
    });

    it('should invalidate cache when file changes', async () => {
      const filePath = join(testDir, 'api.yaml');
      await writeFile(filePath, 'openapi: 3.0.0');

      const spec = createTestSpec(filePath);

      // Cache the spec
      await cacheFileSpec(filePath, spec, workspaceDir);

      // Modify the file (change mtime)
      await new Promise((resolve) => setTimeout(resolve, 10)); // Ensure different mtime
      await writeFile(filePath, 'openapi: 3.1.0');

      // Should return null (cache invalidated)
      const cached = await getCachedFileSpec(filePath, workspaceDir);
      expect(cached).toBeNull();
    });

    it('should return null when source file deleted after caching', async () => {
      const filePath = join(testDir, 'api.yaml');
      await writeFile(filePath, 'openapi: 3.0.0');

      const spec = createTestSpec(filePath);
      await cacheFileSpec(filePath, spec, workspaceDir);

      // Delete the source file
      await rm(filePath);

      // Should return null (file gone)
      const cached = await getCachedFileSpec(filePath, workspaceDir);
      expect(cached).toBeNull();
    });

    it('should handle cache directory not existing gracefully', async () => {
      // Use a non-existent workspace
      const filePath = join(testDir, 'api.yaml');
      await writeFile(filePath, 'openapi: 3.0.0');

      const spec = createTestSpec(filePath);

      // Should succeed (creates directory)
      const newWorkspace = join(testDir, 'new-workspace');
      const result = await cacheFileSpec(filePath, spec, newWorkspace);
      expect(result).toBe(true);

      // Should be retrievable
      const cached = await getCachedFileSpec(filePath, newWorkspace);
      expect(cached).not.toBeNull();
    });
  });
});
