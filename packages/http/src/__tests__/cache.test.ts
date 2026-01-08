import type { Policy, RequestContext, Response } from '@unireq/core';
import { describe, expect, it, vi } from 'vitest';
import { cache, MemoryCacheStorage, noCache } from '../cache.js';

// Helper to create a mock transport
function createMockTransport(responses: Response[]): Policy {
  let callIndex = 0;
  return async (_ctx, _next) => {
    const response = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    // biome-ignore lint/style/noNonNullAssertion: response is guaranteed by fallback to last response
    return response!;
  };
}

// Helper to run a policy chain
async function runPolicy(policies: Policy[], ctx: Partial<RequestContext> = {}): Promise<Response> {
  const defaultCtx: RequestContext = {
    url: 'https://api.example.com/test',
    method: 'GET',
    headers: {},
    ...ctx,
  };

  // Build policy chain (last policy is the transport)
  const chain = policies.reduceRight<(ctx: RequestContext) => Promise<Response>>(
    (next, policy) => {
      return (ctx: RequestContext) => policy(ctx, next);
    },
    async () => ({ status: 500, statusText: 'No transport', headers: {}, ok: false, data: undefined }),
  );

  return chain(defaultCtx);
}

describe('cache policy', () => {
  describe('basic caching', () => {
    it('should cache GET requests', async () => {
      const transport = createMockTransport([
        { status: 200, statusText: 'OK', headers: {}, data: { id: 1 }, ok: true },
      ]);

      const cachePolicy = cache({ defaultTtl: 60000 });

      // First request - should hit transport
      const response1 = await runPolicy([cachePolicy, transport], { url: 'https://api.example.com/users/1' });
      expect(response1.status).toBe(200);
      expect(response1.headers['x-cache']).toBe('MISS');

      // Second request - should hit cache
      const response2 = await runPolicy([cachePolicy, transport], { url: 'https://api.example.com/users/1' });
      expect(response2.status).toBe(200);
      expect(response2.headers['x-cache']).toBe('HIT');
      expect(response2.data).toEqual({ id: 1 });
    });

    it('should not cache POST requests by default', async () => {
      const transport = createMockTransport([
        { status: 200, statusText: 'OK', headers: {}, data: { id: 1 }, ok: true },
        { status: 200, statusText: 'OK', headers: {}, data: { id: 2 }, ok: true },
      ]);

      const cachePolicy = cache({ defaultTtl: 60000 });

      const response1 = await runPolicy([cachePolicy, transport], { method: 'POST' });
      const response2 = await runPolicy([cachePolicy, transport], { method: 'POST' });

      // Both should hit transport
      expect(response1.data).toEqual({ id: 1 });
      expect(response2.data).toEqual({ id: 2 });
    });

    it('should cache HEAD requests by default', async () => {
      const transport = createMockTransport([
        { status: 200, statusText: 'OK', headers: { 'content-length': '1234' }, ok: true, data: undefined },
      ]);

      const cachePolicy = cache({ defaultTtl: 60000 });

      const response1 = await runPolicy([cachePolicy, transport], { method: 'HEAD' });
      expect(response1.headers['x-cache']).toBe('MISS');

      const response2 = await runPolicy([cachePolicy, transport], { method: 'HEAD' });
      expect(response2.headers['x-cache']).toBe('HIT');
    });
  });

  describe('TTL handling', () => {
    it('should respect defaultTtl', async () => {
      vi.useFakeTimers();

      const transport = createMockTransport([
        { status: 200, statusText: 'OK', headers: {}, data: { id: 1 }, ok: true },
        { status: 200, statusText: 'OK', headers: {}, data: { id: 2 }, ok: true },
      ]);

      const cachePolicy = cache({ defaultTtl: 1000 });

      // First request
      await runPolicy([cachePolicy, transport]);

      // Advance time past TTL
      vi.advanceTimersByTime(1001);

      // Should be cache miss
      const response = await runPolicy([cachePolicy, transport]);
      expect(response.headers['x-cache']).toBe('MISS');
      expect(response.data).toEqual({ id: 2 });

      vi.useRealTimers();
    });

    it('should respect Cache-Control max-age', async () => {
      vi.useFakeTimers();

      const transport = createMockTransport([
        {
          status: 200,
          statusText: 'OK',
          headers: { 'cache-control': 'max-age=2' }, // 2 seconds
          data: { id: 1 },
          ok: true,
        },
        { status: 200, statusText: 'OK', headers: {}, data: { id: 2 }, ok: true },
      ]);

      const cachePolicy = cache({ defaultTtl: 60000 }); // 60s default

      await runPolicy([cachePolicy, transport]);

      // Should still be cached after 1s
      vi.advanceTimersByTime(1000);
      let response = await runPolicy([cachePolicy, transport]);
      expect(response.headers['x-cache']).toBe('HIT');

      // Should be expired after 2s
      vi.advanceTimersByTime(1001);
      response = await runPolicy([cachePolicy, transport]);
      expect(response.headers['x-cache']).toBe('MISS');

      vi.useRealTimers();
    });

    it('should enforce maxTtl', async () => {
      vi.useFakeTimers();

      const transport = createMockTransport([
        {
          status: 200,
          statusText: 'OK',
          headers: { 'cache-control': 'max-age=3600' }, // 1 hour
          data: { id: 1 },
          ok: true,
        },
        { status: 200, statusText: 'OK', headers: {}, data: { id: 2 }, ok: true },
      ]);

      const cachePolicy = cache({ defaultTtl: 1000, maxTtl: 500 }); // 500ms max

      await runPolicy([cachePolicy, transport]);

      // Should be expired after maxTtl
      vi.advanceTimersByTime(501);
      const response = await runPolicy([cachePolicy, transport]);
      expect(response.headers['x-cache']).toBe('MISS');

      vi.useRealTimers();
    });

    it('should respect Cache-Control s-maxage over max-age', async () => {
      vi.useFakeTimers();

      const transport = createMockTransport([
        {
          status: 200,
          statusText: 'OK',
          headers: { 'cache-control': 's-maxage=1, max-age=10' }, // s-maxage takes precedence
          data: { id: 1 },
          ok: true,
        },
        { status: 200, statusText: 'OK', headers: {}, data: { id: 2 }, ok: true },
      ]);

      const cachePolicy = cache({ defaultTtl: 60000 });

      await runPolicy([cachePolicy, transport]);

      // Should still be cached at 500ms
      vi.advanceTimersByTime(500);
      let response = await runPolicy([cachePolicy, transport]);
      expect(response.headers['x-cache']).toBe('HIT');

      // Should be expired after 1s (s-maxage)
      vi.advanceTimersByTime(501);
      response = await runPolicy([cachePolicy, transport]);
      expect(response.headers['x-cache']).toBe('MISS');

      vi.useRealTimers();
    });

    it('should return NO-CACHE when TTL calculates to zero', async () => {
      const transport = createMockTransport([
        {
          status: 200,
          statusText: 'OK',
          headers: { 'cache-control': 'max-age=0' }, // TTL of 0
          data: { id: 1 },
          ok: true,
        },
        { status: 200, statusText: 'OK', headers: {}, data: { id: 2 }, ok: true },
      ]);

      const cachePolicy = cache({ defaultTtl: 60000 });

      const response1 = await runPolicy([cachePolicy, transport]);
      expect(response1.headers['x-cache']).toBe('NO-CACHE');

      // Should hit transport again since not cached
      const response2 = await runPolicy([cachePolicy, transport]);
      expect(response2.data).toEqual({ id: 2 });
    });
  });

  describe('Cache-Control directives', () => {
    it('should not cache responses with no-store', async () => {
      const transport = createMockTransport([
        {
          status: 200,
          statusText: 'OK',
          headers: { 'cache-control': 'no-store' },
          data: { id: 1 },
          ok: true,
        },
        { status: 200, statusText: 'OK', headers: {}, data: { id: 2 }, ok: true },
      ]);

      const cachePolicy = cache({ defaultTtl: 60000 });

      const response1 = await runPolicy([cachePolicy, transport]);
      expect(response1.headers['x-cache']).toBe('NO-STORE');

      // Second request should hit transport
      const response2 = await runPolicy([cachePolicy, transport]);
      expect(response2.headers['x-cache']).toBe('MISS');
    });

    it('should skip caching when request has no-cache', async () => {
      const transport = createMockTransport([
        { status: 200, statusText: 'OK', headers: {}, data: { id: 1 }, ok: true },
        { status: 200, statusText: 'OK', headers: {}, data: { id: 2 }, ok: true },
      ]);

      const cachePolicy = cache({ defaultTtl: 60000, respectNoStore: true });

      // First request
      await runPolicy([cachePolicy, transport]);

      // Second request with no-cache header - should bypass
      const response = await runPolicy([cachePolicy, transport], {
        headers: { 'cache-control': 'no-cache' },
      });
      expect(response.data).toEqual({ id: 2 });
    });

    it('should skip caching when request has no-store', async () => {
      const transport = createMockTransport([
        { status: 200, statusText: 'OK', headers: {}, data: { id: 1 }, ok: true },
        { status: 200, statusText: 'OK', headers: {}, data: { id: 2 }, ok: true },
      ]);

      const cachePolicy = cache({ defaultTtl: 60000, respectNoStore: true });

      // First request
      await runPolicy([cachePolicy, transport]);

      // Second request with no-store header - should bypass cache
      const response = await runPolicy([cachePolicy, transport], {
        headers: { 'cache-control': 'no-store' },
      });
      expect(response.data).toEqual({ id: 2 });
    });

    it('should handle Cache-Control with multiple directives (joined header)', async () => {
      const transport = createMockTransport([
        {
          status: 200,
          statusText: 'OK',
          headers: { 'cache-control': 'max-age=60, public' },
          data: { id: 1 },
          ok: true,
        },
        { status: 200, statusText: 'OK', headers: {}, data: { id: 2 }, ok: true },
      ]);

      const cachePolicy = cache({ defaultTtl: 1000 });

      const response1 = await runPolicy([cachePolicy, transport]);
      expect(response1.headers['x-cache']).toBe('MISS');

      // Second request should hit cache (max-age=60 parsed from array)
      const response2 = await runPolicy([cachePolicy, transport]);
      expect(response2.headers['x-cache']).toBe('HIT');
      expect(response2.data).toEqual({ id: 1 });
    });
  });

  describe('conditional requests', () => {
    it('should send If-None-Match for stale entries with ETag', async () => {
      vi.useFakeTimers();

      let lastRequestHeaders: Record<string, string> = {};
      const transport: Policy = async (ctx, _next) => {
        lastRequestHeaders = ctx.headers;
        if (ctx.headers['if-none-match'] === '"abc123"') {
          return {
            status: 304,
            statusText: 'Not Modified',
            headers: {} as Record<string, string>,
            ok: false,
            data: undefined,
          };
        }
        return {
          status: 200,
          statusText: 'OK',
          headers: { etag: '"abc123"' } as Record<string, string>,
          data: { id: 1 },
          ok: true,
        };
      };

      const cachePolicy = cache({ defaultTtl: 1000, useConditionalRequests: true });

      // First request - cache miss
      await runPolicy([cachePolicy, transport]);

      // Expire cache
      vi.advanceTimersByTime(1001);

      // Second request - should send conditional request
      const response = await runPolicy([cachePolicy, transport]);
      expect(lastRequestHeaders['if-none-match']).toBe('"abc123"');
      expect(response.headers['x-cache']).toBe('REVALIDATED');
      expect(response.data).toEqual({ id: 1 });

      vi.useRealTimers();
    });

    it('should send If-Modified-Since for stale entries', async () => {
      vi.useFakeTimers();

      let lastRequestHeaders: Record<string, string> = {};
      const transport: Policy = async (ctx, _next) => {
        lastRequestHeaders = ctx.headers;
        if (ctx.headers['if-modified-since']) {
          return {
            status: 304,
            statusText: 'Not Modified',
            headers: {} as Record<string, string>,
            ok: false,
            data: undefined,
          };
        }
        return {
          status: 200,
          statusText: 'OK',
          headers: { 'last-modified': 'Wed, 21 Oct 2025 07:28:00 GMT' } as Record<string, string>,
          data: { id: 1 },
          ok: true,
        };
      };

      const cachePolicy = cache({ defaultTtl: 1000, useConditionalRequests: true });

      await runPolicy([cachePolicy, transport]);
      vi.advanceTimersByTime(1001);

      await runPolicy([cachePolicy, transport]);
      expect(lastRequestHeaders['if-modified-since']).toBe('Wed, 21 Oct 2025 07:28:00 GMT');

      vi.useRealTimers();
    });
  });

  describe('status code filtering', () => {
    it('should only cache configured status codes', async () => {
      const transport = createMockTransport([
        { status: 404, statusText: 'Not Found', headers: {}, ok: false, data: { error: 'not found' } },
        { status: 404, statusText: 'Not Found', headers: {}, data: { error: 'changed' }, ok: false },
      ]);

      const cachePolicy = cache({ defaultTtl: 60000, statusCodes: [200] });

      const response1 = await runPolicy([cachePolicy, transport]);
      expect(response1.headers['x-cache']).toBe('BYPASS');

      const response2 = await runPolicy([cachePolicy, transport]);
      expect(response2.data).toEqual({ error: 'changed' }); // Not cached
    });

    it('should cache 301 redirects by default', async () => {
      const transport = createMockTransport([
        {
          status: 301,
          statusText: 'Moved Permanently',
          headers: { location: 'https://new.example.com' },
          ok: false,
          data: undefined,
        },
      ]);

      const cachePolicy = cache({ defaultTtl: 60000 });

      const response1 = await runPolicy([cachePolicy, transport]);
      expect(response1.headers['x-cache']).toBe('MISS');

      const response2 = await runPolicy([cachePolicy, transport]);
      expect(response2.headers['x-cache']).toBe('HIT');
    });
  });

  describe('callbacks', () => {
    it('should call onHit callback', async () => {
      const onHit = vi.fn();
      const transport = createMockTransport([{ status: 200, statusText: 'OK', headers: {}, data: {}, ok: true }]);

      const cachePolicy = cache({ defaultTtl: 60000, onHit });

      await runPolicy([cachePolicy, transport]);
      await runPolicy([cachePolicy, transport]);

      expect(onHit).toHaveBeenCalledTimes(1);
      expect(onHit).toHaveBeenCalledWith('GET:https://api.example.com/test', expect.objectContaining({ data: {} }));
    });

    it('should call onMiss callback', async () => {
      const onMiss = vi.fn();
      const transport = createMockTransport([{ status: 200, statusText: 'OK', headers: {}, data: {}, ok: true }]);

      const cachePolicy = cache({ defaultTtl: 60000, onMiss });

      await runPolicy([cachePolicy, transport]);

      expect(onMiss).toHaveBeenCalledWith('GET:https://api.example.com/test');
    });

    it('should call onStore callback', async () => {
      const onStore = vi.fn();
      const transport = createMockTransport([
        { status: 200, statusText: 'OK', headers: {}, data: { id: 1 }, ok: true },
      ]);

      const cachePolicy = cache({ defaultTtl: 60000, onStore });

      await runPolicy([cachePolicy, transport]);

      expect(onStore).toHaveBeenCalledWith(
        'GET:https://api.example.com/test',
        expect.objectContaining({ data: { id: 1 } }),
      );
    });
  });

  describe('custom key generator', () => {
    it('should use custom key generator', async () => {
      const transport = createMockTransport([
        { status: 200, statusText: 'OK', headers: {}, data: { id: 1 }, ok: true },
      ]);

      // Custom key generator that ignores query params
      const keyGenerator = (ctx: RequestContext) => {
        const url = new URL(ctx.url);
        return `${ctx.method}:${url.origin}${url.pathname}`;
      };

      const cachePolicy = cache({ defaultTtl: 60000, keyGenerator });

      await runPolicy([cachePolicy, transport], { url: 'https://api.example.com/users?page=1' });
      const response = await runPolicy([cachePolicy, transport], { url: 'https://api.example.com/users?page=2' });

      // Should hit cache despite different query params
      expect(response.headers['x-cache']).toBe('HIT');
    });
  });
});

describe('MemoryCacheStorage', () => {
  it('should store and retrieve entries', () => {
    const storage = new MemoryCacheStorage();

    storage.set('key1', {
      data: { id: 1 },
      headers: {},
      status: 200,
      statusText: 'OK',
      expires: Date.now() + 60000,
    });

    const entry = storage.get('key1');
    expect(entry?.data).toEqual({ id: 1 });
  });

  it('should return expired entries (for conditional requests)', () => {
    // MemoryCacheStorage returns expired entries so the cache policy
    // can use them for conditional requests (If-None-Match, If-Modified-Since)
    const storage = new MemoryCacheStorage();

    storage.set('key1', {
      data: { id: 1 },
      headers: {},
      status: 200,
      statusText: 'OK',
      expires: Date.now() - 1000, // Already expired
    });

    const entry = storage.get('key1');
    expect(entry).toBeDefined();
    expect(entry?.data).toEqual({ id: 1 });
  });

  it('should evict oldest entries when at max size', () => {
    const storage = new MemoryCacheStorage(2);

    const expires = Date.now() + 60000;
    storage.set('key1', { data: 1, headers: {}, status: 200, statusText: 'OK', expires });
    storage.set('key2', { data: 2, headers: {}, status: 200, statusText: 'OK', expires });
    storage.set('key3', { data: 3, headers: {}, status: 200, statusText: 'OK', expires });

    expect(storage.get('key1')).toBeUndefined(); // Evicted
    expect(storage.get('key2')?.data).toBe(2);
    expect(storage.get('key3')?.data).toBe(3);
  });

  it('should update LRU order on access', () => {
    const storage = new MemoryCacheStorage(2);

    const expires = Date.now() + 60000;
    storage.set('key1', { data: 1, headers: {}, status: 200, statusText: 'OK', expires });
    storage.set('key2', { data: 2, headers: {}, status: 200, statusText: 'OK', expires });

    // Access key1 to make it more recent
    storage.get('key1');

    // Add key3 - should evict key2 (least recently used)
    storage.set('key3', { data: 3, headers: {}, status: 200, statusText: 'OK', expires });

    expect(storage.get('key1')?.data).toBe(1);
    expect(storage.get('key2')).toBeUndefined(); // Evicted
    expect(storage.get('key3')?.data).toBe(3);
  });

  it('should clear all entries', () => {
    const storage = new MemoryCacheStorage();

    storage.set('key1', {
      data: 1,
      headers: {},
      status: 200,
      statusText: 'OK',
      expires: Date.now() + 60000,
    });
    storage.set('key2', {
      data: 2,
      headers: {},
      status: 200,
      statusText: 'OK',
      expires: Date.now() + 60000,
    });

    storage.clear();

    expect(storage.get('key1')).toBeUndefined();
    expect(storage.get('key2')).toBeUndefined();
    expect(storage.size).toBe(0);
  });

  it('should delete a specific entry', () => {
    const storage = new MemoryCacheStorage();

    storage.set('key1', {
      data: 1,
      headers: {},
      status: 200,
      statusText: 'OK',
      expires: Date.now() + 60000,
    });
    storage.set('key2', {
      data: 2,
      headers: {},
      status: 200,
      statusText: 'OK',
      expires: Date.now() + 60000,
    });

    storage.delete('key1');

    expect(storage.get('key1')).toBeUndefined();
    expect(storage.get('key2')?.data).toBe(2);
    expect(storage.size).toBe(1);
  });

  it('should handle delete on LRU cache and update access order', () => {
    const storage = new MemoryCacheStorage(3);

    const expires = Date.now() + 60000;
    storage.set('key1', { data: 1, headers: {}, status: 200, statusText: 'OK', expires });
    storage.set('key2', { data: 2, headers: {}, status: 200, statusText: 'OK', expires });
    storage.set('key3', { data: 3, headers: {}, status: 200, statusText: 'OK', expires });

    // Delete middle entry
    storage.delete('key2');

    // Add new entry - should not evict key1 or key3
    storage.set('key4', { data: 4, headers: {}, status: 200, statusText: 'OK', expires });

    expect(storage.get('key1')?.data).toBe(1);
    expect(storage.get('key2')).toBeUndefined();
    expect(storage.get('key3')?.data).toBe(3);
    expect(storage.get('key4')?.data).toBe(4);
  });
});

describe('noCache policy', () => {
  it('should add no-store header to request', async () => {
    let capturedHeaders: Record<string, string> = {};
    const transport: Policy = async (ctx, _next) => {
      capturedHeaders = ctx.headers;
      return { status: 200, statusText: 'OK', headers: {}, ok: true, data: undefined };
    };

    const noCachePolicy = noCache();

    await runPolicy([noCachePolicy, transport]);

    expect(capturedHeaders['cache-control']).toBe('no-store');
  });

  it('should bypass cache when used with cache policy', async () => {
    const transport = createMockTransport([
      { status: 200, statusText: 'OK', headers: {}, data: { id: 1 }, ok: true },
      { status: 200, statusText: 'OK', headers: {}, data: { id: 2 }, ok: true },
    ]);

    const cachePolicy = cache({ defaultTtl: 60000 });
    const noCachePolicy = noCache();

    // First request - cache miss
    await runPolicy([cachePolicy, transport]);

    // Second request with noCache - should bypass
    const response = await runPolicy([noCachePolicy, cachePolicy, transport]);
    expect(response.data).toEqual({ id: 2 });
  });
});
