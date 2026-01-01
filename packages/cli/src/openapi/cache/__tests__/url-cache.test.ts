/**
 * URL Cache Tests
 */

import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoadedSpec } from '../../types.js';
import type { CacheEntry } from '../types.js';
import { CACHE_VERSION } from '../types.js';
import { cacheUrlSpec, extractValidationHeaders, getCachedUrlSpec, validateUrlCache } from '../url-cache.js';

// Mock fetch for URL validation tests
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('URL Cache', () => {
  let testDir: string;
  let workspaceDir: string;

  beforeAll(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(async () => {
    testDir = join(tmpdir(), `unireq-url-cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    workspaceDir = join(testDir, 'workspace');
    await mkdir(join(workspaceDir, '.unireq', 'cache'), { recursive: true });
    mockFetch.mockReset();
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

  describe('extractValidationHeaders', () => {
    it('should extract ETag header', () => {
      const headers = new Headers({ etag: '"abc123"' });
      const result = extractValidationHeaders(headers);
      expect(result.etag).toBe('"abc123"');
      expect(result.lastModified).toBeUndefined();
    });

    it('should extract Last-Modified header', () => {
      const headers = new Headers({ 'last-modified': 'Wed, 01 Jan 2025 00:00:00 GMT' });
      const result = extractValidationHeaders(headers);
      expect(result.lastModified).toBe('Wed, 01 Jan 2025 00:00:00 GMT');
      expect(result.etag).toBeUndefined();
    });

    it('should extract both headers', () => {
      const headers = new Headers({
        etag: '"abc123"',
        'last-modified': 'Wed, 01 Jan 2025 00:00:00 GMT',
      });
      const result = extractValidationHeaders(headers);
      expect(result.etag).toBe('"abc123"');
      expect(result.lastModified).toBe('Wed, 01 Jan 2025 00:00:00 GMT');
    });

    it('should handle missing headers', () => {
      const headers = new Headers();
      const result = extractValidationHeaders(headers);
      expect(result.etag).toBeUndefined();
      expect(result.lastModified).toBeUndefined();
    });
  });

  describe('validateUrlCache', () => {
    const testUrl = 'https://api.example.com/openapi.json';

    it('should return true on 304 Not Modified', async () => {
      mockFetch.mockResolvedValueOnce({ status: 304 });

      const entry: CacheEntry = {
        cacheVersion: CACHE_VERSION,
        source: testUrl,
        version: '3.0',
        versionFull: '3.0.3',
        validation: {
          etag: '"abc123"',
          cachedAt: Date.now(),
        },
        document: { openapi: '3.0.3', info: { title: 'Test', version: '1.0' }, paths: {} },
      };

      const isValid = await validateUrlCache(testUrl, entry);
      expect(isValid).toBe(true);

      expect(mockFetch).toHaveBeenCalledWith(
        testUrl,
        expect.objectContaining({
          method: 'HEAD',
          headers: { 'If-None-Match': '"abc123"' },
        }),
      );
    });

    it('should return false on 200 OK (resource changed)', async () => {
      mockFetch.mockResolvedValueOnce({ status: 200 });

      const entry: CacheEntry = {
        cacheVersion: CACHE_VERSION,
        source: testUrl,
        version: '3.0',
        versionFull: '3.0.3',
        validation: {
          lastModified: 'Wed, 01 Jan 2025 00:00:00 GMT',
          cachedAt: Date.now(),
        },
        document: { openapi: '3.0.3', info: { title: 'Test', version: '1.0' }, paths: {} },
      };

      const isValid = await validateUrlCache(testUrl, entry);
      expect(isValid).toBe(false);
    });

    it('should return false when no validation headers in cache', async () => {
      const entry: CacheEntry = {
        cacheVersion: CACHE_VERSION,
        source: testUrl,
        version: '3.0',
        versionFull: '3.0.3',
        validation: {
          cachedAt: Date.now(),
        },
        document: { openapi: '3.0.3', info: { title: 'Test', version: '1.0' }, paths: {} },
      };

      const isValid = await validateUrlCache(testUrl, entry);
      expect(isValid).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return false on fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const entry: CacheEntry = {
        cacheVersion: CACHE_VERSION,
        source: testUrl,
        version: '3.0',
        versionFull: '3.0.3',
        validation: {
          etag: '"abc123"',
          cachedAt: Date.now(),
        },
        document: { openapi: '3.0.3', info: { title: 'Test', version: '1.0' }, paths: {} },
      };

      const isValid = await validateUrlCache(testUrl, entry);
      expect(isValid).toBe(false);
    });

    it('should send both If-None-Match and If-Modified-Since when available', async () => {
      mockFetch.mockResolvedValueOnce({ status: 304 });

      const entry: CacheEntry = {
        cacheVersion: CACHE_VERSION,
        source: testUrl,
        version: '3.0',
        versionFull: '3.0.3',
        validation: {
          etag: '"abc123"',
          lastModified: 'Wed, 01 Jan 2025 00:00:00 GMT',
          cachedAt: Date.now(),
        },
        document: { openapi: '3.0.3', info: { title: 'Test', version: '1.0' }, paths: {} },
      };

      await validateUrlCache(testUrl, entry);

      expect(mockFetch).toHaveBeenCalledWith(
        testUrl,
        expect.objectContaining({
          headers: {
            'If-None-Match': '"abc123"',
            'If-Modified-Since': 'Wed, 01 Jan 2025 00:00:00 GMT',
          },
        }),
      );
    });
  });

  describe('getCachedUrlSpec / cacheUrlSpec', () => {
    const testUrl = 'https://api.example.com/openapi.json';

    it('should return null when no cache exists', async () => {
      const cached = await getCachedUrlSpec(testUrl, workspaceDir);
      expect(cached).toBeNull();
    });

    it('should cache and retrieve spec with valid ETag', async () => {
      const spec = createTestSpec(testUrl);
      const headers = new Headers({ etag: '"abc123"' });

      // Cache the spec
      const cacheResult = await cacheUrlSpec(testUrl, spec, headers, workspaceDir);
      expect(cacheResult).toBe(true);

      // Mock validation to return 304
      mockFetch.mockResolvedValueOnce({ status: 304 });

      // Retrieve from cache
      const cached = await getCachedUrlSpec(testUrl, workspaceDir);
      expect(cached).not.toBeNull();
      expect(cached?.version).toBe('3.0');
      expect(cached?.source).toBe(testUrl);
    });

    it('should invalidate cache when server returns 200', async () => {
      const spec = createTestSpec(testUrl);
      const headers = new Headers({ etag: '"abc123"' });

      // Cache the spec
      await cacheUrlSpec(testUrl, spec, headers, workspaceDir);

      // Mock validation to return 200 (changed)
      mockFetch.mockResolvedValueOnce({ status: 200 });

      // Should return null (cache invalidated)
      const cached = await getCachedUrlSpec(testUrl, workspaceDir);
      expect(cached).toBeNull();
    });

    it('should invalidate cache on network error', async () => {
      const spec = createTestSpec(testUrl);
      const headers = new Headers({ etag: '"abc123"' });

      // Cache the spec
      await cacheUrlSpec(testUrl, spec, headers, workspaceDir);

      // Mock validation to fail
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Should return null (conservative - treat as stale)
      const cached = await getCachedUrlSpec(testUrl, workspaceDir);
      expect(cached).toBeNull();
    });

    it('should cache spec without validation headers', async () => {
      const spec = createTestSpec(testUrl);
      const headers = new Headers(); // No ETag or Last-Modified

      // Cache the spec
      const cacheResult = await cacheUrlSpec(testUrl, spec, headers, workspaceDir);
      expect(cacheResult).toBe(true);

      // Without validation headers, cache cannot be validated
      // Should return null immediately (no HEAD request)
      const cached = await getCachedUrlSpec(testUrl, workspaceDir);
      expect(cached).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
