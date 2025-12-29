/**
 * @unireq/core - Generic retry policy tests
 */

import { describe, expect, it, vi } from 'vitest';
import type { RetryDelayStrategy } from '../retry.js';
import { retry } from '../retry.js';
import type { Response } from '../types.js';

describe('@unireq/core - retry policy (generic)', () => {
  it('should retry based on predicate', async () => {
    let attempt = 0;
    const predicate = vi.fn((result: Response | null) => result !== null && result.status === 500);

    const policy = retry(predicate, [], { tries: 3 });

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => {
      attempt++;
      if (attempt < 3) {
        return { status: 500, statusText: 'Internal Server Error', headers: {}, data: 'Error', ok: false };
      }
      return { status: 200, statusText: 'OK', headers: {}, data: 'Success', ok: true };
    });

    expect(attempt).toBe(3);
    expect(result.status).toBe(200);
    expect(predicate).toHaveBeenCalledTimes(3);
  });

  it('should not retry when predicate returns false', async () => {
    let attempt = 0;
    const predicate = vi.fn(() => false);

    const policy = retry(predicate, [], { tries: 3 });

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => {
      attempt++;
      return { status: 404, statusText: 'Not Found', headers: {}, data: 'Not found', ok: false };
    });

    expect(attempt).toBe(1);
    expect(result.status).toBe(404);
    expect(predicate).toHaveBeenCalledTimes(1);
  });

  it('should retry on errors when predicate allows', async () => {
    let attempt = 0;
    const predicate = vi.fn((_result, error) => error !== null);

    const policy = retry(predicate, [], { tries: 3 });

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => {
      attempt++;
      if (attempt < 3) {
        throw new Error('Network error');
      }
      return { status: 200, statusText: 'OK', headers: {}, data: 'Success', ok: true };
    });

    expect(attempt).toBe(3);
    expect(result.status).toBe(200);
    expect(predicate).toHaveBeenCalledTimes(3); // Called for 2 errors + 1 successful response
  });

  it('should apply delay strategies in order', async () => {
    vi.useFakeTimers();

    const strategy1: RetryDelayStrategy = {
      getDelay: vi.fn(() => undefined),
    };
    const strategy2: RetryDelayStrategy = {
      getDelay: vi.fn(() => 100),
    };
    const strategy3: RetryDelayStrategy = {
      getDelay: vi.fn(() => 200),
    };

    let attempt = 0;
    const predicate = vi.fn(() => true);

    const policy = retry(predicate, [strategy1, strategy2, strategy3], { tries: 2 });

    const promise = policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => {
      attempt++;
      return { status: 500, statusText: 'Error', headers: {}, data: 'Error', ok: false };
    });

    await vi.advanceTimersByTimeAsync(100);
    await promise;

    expect(attempt).toBe(2);
    expect(strategy1.getDelay).toHaveBeenCalledTimes(1);
    expect(strategy2.getDelay).toHaveBeenCalledTimes(1);
    expect(strategy3.getDelay).not.toHaveBeenCalled(); // Not called because strategy2 returned value

    vi.useRealTimers();
  });

  it('should call onRetry callback for successful responses', async () => {
    const onRetry = vi.fn();
    const predicate = vi.fn(() => true);

    let attempt = 0;
    const policy = retry(predicate, [], { tries: 3, onRetry });

    await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => {
      attempt++;
      if (attempt < 3) {
        return { status: 500, statusText: 'Error', headers: {}, data: 'Error', ok: false };
      }
      return { status: 200, statusText: 'OK', headers: {}, data: 'Success', ok: true };
    });

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, null, expect.objectContaining({ status: 500 }));
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, null, expect.objectContaining({ status: 500 }));
  });

  it('should call onRetry callback for errors', async () => {
    const onRetry = vi.fn();
    const predicate = vi.fn((_result, error) => error !== null);

    let attempt = 0;
    const policy = retry(predicate, [], { tries: 3, onRetry });

    await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => {
      attempt++;
      if (attempt < 3) {
        throw new Error(`Error ${attempt}`);
      }
      return { status: 200, statusText: 'OK', headers: {}, data: 'Success', ok: true };
    });

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error), null);
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error), null);
  });

  it('should throw error on last attempt when predicate allows retry', async () => {
    const predicate = vi.fn((_result, error) => error !== null);

    let attempt = 0;
    const policy = retry(predicate, [], { tries: 2 });

    await expect(
      policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => {
        attempt++;
        throw new Error('Persistent error');
      }),
    ).rejects.toThrow('Persistent error');

    expect(attempt).toBe(2);
  });

  it('should throw error immediately when predicate disallows retry', async () => {
    const predicate = vi.fn(() => false);

    let attempt = 0;
    const policy = retry(predicate, [], { tries: 3 });

    await expect(
      policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => {
        attempt++;
        throw new Error('Immediate error');
      }),
    ).rejects.toThrow('Immediate error');

    expect(attempt).toBe(1);
  });

  it('should support async predicates', async () => {
    let attempt = 0;
    const predicate = vi.fn(async (result: Response | null) =>
      Promise.resolve(result !== null && result.status === 500),
    );

    const policy = retry(predicate, [], { tries: 3 });

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => {
      attempt++;
      if (attempt < 2) {
        return { status: 500, statusText: 'Error', headers: {}, data: 'Error', ok: false };
      }
      return { status: 200, statusText: 'OK', headers: {}, data: 'Success', ok: true };
    });

    expect(attempt).toBe(2);
    expect(result.status).toBe(200);
  });

  it('should support async delay strategies', async () => {
    vi.useFakeTimers();

    const strategy: RetryDelayStrategy = {
      getDelay: vi.fn(async () => Promise.resolve(100)),
    };

    let attempt = 0;
    const predicate = vi.fn(() => true);

    const policy = retry(predicate, [strategy], { tries: 2 });

    const promise = policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => {
      attempt++;
      return { status: 500, statusText: 'Error', headers: {}, data: 'Error', ok: false };
    });

    await vi.advanceTimersByTimeAsync(100);
    await promise;

    expect(attempt).toBe(2);
    expect(strategy.getDelay).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('should pass context to predicate', async () => {
    const predicate = vi.fn((_result, _error, _attempt, ctx) => {
      expect(ctx).toMatchObject({
        url: 'https://example.com',
        method: 'GET',
      });
      return false;
    });

    const policy = retry(predicate, [], { tries: 3 });

    await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: 'Success',
      ok: true,
    }));

    expect(predicate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 200 }),
      null,
      0,
      expect.objectContaining({ url: 'https://example.com', method: 'GET' }),
    );
  });

  it('should handle non-Error exceptions', async () => {
    const predicate = vi.fn((_result, error) => error !== null);

    let attempt = 0;
    const policy = retry(predicate, [], { tries: 3 });

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => {
      attempt++;
      if (attempt < 3) {
        // Testing non-Error throw (string)
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'String error';
      }
      return { status: 200, statusText: 'OK', headers: {}, data: 'Success', ok: true };
    });

    expect(attempt).toBe(3);
    expect(result.status).toBe(200);
  });

  it('should handle strategies that return undefined', async () => {
    vi.useFakeTimers();
    const predicate = () => true;
    const undefinedStrategy = {
      getDelay: () => undefined,
    };
    const fixedStrategy = {
      getDelay: () => 10,
    };

    let attempt = 0;
    const policy = retry(predicate, [undefinedStrategy, fixedStrategy], { tries: 3 });

    const promise = policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => {
      attempt++;
      if (attempt < 3) {
        throw new Error('Retry error');
      }
      return { status: 200, statusText: 'OK', headers: {}, data: 'Success', ok: true };
    });

    // Advance time to cover delays (2 retries * 10ms = 20ms)
    await vi.advanceTimersByTimeAsync(20);

    const result = await promise;
    expect(attempt).toBe(3);
    expect(result.status).toBe(200);

    vi.useRealTimers();
  });

  it('should not wait when all strategies return undefined (delay = 0)', async () => {
    const predicate = () => true;
    const undefinedStrategy1 = {
      getDelay: () => undefined,
    };
    const undefinedStrategy2 = {
      getDelay: () => undefined,
    };

    let attempt = 0;
    const policy = retry(predicate, [undefinedStrategy1, undefinedStrategy2], { tries: 3 });

    const start = Date.now();
    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => {
      attempt++;
      if (attempt < 3) {
        throw new Error('Retry error');
      }
      return { status: 200, statusText: 'OK', headers: {}, data: 'Success', ok: true };
    });

    const elapsed = Date.now() - start;
    expect(attempt).toBe(3);
    expect(result.status).toBe(200);
    // Should not wait when delay = 0
    expect(elapsed).toBeLessThan(10);
  });

  it('should use default tries when options is undefined', async () => {
    const predicate = () => true;

    let attempt = 0;
    const policy = retry(predicate, []);

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => {
      attempt++;
      if (attempt < 3) {
        throw new Error('Retry error');
      }
      return { status: 200, statusText: 'OK', headers: {}, data: 'Success', ok: true };
    });

    expect(attempt).toBe(3); // Default tries = 3
    expect(result.status).toBe(200);
  });

  it('should limit total attempts', async () => {
    const predicate = vi.fn(() => true);

    let attempt = 0;
    const policy = retry(predicate, [], { tries: 2 });

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => {
      attempt++;
      return { status: 500, statusText: 'Error', headers: {}, data: `attempt ${attempt}`, ok: false };
    });

    expect(attempt).toBe(2);
    expect(result.status).toBe(500);
    expect(result.data).toBe('attempt 2');
  });

  it('should work with zero delay strategies', async () => {
    const predicate = vi.fn(() => true);

    let attempt = 0;
    const policy = retry(predicate, [], { tries: 3 });

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => {
      attempt++;
      if (attempt < 3) {
        return { status: 500, statusText: 'Error', headers: {}, data: 'Error', ok: false };
      }
      return { status: 200, statusText: 'OK', headers: {}, data: 'Success', ok: true };
    });

    expect(attempt).toBe(3);
    expect(result.status).toBe(200);
  });
});
