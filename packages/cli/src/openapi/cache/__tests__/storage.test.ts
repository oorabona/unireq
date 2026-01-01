/**
 * Cache Storage Tests
 */

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteCache, generateCacheKey, getCacheDir, getCachePath, readCache, writeCache } from '../storage.js';
import type { CacheEntry } from '../types.js';
import { CACHE_VERSION } from '../types.js';

describe('Cache Storage', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `unireq-cache-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('getCacheDir', () => {
    it('should return workspace cache path when workspace provided', () => {
      const result = getCacheDir('/my/workspace');
      expect(result).toBe('/my/workspace/.unireq/cache');
    });

    it('should return global cache path when no workspace', () => {
      const result = getCacheDir();
      expect(result).not.toBeNull();
      expect(result).toContain('cache');
    });
  });

  describe('generateCacheKey', () => {
    it('should generate key from file source + mtime + size', () => {
      const key = generateCacheKey('/path/to/api.yaml', 1704067200000, 1024);
      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate different keys for different mtimes', () => {
      const key1 = generateCacheKey('/path/to/api.yaml', 1704067200000, 1024);
      const key2 = generateCacheKey('/path/to/api.yaml', 1704067300000, 1024);
      expect(key1).not.toBe(key2);
    });

    it('should generate key from URL + ETag', () => {
      const key = generateCacheKey('https://api.example.com/openapi.json', undefined, undefined, '"abc123"');
      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate key from URL + Last-Modified', () => {
      const key = generateCacheKey(
        'https://api.example.com/openapi.json',
        undefined,
        undefined,
        undefined,
        'Wed, 01 Jan 2025 00:00:00 GMT',
      );
      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate key from URL only when no validation headers', () => {
      const key = generateCacheKey('https://api.example.com/openapi.json');
      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should prefer ETag over Last-Modified', () => {
      const keyEtag = generateCacheKey(
        'https://api.example.com/openapi.json',
        undefined,
        undefined,
        '"abc123"',
        'Wed, 01 Jan 2025 00:00:00 GMT',
      );
      const keyEtagOnly = generateCacheKey('https://api.example.com/openapi.json', undefined, undefined, '"abc123"');
      expect(keyEtag).toBe(keyEtagOnly);
    });
  });

  describe('getCachePath', () => {
    it('should return path with hash-based filename', () => {
      const path = getCachePath('/my/api.yaml', '/workspace');
      expect(path).toMatch(/\/workspace\/\.unireq\/cache\/spec-[a-f0-9]{16}\.json$/);
    });

    it('should generate different paths for different sources', () => {
      const path1 = getCachePath('/my/api1.yaml', '/workspace');
      const path2 = getCachePath('/my/api2.yaml', '/workspace');
      expect(path1).not.toBe(path2);
    });
  });

  describe('readCache', () => {
    it('should return null for non-existent file', async () => {
      const result = await readCache(join(testDir, 'nonexistent.json'));
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', async () => {
      const path = join(testDir, 'invalid.json');
      await writeFile(path, 'not json');
      const result = await readCache(path);
      expect(result).toBeNull();
    });

    it('should return null for wrong cache version', async () => {
      const path = join(testDir, 'old-version.json');
      await writeFile(path, JSON.stringify({ cacheVersion: 0 }));
      const result = await readCache(path);
      expect(result).toBeNull();
    });

    it('should return valid cache entry', async () => {
      const entry: CacheEntry = {
        cacheVersion: CACHE_VERSION,
        source: '/api.yaml',
        version: '3.0',
        versionFull: '3.0.3',
        validation: {
          mtime: 1704067200000,
          size: 1024,
          cachedAt: Date.now(),
        },
        document: {
          openapi: '3.0.3',
          info: { title: 'Test API', version: '1.0.0' },
          paths: {},
        },
      };

      const path = join(testDir, 'valid.json');
      await writeFile(path, JSON.stringify(entry));

      const result = await readCache(path);
      expect(result).not.toBeNull();
      expect(result?.source).toBe('/api.yaml');
      expect(result?.version).toBe('3.0');
    });
  });

  describe('writeCache', () => {
    it('should create cache directory if not exists', async () => {
      const path = join(testDir, 'subdir', 'cache.json');
      const entry: CacheEntry = {
        cacheVersion: CACHE_VERSION,
        source: '/api.yaml',
        version: '3.0',
        versionFull: '3.0.3',
        validation: { cachedAt: Date.now() },
        document: {
          openapi: '3.0.3',
          info: { title: 'Test', version: '1.0' },
          paths: {},
        },
      };

      const result = await writeCache(path, entry);
      expect(result).toBe(true);

      const content = await readFile(path, 'utf-8');
      expect(JSON.parse(content)).toMatchObject({ source: '/api.yaml' });
    });

    it('should overwrite existing cache', async () => {
      const path = join(testDir, 'cache.json');
      const entry1: CacheEntry = {
        cacheVersion: CACHE_VERSION,
        source: '/api1.yaml',
        version: '3.0',
        versionFull: '3.0.3',
        validation: { cachedAt: Date.now() },
        document: { openapi: '3.0.3', info: { title: 'Test1', version: '1.0' }, paths: {} },
      };
      const entry2: CacheEntry = {
        cacheVersion: CACHE_VERSION,
        source: '/api2.yaml',
        version: '3.1',
        versionFull: '3.1.0',
        validation: { cachedAt: Date.now() },
        document: { openapi: '3.1.0', info: { title: 'Test2', version: '2.0' }, paths: {} },
      };

      await writeCache(path, entry1);
      await writeCache(path, entry2);

      const content = await readFile(path, 'utf-8');
      expect(JSON.parse(content)).toMatchObject({ source: '/api2.yaml' });
    });
  });

  describe('deleteCache', () => {
    it('should delete existing cache file', async () => {
      const path = join(testDir, 'to-delete.json');
      await writeFile(path, '{}');

      const result = await deleteCache(path);
      expect(result).toBe(true);

      const exists = await readFile(path).catch(() => null);
      expect(exists).toBeNull();
    });

    it('should return true for non-existent file (idempotent)', async () => {
      const result = await deleteCache(join(testDir, 'nonexistent.json'));
      expect(result).toBe(true);
    });
  });
});
