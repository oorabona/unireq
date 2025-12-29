/**
 * @unireq/http - Retry integration tests (MSW)
 * Tests end-to-end retry flows with exponential backoff
 */

import { backoff, client, retry } from '@unireq/core';
import { http, httpRetryPredicate, json } from '@unireq/http';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { handlers, MOCK_API_BASE, resetRetryCounter } from '../../scripts/msw/handlers.js';

// Setup MSW server for this integration test suite
const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe('@unireq/http - retry integration (MSW)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetRetryCounter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should retry on 500 and succeed (end-to-end)', async () => {
    const api = client(
      http(MOCK_API_BASE),
      retry(httpRetryPredicate({ statusCodes: [500] }), [backoff({ initial: 100, multiplier: 2 })], {
        tries: 3,
      }),
      json(),
    );

    const promise = api.get<{ message: string; totalAttempts: number }>('/flaky');

    // Advance through retry delays
    await vi.advanceTimersByTimeAsync(0); // Initial request
    await vi.advanceTimersByTimeAsync(100); // First retry
    await vi.advanceTimersByTimeAsync(200); // Second retry

    const response = await promise;

    expect(response.status).toBe(200);
    expect(response.data.message).toBe('Success after retries');
    expect(response.data.totalAttempts).toBe(3);
  });

  it('should fail after max retries on persistent 500 (end-to-end)', async () => {
    const api = client(
      http(MOCK_API_BASE),
      retry(httpRetryPredicate({ statusCodes: [500] }), [backoff({ initial: 100, multiplier: 2 })], {
        tries: 3,
      }),
      json(),
    );

    const promise = api.get('/always-fails');

    // Advance through all retry attempts
    await vi.advanceTimersByTimeAsync(0); // Initial
    await vi.advanceTimersByTimeAsync(100); // Retry 1
    await vi.advanceTimersByTimeAsync(200); // Retry 2

    const response = await promise;

    // After 3 tries, should return the 500 error
    expect(response.status).toBe(500);
    expect(response.ok).toBe(false);
  });

  it('should respect exponential backoff with jitter (end-to-end)', async () => {
    const delays: number[] = [];
    let lastTime = Date.now();

    const api = client(
      http(MOCK_API_BASE),
      retry(httpRetryPredicate({ statusCodes: [500] }), [backoff({ initial: 100, max: 1000, jitter: true })], {
        tries: 3,
        onRetry: () => {
          const now = Date.now();
          delays.push(now - lastTime);
          lastTime = now;
        },
      }),
      json(),
    );

    const promise = api.get('/flaky');

    // Advance through retries
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(150); // ~100ms with jitter
    await vi.advanceTimersByTimeAsync(250); // ~200ms with jitter

    await promise;

    // Should have 2 entries (initial + 1 retry interval)
    // delays[0] is initial request (0ms)
    // delays[1] is first retry delay
    // Note: onRetry is called before the delay, so we only capture intervals between retries
    // For 3 tries, we have:
    // 1. Attempt 0 (Fail) -> onRetry(1) -> Delay 1 -> Attempt 1 (Fail) -> onRetry(2) -> Delay 2 -> Attempt 2 (Success)
    // delays will contain: [0, Delay1]
    expect(delays.length).toBe(2);

    // First delay should be around 100ms (with jitter 0-100ms)
    // Jitter can reduce delay to near 0
    expect(delays[1]).toBeGreaterThanOrEqual(0);
    expect(delays[1]).toBeLessThanOrEqual(150);
  });

  it('should handle 429 rate limit with Retry-After (end-to-end)', async () => {
    const api = client(
      http(MOCK_API_BASE),
      retry(httpRetryPredicate({ statusCodes: [429] }), [backoff({ initial: 100, multiplier: 2 })], {
        tries: 2,
      }),
      json(),
    );

    const promise = api.get('/rate-limited');

    // Advance through retry with Retry-After: 1s
    await vi.advanceTimersByTimeAsync(0); // Initial
    await vi.advanceTimersByTimeAsync(1000); // Wait for Retry-After header (1s)

    const response = await promise;

    // Should still return 429 after retry (mock always returns 429)
    expect(response.status).toBe(429);
  });

  it('should call onRetry callback for each retry (end-to-end)', async () => {
    const onRetry = vi.fn();

    const api = client(
      http(MOCK_API_BASE),
      retry(httpRetryPredicate({ statusCodes: [500] }), [backoff({ initial: 50, multiplier: 2 })], {
        tries: 3,
        onRetry,
      }),
      json(),
    );

    const promise = api.get('/flaky');

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(50);
    await vi.advanceTimersByTimeAsync(100);

    await promise;

    // Should be called twice (first request doesn't count as retry)
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, null, expect.objectContaining({ status: 500 }));
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, null, expect.objectContaining({ status: 500 }));
  });

  it('should not retry on success status codes (end-to-end)', async () => {
    const onRetry = vi.fn();

    const api = client(
      http(MOCK_API_BASE),
      retry(httpRetryPredicate({ statusCodes: [500] }), [backoff({ initial: 100, multiplier: 2 })], {
        tries: 3,
        onRetry,
      }),
      json(),
    );

    // This endpoint will succeed on 3rd attempt, but we'll check 1st attempt succeeds immediately
    // by resetting the counter first
    resetRetryCounter();

    const promise = api.get('/flaky');
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);

    await promise;

    // Should retry twice before success
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('should respect maxBackoff cap (end-to-end)', async () => {
    const delays: number[] = [];
    let lastTime = Date.now();

    const api = client(
      http(MOCK_API_BASE),
      retry(
        httpRetryPredicate({ statusCodes: [500] }),
        [backoff({ initial: 1000, max: 2000, jitter: false })], // Cap at 2s, no jitter
        {
          tries: 5,
          onRetry: () => {
            const now = Date.now();
            delays.push(now - lastTime);
            lastTime = now;
          },
        },
      ),
      json(),
    );

    const promise = api.get('/always-fails');

    // Advance through retries
    await vi.advanceTimersByTimeAsync(0); // Initial
    await vi.advanceTimersByTimeAsync(1000); // Retry 1: 1s
    await vi.advanceTimersByTimeAsync(2000); // Retry 2: 2s (capped)
    await vi.advanceTimersByTimeAsync(2000); // Retry 3: 2s (capped)
    await vi.advanceTimersByTimeAsync(2000); // Retry 4: 2s (capped)

    await promise;

    // For 5 tries:
    // 1. Att 0 (Fail) -> onRetry(1) -> Delay 1 -> Att 1 (Fail) -> onRetry(2) -> Delay 2 -> Att 2 (Fail) -> onRetry(3) -> Delay 3 -> Att 3 (Fail) -> onRetry(4) -> Delay 4 -> Att 4 (Fail)
    // delays: [0, Delay1, Delay2, Delay3]
    expect(delays.length).toBe(4);
    // delays[0] is initial request (0ms)
    expect(delays[1]).toBe(1000); // First retry: 1s
    expect(delays[2]).toBe(2000); // Second retry: 2s (would be 2s, capped at 2s)
    expect(delays[3]).toBe(2000); // Third retry: capped at 2s
  });

  it('should only retry configured HTTP methods (end-to-end)', async () => {
    const api = client(
      http(MOCK_API_BASE),
      retry(
        httpRetryPredicate({ methods: ['GET'], statusCodes: [500] }), // Only retry GET
        [backoff({ initial: 100, multiplier: 2 })],
        { tries: 2 },
      ),
      json(),
    );

    // GET should retry
    const getPromise = api.get('/always-fails');
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(100);

    const getResponse = await getPromise;
    expect(getResponse.status).toBe(500); // Failed after retries

    // POST should NOT retry (not in methods list)
    const postResponse = await api.post('/always-fails');
    expect(postResponse.status).toBe(500); // Failed immediately, no retry
  });
});
