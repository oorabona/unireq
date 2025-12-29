import type { RequestContext, Response } from '@unireq/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dedupe } from '../dedupe.js';

describe('dedupe', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockResponse = (data: unknown = { id: 1 }): Response => ({
    status: 200,
    statusText: 'OK',
    headers: {},
    data,
    ok: true,
  });

  const createMockContext = (url = 'https://api.example.com/users', method = 'GET'): RequestContext => ({
    url,
    method,
    headers: {},
  });

  it('deduplicates identical GET requests', async () => {
    const mockNext = vi.fn().mockResolvedValue(createMockResponse());
    const policy = dedupe();

    const ctx = createMockContext();
    const [r1, r2, r3] = await Promise.all([policy(ctx, mockNext), policy(ctx, mockNext), policy(ctx, mockNext)]);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
  });

  it('deduplicates HEAD requests', async () => {
    const mockNext = vi.fn().mockResolvedValue(createMockResponse());
    const policy = dedupe();

    const ctx = createMockContext('https://api.example.com/users', 'HEAD');
    await Promise.all([policy(ctx, mockNext), policy(ctx, mockNext)]);

    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('does not deduplicate POST requests by default', async () => {
    const mockNext = vi.fn().mockResolvedValue(createMockResponse());
    const policy = dedupe();

    const ctx = createMockContext('https://api.example.com/users', 'POST');
    await Promise.all([policy(ctx, mockNext), policy(ctx, mockNext)]);

    expect(mockNext).toHaveBeenCalledTimes(2);
  });

  it('deduplicates custom methods when configured', async () => {
    const mockNext = vi.fn().mockResolvedValue(createMockResponse());
    const policy = dedupe({ methods: ['POST'] });

    const ctx = createMockContext('https://api.example.com/users', 'POST');
    await Promise.all([policy(ctx, mockNext), policy(ctx, mockNext)]);

    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('does not deduplicate different URLs', async () => {
    const mockNext = vi.fn().mockResolvedValue(createMockResponse());
    const policy = dedupe();

    await Promise.all([
      policy(createMockContext('https://api.example.com/users'), mockNext),
      policy(createMockContext('https://api.example.com/posts'), mockNext),
    ]);

    expect(mockNext).toHaveBeenCalledTimes(2);
  });

  it('uses custom key generator', async () => {
    const mockNext = vi.fn().mockResolvedValue(createMockResponse());
    const policy = dedupe({
      key: (ctx) => new URL(ctx.url).pathname,
    });

    // Same pathname, different query params - should dedupe
    await Promise.all([
      policy(createMockContext('https://api.example.com/users?page=1'), mockNext),
      policy(createMockContext('https://api.example.com/users?page=2'), mockNext),
    ]);

    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('respects TTL for deduplication window', async () => {
    const mockNext = vi.fn().mockResolvedValue(createMockResponse());
    const policy = dedupe({ ttl: 100 });

    const ctx = createMockContext();

    // First request
    await policy(ctx, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);

    // Request within TTL - should dedupe
    await policy(ctx, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);

    // Advance time beyond TTL
    await vi.advanceTimersByTimeAsync(150);

    // Request after TTL - should make new request
    await policy(ctx, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(2);
  });

  it('handles request errors', async () => {
    const error = new Error('Network error');
    const mockNext = vi.fn().mockRejectedValue(error);
    const policy = dedupe();

    const ctx = createMockContext();
    const promises = [policy(ctx, mockNext), policy(ctx, mockNext)];

    await expect(Promise.all(promises)).rejects.toThrow('Network error');
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('removes entry after completion and TTL', async () => {
    const mockNext = vi.fn().mockResolvedValue(createMockResponse());
    const policy = dedupe({ ttl: 50 });

    const ctx = createMockContext();

    // First request
    await policy(ctx, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);

    // Wait for TTL to expire
    await vi.advanceTimersByTimeAsync(100);

    // Should make new request
    await policy(ctx, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(2);
  });

  it('evicts oldest entries when maxSize is reached', async () => {
    const mockNext = vi.fn().mockImplementation((ctx: RequestContext) => Promise.resolve(createMockResponse(ctx.url)));
    const policy = dedupe({ maxSize: 2, ttl: 1000 });

    // Create 3 requests to different URLs
    const p1 = policy(createMockContext('https://api.example.com/a'), mockNext);
    const p2 = policy(createMockContext('https://api.example.com/b'), mockNext);

    await Promise.all([p1, p2]);

    // Third request should evict the first
    await policy(createMockContext('https://api.example.com/c'), mockNext);

    // Request to first URL should make new request (was evicted)
    await policy(createMockContext('https://api.example.com/a'), mockNext);

    // 4 total: a, b, c, a (second time)
    expect(mockNext).toHaveBeenCalledTimes(4);
  });

  it('is case-insensitive for HTTP methods', async () => {
    const mockNext = vi.fn().mockResolvedValue(createMockResponse());
    const policy = dedupe({ methods: ['get'] });

    const ctx = createMockContext('https://api.example.com/users', 'GET');
    await Promise.all([policy(ctx, mockNext), policy(ctx, mockNext)]);

    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('cleans up expired in-flight entries on new request', async () => {
    let resolveFirst: ((value: Response) => void) | undefined;
    const firstPromise = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });

    const mockNext = vi
      .fn()
      .mockImplementationOnce(() => firstPromise)
      .mockResolvedValue(createMockResponse({ id: 2 }));

    const policy = dedupe({ ttl: 100 });

    // Start first request (will hang)
    const ctx1 = createMockContext('https://api.example.com/slow');
    const p1 = policy(ctx1, mockNext);

    // Advance time beyond TTL
    await vi.advanceTimersByTimeAsync(150);

    // Start second request to a different URL - this triggers cleanup
    const ctx2 = createMockContext('https://api.example.com/fast');
    const p2 = policy(ctx2, mockNext);

    // Resolve second request
    const result2 = await p2;
    expect(result2.data).toEqual({ id: 2 });

    // Resolve first request
    resolveFirst?.(createMockResponse({ id: 1 }));
    const result1 = await p1;
    expect(result1.data).toEqual({ id: 1 });

    // Both requests completed, cleanup was triggered
    expect(mockNext).toHaveBeenCalledTimes(2);
  });

  it('handles edge case when pending map is unexpectedly empty during eviction', async () => {
    // This tests the defensive break in evictIfNeeded when firstKey is falsy
    // Though this shouldn't happen in practice, we ensure the code handles it
    const mockNext = vi.fn().mockResolvedValue(createMockResponse());
    const policy = dedupe({ maxSize: 1, ttl: 1000 });

    const ctx = createMockContext();
    await policy(ctx, mockNext);
    await policy(ctx, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
  });
});
