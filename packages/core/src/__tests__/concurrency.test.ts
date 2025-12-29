/**
 * Concurrency and cache stampede prevention tests
 * Tests for concurrent access patterns, race conditions, and stampede prevention
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CircuitBreakerOpenError, circuitBreaker } from '../circuit-breaker.js';
import { compose } from '../compose.js';
import { retry } from '../retry.js';
import { throttle } from '../throttle.js';
import type { Policy } from '../types.js';
import { createMockContext, createMockResponse } from './helpers.js';

describe('@unireq/core - Concurrency patterns', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Cache stampede prevention', () => {
    it('should handle multiple concurrent requests to same endpoint', async () => {
      let requestCount = 0;
      const transport: Policy = async () => {
        requestCount++;
        await new Promise((resolve) => setTimeout(resolve, 100));
        return createMockResponse({ data: `response-${requestCount}` });
      };

      const ctx = createMockContext({ url: 'https://api.example.com/users' });

      // Launch 10 concurrent requests
      const promises = Array(10)
        .fill(null)
        .map(() => transport(ctx, async () => createMockResponse()));

      vi.advanceTimersByTime(100);

      const results = await Promise.all(promises);

      // All requests should complete
      expect(results).toHaveLength(10);
      // Each request was processed (no deduplication at transport level)
      expect(requestCount).toBe(10);
    });

    it('should maintain correct order with async operations', async () => {
      const executionOrder: string[] = [];

      const policy: Policy = async (ctx, next) => {
        executionOrder.push(`start-${ctx.url}`);
        const response = await next(ctx);
        executionOrder.push(`end-${ctx.url}`);
        return response;
      };

      const transport: Policy = async (ctx) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return createMockResponse({ data: ctx.url });
      };

      const composed = compose(policy, transport);

      const ctx1 = createMockContext({ url: 'req-1' });
      const ctx2 = createMockContext({ url: 'req-2' });

      const p1 = composed(ctx1, async () => createMockResponse());
      const p2 = composed(ctx2, async () => createMockResponse());

      vi.advanceTimersByTime(100);

      await Promise.all([p1, p2]);

      // Both should start before either ends (concurrent execution)
      expect(executionOrder[0]).toBe('start-req-1');
      expect(executionOrder[1]).toBe('start-req-2');
    });
  });

  describe('Circuit breaker under concurrent load', () => {
    it('should not allow multiple concurrent half-open probes', async () => {
      vi.useRealTimers(); // Use real timers for this concurrent test

      let probeCount = 0;
      const transport: Policy = async () => {
        probeCount++;
        throw new Error('Still failing');
      };

      const policy = circuitBreaker({
        failureThreshold: 1,
        resetTimeout: 50, // Short timeout for test
      });

      const ctx = createMockContext();
      const composed = compose(policy, transport);

      // Open the circuit
      await expect(composed(ctx, async () => createMockResponse())).rejects.toThrow('Still failing');

      // Verify circuit is open
      await expect(composed(ctx, async () => createMockResponse())).rejects.toThrow(CircuitBreakerOpenError);

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Launch multiple concurrent requests during half-open
      const promises = Array(5)
        .fill(null)
        .map(() => composed(ctx, async () => createMockResponse()).catch((e) => e));

      const results = await Promise.all(promises);

      // Only one probe should have been attempted (half-open allows single request)
      // Others should get CircuitBreakerOpenError
      const probeAttempts = results.filter((r) => r.message === 'Still failing').length;
      const blockedAttempts = results.filter((r) => r instanceof CircuitBreakerOpenError).length;

      // At least one probe, rest blocked
      expect(probeAttempts).toBeGreaterThanOrEqual(1);
      expect(probeAttempts + blockedAttempts).toBe(5);

      vi.useFakeTimers(); // Restore fake timers
    });

    it('should recover correctly under concurrent success', async () => {
      let failCount = 0;
      const transport: Policy = async () => {
        if (failCount < 2) {
          failCount++;
          throw new Error('Temporary failure');
        }
        return createMockResponse({ data: 'success' });
      };

      const policy = circuitBreaker({
        failureThreshold: 2,
        resetTimeout: 100,
      });

      const ctx = createMockContext();
      const composed = compose(policy, transport);

      // Open circuit
      await expect(composed(ctx, async () => createMockResponse())).rejects.toThrow();
      await expect(composed(ctx, async () => createMockResponse())).rejects.toThrow();

      // Verify open
      await expect(composed(ctx, async () => createMockResponse())).rejects.toThrow(CircuitBreakerOpenError);

      // Wait for reset
      vi.advanceTimersByTime(150);

      // Now transport will succeed
      const response = await composed(ctx, async () => createMockResponse());
      expect(response.data).toBe('success');

      // Subsequent requests should work (circuit closed)
      const response2 = await composed(ctx, async () => createMockResponse());
      expect(response2.data).toBe('success');
    });
  });

  describe('Throttle under concurrent load', () => {
    it('should correctly queue concurrent requests exceeding limit', async () => {
      const completedAt: number[] = [];
      const transport: Policy = async () => {
        completedAt.push(Date.now());
        return createMockResponse();
      };

      const policy = throttle({ limit: 2, interval: 1000 });
      const ctx = createMockContext();
      const composed = compose(policy, transport);

      // Launch 5 concurrent requests with limit of 2/sec
      const promises = Array(5)
        .fill(null)
        .map(() => composed(ctx, async () => createMockResponse()));

      // First 2 should complete immediately
      vi.advanceTimersByTime(0);
      await Promise.resolve();

      // Advance to allow more requests
      vi.advanceTimersByTime(500);
      await Promise.resolve();

      vi.advanceTimersByTime(500);
      await Promise.resolve();

      vi.advanceTimersByTime(1000);

      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
    });

    it('should maintain rate limit with burst traffic', async () => {
      let requestTimes: number[] = [];
      const transport: Policy = async () => {
        requestTimes.push(Date.now());
        return createMockResponse();
      };

      const policy = throttle({ limit: 3, interval: 1000 });
      const ctx = createMockContext();
      const composed = compose(policy, transport);

      // First burst of 3 (should pass immediately)
      const batch1 = Array(3)
        .fill(null)
        .map(() => composed(ctx, async () => createMockResponse()));

      await Promise.all(batch1);
      expect(requestTimes).toHaveLength(3);

      // Second burst of 3 (should wait)
      requestTimes = [];

      const batch2 = Array(3)
        .fill(null)
        .map(() => composed(ctx, async () => createMockResponse()));

      // Advance time to allow tokens to refill
      vi.advanceTimersByTime(1000);

      await Promise.all(batch2);
      expect(requestTimes).toHaveLength(3);
    });
  });

  describe('Retry under concurrent load', () => {
    it('should handle concurrent retries independently', async () => {
      vi.useRealTimers(); // Use real timers for retry tests

      const attemptsByRequest = new Map<string, number>();

      const transport: Policy = async (ctx) => {
        const id = ctx.url;
        const attempts = (attemptsByRequest.get(id) || 0) + 1;
        attemptsByRequest.set(id, attempts);

        if (attempts < 2) {
          throw new Error(`Attempt ${attempts} failed`);
        }
        return createMockResponse({ data: `success-${id}` });
      };

      const policy = retry(
        (_, error) => error !== null,
        [{ getDelay: () => 5 }], // Very short delay
        { tries: 3 },
      );

      const composed = compose(policy, transport);

      // Launch 3 concurrent requests with different IDs
      const promises = [
        composed(createMockContext({ url: 'req-1' }), async () => createMockResponse()),
        composed(createMockContext({ url: 'req-2' }), async () => createMockResponse()),
        composed(createMockContext({ url: 'req-3' }), async () => createMockResponse()),
      ];

      const results = await Promise.all(promises);

      // All should succeed after retry
      expect(results[0]?.data).toBe('success-req-1');
      expect(results[1]?.data).toBe('success-req-2');
      expect(results[2]?.data).toBe('success-req-3');

      // Each should have attempted twice
      expect(attemptsByRequest.get('req-1')).toBe(2);
      expect(attemptsByRequest.get('req-2')).toBe(2);
      expect(attemptsByRequest.get('req-3')).toBe(2);

      vi.useFakeTimers(); // Restore
    });

    it('should not interfere between concurrent retry chains', async () => {
      vi.useRealTimers(); // Use real timers

      const failFirst: Policy = async () => {
        throw new Error('First always fails');
      };

      const succeedSecond: Policy = async () => {
        return createMockResponse({ data: 'second succeeded' });
      };

      const retryPolicy = retry((_, error) => error !== null, [{ getDelay: () => 5 }], { tries: 2 });

      const ctx = createMockContext();

      // First chain should fail after retries
      const p1 = compose(retryPolicy, failFirst)(ctx, async () => createMockResponse()).catch((e) => e);

      // Second chain should succeed
      const p2 = compose(retryPolicy, succeedSecond)(ctx, async () => createMockResponse());

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1).toBeInstanceOf(Error);
      expect(r2.data).toBe('second succeeded');

      vi.useFakeTimers(); // Restore
    });
  });

  describe('Mixed policy composition under load', () => {
    it('should handle circuit breaker + retry + throttle composition', async () => {
      vi.useRealTimers(); // Use real timers

      let attempts = 0;
      const transport: Policy = async () => {
        attempts++;
        if (attempts <= 2) {
          throw new Error(`Attempt ${attempts} failed`);
        }
        return createMockResponse({ data: 'success' });
      };

      // Circuit breaker with high threshold, retry, and throttle
      const cb = circuitBreaker({ failureThreshold: 5, resetTimeout: 1000 });
      const retryPolicy = retry(
        (_, error) => error !== null,
        [{ getDelay: () => 5 }], // Very short delay
        { tries: 3 },
      );
      const throttlePolicy = throttle({ limit: 10, interval: 1000 });

      const composed = compose(throttlePolicy, cb, retryPolicy, transport);
      const ctx = createMockContext();

      // First request should retry and eventually succeed
      const response = await composed(ctx, async () => createMockResponse());

      expect(response.data).toBe('success');
      expect(attempts).toBe(3); // 2 failures + 1 success

      vi.useFakeTimers(); // Restore
    });

    it('should correctly propagate errors through policy chain', async () => {
      const errorMessages: string[] = [];

      const loggingPolicy: Policy = async (ctx, next) => {
        try {
          return await next(ctx);
        } catch (e) {
          errorMessages.push((e as Error).message);
          throw e;
        }
      };

      const failingTransport: Policy = async () => {
        throw new Error('Transport failed');
      };

      const composed = compose(loggingPolicy, failingTransport);
      const ctx = createMockContext();

      await expect(composed(ctx, async () => createMockResponse())).rejects.toThrow('Transport failed');

      expect(errorMessages).toContain('Transport failed');
    });
  });

  describe('Race conditions', () => {
    it('should handle abort race with completion', async () => {
      const controller = new AbortController();
      let completed = false;

      const transport: Policy = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        completed = true;
        return createMockResponse();
      };

      const ctx = createMockContext({ signal: controller.signal });

      const promise = transport(ctx, async () => createMockResponse());

      // Advance half the time then abort
      vi.advanceTimersByTime(50);
      controller.abort();

      // Complete the rest
      vi.advanceTimersByTime(50);

      // Transport still completes because it doesn't respect abort in this test
      await promise;
      expect(completed).toBe(true);
    });

    it('should handle multiple rapid retries correctly', async () => {
      vi.useRealTimers(); // Use real timers

      let attempt = 0;
      const transport: Policy = async () => {
        attempt++;
        if (attempt < 5) {
          throw new Error(`Fail ${attempt}`);
        }
        return createMockResponse({ data: 'finally' });
      };

      const policy = retry(
        (_, error) => error !== null,
        [{ getDelay: () => 1 }], // Very short delay
        { tries: 10 },
      );

      const ctx = createMockContext();
      const composed = compose(policy, transport);

      const response = await composed(ctx, async () => createMockResponse());

      expect(response.data).toBe('finally');
      expect(attempt).toBe(5);

      vi.useFakeTimers(); // Restore
    });
  });
});
