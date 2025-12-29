import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { throttle } from '../throttle.js';
import type { RequestContext } from '../types.js';

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockContext: RequestContext = {
    url: 'https://example.com',
    method: 'GET',
    headers: {},
  };

  it('should allow requests within limit', async () => {
    const next = vi.fn().mockResolvedValue(new Response('ok'));
    const policy = throttle({ limit: 2, interval: 1000 });

    await policy(mockContext, next);
    await policy(mockContext, next);

    expect(next).toHaveBeenCalledTimes(2);
  });

  it('should delay requests exceeding limit', async () => {
    const next = vi.fn().mockResolvedValue(new Response('ok'));
    const policy = throttle({ limit: 1, interval: 1000 });

    // 1st request: immediate
    const p1 = policy(mockContext, next);

    // 2nd request: should wait
    const p2 = policy(mockContext, next);

    await p1;
    expect(next).toHaveBeenCalledTimes(1);

    // Advance time by 500ms (not enough)
    vi.advanceTimersByTime(500);
    expect(next).toHaveBeenCalledTimes(1);

    // Advance time by another 500ms (total 1000ms)
    vi.advanceTimersByTime(500);
    await p2;
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('should refill tokens over time', async () => {
    const next = vi.fn().mockResolvedValue(new Response('ok'));
    const policy = throttle({ limit: 1, interval: 1000 });

    await policy(mockContext, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Wait for full refill
    vi.advanceTimersByTime(1000);

    await policy(mockContext, next);
    expect(next).toHaveBeenCalledTimes(2);
  });
});
