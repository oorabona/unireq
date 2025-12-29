import type { RequestContext } from '@unireq/core';
import { describe, expect, it, vi } from 'vitest';
import { conditional, etag, lastModified } from '../conditional.js';

// Helper to cast headers to Record<string, string> for tests
const asHeaders = (headers: unknown) => headers as Record<string, string>;

describe('conditional requests', () => {
  describe('etag', () => {
    it('should cache responses with ETag', async () => {
      const cache = new Map();
      const policy = etag({ cache });

      const next = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: { etag: '"abc123"' },
        data: { message: 'Hello' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/data',
        method: 'GET',
        headers: {},
      };

      const response = await policy(ctx, next);

      expect(response.status).toBe(200);
      expect(cache.size).toBe(1);
      expect(cache.get('GET:/data')).toBeDefined();
      expect(cache.get('GET:/data')?.etag).toBe('"abc123"');
    });

    it('should return cached data on cache hit', async () => {
      const cache = new Map();
      const policy = etag({ cache, ttl: 10000 });

      const next = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: { etag: '"abc123"' },
        data: { message: 'Hello' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/data',
        method: 'GET',
        headers: {},
      };

      // First request - cache miss
      await policy(ctx, next);
      expect(next).toHaveBeenCalledTimes(1);

      // Second request - cache hit
      next.mockClear();
      const response2 = await policy(ctx, next);

      expect(next).not.toHaveBeenCalled();
      expect(response2.status).toBe(200);
      expect(asHeaders(response2.headers)['x-cache']).toBe('HIT');
      expect(response2.data).toEqual({ message: 'Hello' });
    });

    it('should send If-None-Match on expired cache', async () => {
      const cache = new Map();
      const policy = etag({ cache, ttl: 10 }); // 10ms TTL

      const next = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: { etag: '"abc123"' },
        data: { message: 'Hello' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/data',
        method: 'GET',
        headers: {},
      };

      // First request
      await policy(ctx, next);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Second request - should send If-None-Match
      next.mockClear();
      await policy(ctx, next);

      expect(next).toHaveBeenCalledWith({
        url: '/data',
        method: 'GET',
        headers: { 'if-none-match': '"abc123"' },
      });
    });

    it('should handle 304 Not Modified', async () => {
      const cache = new Map();
      const policy = etag({ cache, ttl: 10 });

      let requestCount = 0;
      const next = vi.fn(async (_ctx: RequestContext) => {
        requestCount++;
        if (requestCount === 1) {
          // First request - return with ETag
          return {
            status: 200,
            statusText: 'OK',
            headers: { etag: '"abc123"' },
            data: { message: 'Hello' },
            ok: true,
          };
        }
        // Second request - return 304
        return {
          status: 304,
          statusText: 'Not Modified',
          headers: { etag: '"abc123"' },
          data: null,
          ok: false,
        };
      });

      const ctx: RequestContext = {
        url: '/data',
        method: 'GET',
        headers: {},
      };

      // First request
      await policy(ctx, next);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Second request - should get cached data on 304
      const response2 = await policy(ctx, next);

      expect(response2.status).toBe(200);
      expect(asHeaders(response2.headers)['x-cache']).toBe('REVALIDATED');
      expect(response2.data).toEqual({ message: 'Hello' });
    });

    it('should only apply to GET and HEAD requests', async () => {
      const cache = new Map();
      const policy = etag({ cache });

      const next = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: { etag: '"abc123"' },
        data: { message: 'Created' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/data',
        method: 'POST',
        headers: {},
      };

      await policy(ctx, next);

      // Should not cache POST requests
      expect(cache.size).toBe(0);
    });

    it('should call onCacheHit callback', async () => {
      const onCacheHit = vi.fn();
      const cache = new Map();
      const policy = etag({ cache, onCacheHit, ttl: 10000 });

      const next = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: { etag: '"abc123"' },
        data: { message: 'Hello' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/data',
        method: 'GET',
        headers: {},
      };

      // First request
      await policy(ctx, next);

      // Second request - cache hit
      await policy(ctx, next);

      expect(onCacheHit).toHaveBeenCalledWith('GET:/data', '"abc123"');
    });

    it('should call onRevalidated callback', async () => {
      const onRevalidated = vi.fn();
      const cache = new Map();
      const policy = etag({ cache, onRevalidated, ttl: 10 });

      let requestCount = 0;
      const next = vi.fn(async () => {
        requestCount++;
        if (requestCount === 1) {
          return {
            status: 200,
            statusText: 'OK',
            headers: { etag: '"abc123"' },
            data: { message: 'Hello' },
            ok: true,
          };
        }
        return {
          status: 304,
          statusText: 'Not Modified',
          headers: { etag: '"abc123"' },
          data: null,
          ok: false,
        };
      });

      const ctx: RequestContext = {
        url: '/data',
        method: 'GET',
        headers: {},
      };

      // First request
      await policy(ctx, next);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Second request - revalidation
      await policy(ctx, next);

      expect(onRevalidated).toHaveBeenCalledWith('GET:/data', '"abc123"');
    });

    it('should use custom cache key generator', async () => {
      const getCacheKey = (ctx: { url: string; method: string }) => `custom:${ctx.url}`;
      const cache = new Map();
      const policy = etag({ cache, getCacheKey });

      const next = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: { etag: '"abc123"' },
        data: { message: 'Hello' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/data',
        method: 'GET',
        headers: {},
      };

      await policy(ctx, next);

      expect(cache.has('custom:/data')).toBe(true);
    });

    it('should not cache responses without ETag', async () => {
      const cache = new Map();
      const policy = etag({ cache });

      const next = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { message: 'Hello' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/data',
        method: 'GET',
        headers: {},
      };

      await policy(ctx, next);

      expect(cache.size).toBe(0);
    });

    it('should not cache error responses', async () => {
      const cache = new Map();
      const policy = etag({ cache });

      const next = vi.fn(async () => ({
        status: 404,
        statusText: 'Not Found',
        headers: { etag: '"abc123"' },
        data: { error: 'Not found' },
        ok: false,
      }));

      const ctx: RequestContext = {
        url: '/data',
        method: 'GET',
        headers: {},
      };

      await policy(ctx, next);

      expect(cache.size).toBe(0);
    });
  });

  describe('lastModified', () => {
    it('should cache responses with Last-Modified', async () => {
      const cache = new Map();
      const policy = lastModified({ cache });

      const next = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: { 'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT' },
        data: { message: 'Hello' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/data',
        method: 'GET',
        headers: {},
      };

      const response = await policy(ctx, next);

      expect(response.status).toBe(200);
      expect(cache.size).toBe(1);
      expect(cache.get('GET:/data')?.lastModified).toBe('Wed, 21 Oct 2015 07:28:00 GMT');
    });

    it('should return cached data on cache hit', async () => {
      const cache = new Map();
      const policy = lastModified({ cache, ttl: 10000 });

      const next = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: { 'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT' },
        data: { message: 'Hello' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/data',
        method: 'GET',
        headers: {},
      };

      // First request
      await policy(ctx, next);

      // Second request - cache hit
      next.mockClear();
      const response2 = await policy(ctx, next);

      expect(next).not.toHaveBeenCalled();
      expect(response2.status).toBe(200);
      expect(asHeaders(response2.headers)['x-cache']).toBe('HIT');
      expect(response2.data).toEqual({ message: 'Hello' });
    });

    it('should send If-Modified-Since on expired cache', async () => {
      const cache = new Map();
      const policy = lastModified({ cache, ttl: 10 });

      const next = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: { 'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT' },
        data: { message: 'Hello' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/data',
        method: 'GET',
        headers: {},
      };

      // First request
      await policy(ctx, next);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Second request - should send If-Modified-Since
      next.mockClear();
      await policy(ctx, next);

      expect(next).toHaveBeenCalledWith({
        url: '/data',
        method: 'GET',
        headers: { 'if-modified-since': 'Wed, 21 Oct 2015 07:28:00 GMT' },
      });
    });

    it('should handle 304 Not Modified', async () => {
      const cache = new Map();
      const policy = lastModified({ cache, ttl: 10 });

      let requestCount = 0;
      const next = vi.fn(async () => {
        requestCount++;
        if (requestCount === 1) {
          return {
            status: 200,
            statusText: 'OK',
            headers: { 'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT' },
            data: { message: 'Hello' },
            ok: true,
          };
        }
        return {
          status: 304,
          statusText: 'Not Modified',
          headers: { 'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT' },
          data: null,
          ok: false,
        };
      });

      const ctx: RequestContext = {
        url: '/data',
        method: 'GET',
        headers: {},
      };

      // First request
      await policy(ctx, next);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Second request - should get cached data on 304
      const response2 = await policy(ctx, next);

      expect(response2.status).toBe(200);
      expect(asHeaders(response2.headers)['x-cache']).toBe('REVALIDATED');
      expect(response2.data).toEqual({ message: 'Hello' });
    });

    it('should only apply to GET and HEAD requests', async () => {
      const cache = new Map();
      const policy = lastModified({ cache });

      const next = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: { 'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT' },
        data: { message: 'Created' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/data',
        method: 'POST',
        headers: {},
      };

      await policy(ctx, next);

      expect(cache.size).toBe(0);
    });

    it('should call callbacks', async () => {
      const onCacheHit = vi.fn();
      const onRevalidated = vi.fn();
      const cache = new Map();
      const policy = lastModified({ cache, onCacheHit, onRevalidated, ttl: 10 });

      let requestCount = 0;
      const next = vi.fn(async () => {
        requestCount++;
        if (requestCount === 1) {
          // First request
          return {
            status: 200,
            statusText: 'OK',
            headers: { 'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT' },
            data: { message: 'Hello' },
            ok: true,
          };
        }
        if (requestCount === 2) {
          // Third request (after cache expires) returns 304
          return {
            status: 304,
            statusText: 'Not Modified',
            headers: { 'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT' },
            data: null,
            ok: false,
          };
        }
        // Should not reach here
        throw new Error('Unexpected request');
      });

      const ctx: RequestContext = {
        url: '/data',
        method: 'GET',
        headers: {},
      };

      // First request
      await policy(ctx, next);
      expect(requestCount).toBe(1);

      // Second request - cache hit
      await policy(ctx, next);
      expect(requestCount).toBe(1); // No new request
      expect(onCacheHit).toHaveBeenCalledWith('GET:/data', 'Wed, 21 Oct 2015 07:28:00 GMT');

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Third request - revalidation
      await policy(ctx, next);
      expect(requestCount).toBe(2); // New request made
      expect(onRevalidated).toHaveBeenCalledWith('GET:/data', 'Wed, 21 Oct 2015 07:28:00 GMT');
    });
  });

  describe('conditional', () => {
    it('should prefer ETag over Last-Modified', async () => {
      const policy = conditional({ ttl: 10000 });

      const next = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: {
          etag: '"abc123"',
          'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
        },
        data: { message: 'Hello' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/data',
        method: 'GET',
        headers: {},
      };

      // First request
      await policy(ctx, next);

      // Second request - should use ETag
      next.mockClear();
      const response2 = await policy(ctx, next);

      expect(next).not.toHaveBeenCalled();
      expect(asHeaders(response2.headers)['etag']).toBe('"abc123"');
    });

    it('should fall back to Last-Modified when no ETag', async () => {
      const policy = conditional({ ttl: 10000 });

      const next = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: {
          'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
        },
        data: { message: 'Hello' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/data',
        method: 'GET',
        headers: {},
      };

      // First request
      await policy(ctx, next);

      // Second request - should use Last-Modified
      next.mockClear();
      const response2 = await policy(ctx, next);

      expect(next).not.toHaveBeenCalled();
      expect(asHeaders(response2.headers)['last-modified']).toBe('Wed, 21 Oct 2015 07:28:00 GMT');
    });

    it('should handle mixed responses', async () => {
      const policy = conditional({ ttl: 10000 });

      let _requestCount = 0;
      const next = vi.fn(async (ctx: RequestContext) => {
        _requestCount++;
        if (ctx.url === '/with-etag') {
          return {
            status: 200,
            statusText: 'OK',
            headers: { etag: '"abc123"' } as Record<string, string>,
            data: { type: 'etag' },
            ok: true,
          };
        }
        return {
          status: 200,
          statusText: 'OK',
          headers: { 'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT' } as Record<string, string>,
          data: { type: 'lastModified' },
          ok: true,
        };
      });

      // Request with ETag
      const ctx1: RequestContext = {
        url: '/with-etag',
        method: 'GET',
        headers: {},
      };
      await policy(ctx1, next);

      // Request with Last-Modified
      const ctx2: RequestContext = {
        url: '/with-lastmod',
        method: 'GET',
        headers: {},
      };
      await policy(ctx2, next);

      // Both should be cached
      next.mockClear();

      const response1 = await policy(ctx1, next);
      expect(response1.data).toEqual({ type: 'etag' });

      const response2 = await policy(ctx2, next);
      expect(response2.data).toEqual({ type: 'lastModified' });

      expect(next).not.toHaveBeenCalled();
    });

    it('should not cache non-GET/HEAD requests', async () => {
      const policy = conditional({ ttl: 10000 });

      const next = vi.fn(async () => ({
        status: 201,
        statusText: 'Created',
        headers: {
          etag: '"abc123"',
          'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT',
        },
        data: { message: 'Created' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/data',
        method: 'POST',
        headers: {},
      };

      // POST request should not be cached
      await policy(ctx, next);

      // Verify next was called directly without caching logic
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should cache with default TTL when not provided', async () => {
      const policy = conditional(); // No TTL specified

      const next = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: { etag: '"default-ttl"' },
        data: { message: 'Hello' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/data',
        method: 'GET',
        headers: {},
      };

      await policy(ctx, next);

      // Should use default TTL (300000ms = 5 minutes)
      // Test cache is active
      next.mockClear();
      await policy(ctx, next);
      expect(next).not.toHaveBeenCalled(); // Cache hit
    });

    it('should cache Last-Modified with default TTL when not provided', async () => {
      const policy = conditional(); // No TTL specified

      const next = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: { 'last-modified': 'Thu, 17 Oct 2024 10:00:00 GMT' },
        data: { message: 'Hello' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/data',
        method: 'GET',
        headers: {},
      };

      await policy(ctx, next);

      // Should use default TTL
      next.mockClear();
      const response = await policy(ctx, next);
      expect(next).not.toHaveBeenCalled();
      expect(asHeaders(response.headers)['last-modified']).toBe('Thu, 17 Oct 2024 10:00:00 GMT');
    });

    it('should cache Last-Modified when no ETag is available', async () => {
      const policy = conditional({ ttl: 10000 });

      const next = vi.fn(async () => ({
        status: 200,
        statusText: 'OK',
        headers: { 'last-modified': 'Thu, 17 Oct 2024 10:00:00 GMT' },
        data: { message: 'Hello' },
        ok: true,
      }));

      const ctx: RequestContext = {
        url: '/data',
        method: 'GET',
        headers: {},
      };

      // First request
      await policy(ctx, next);

      // Second request - should use Last-Modified cache
      next.mockClear();
      const response = await policy(ctx, next);
      expect(next).not.toHaveBeenCalled();
      expect(asHeaders(response.headers)['last-modified']).toBe('Thu, 17 Oct 2024 10:00:00 GMT');
    });
  });
});
