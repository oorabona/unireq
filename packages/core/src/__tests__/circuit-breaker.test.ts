import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CircuitBreakerOpenError, circuitBreaker } from '../circuit-breaker.js';
import type { RequestContext } from '../types.js';

describe('circuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 1, 1, 0, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockContext: RequestContext = {
    url: 'https://example.com',
    method: 'GET',
    headers: {},
  };

  it('should pass through successful requests (CLOSED state)', async () => {
    const next = vi.fn().mockResolvedValue(new Response('ok'));
    const policy = circuitBreaker({ failureThreshold: 3, resetTimeout: 1000 });

    await policy(mockContext, next);
    expect(next).toHaveBeenCalled();
  });

  it('should open circuit after threshold failures', async () => {
    const error = new Error('Network error');
    const next = vi.fn().mockRejectedValue(error);
    const policy = circuitBreaker({ failureThreshold: 2, resetTimeout: 1000 });

    // 1st failure
    await expect(policy(mockContext, next)).rejects.toThrow(error);

    // 2nd failure (threshold reached)
    await expect(policy(mockContext, next)).rejects.toThrow(error);

    // 3rd attempt -> Circuit Open
    await expect(policy(mockContext, next)).rejects.toThrow(CircuitBreakerOpenError);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('should transition to HALF_OPEN after resetTimeout', async () => {
    const error = new Error('Network error');
    const next = vi.fn().mockRejectedValue(error);
    const policy = circuitBreaker({ failureThreshold: 1, resetTimeout: 1000 });

    // Fail to open
    await expect(policy(mockContext, next)).rejects.toThrow(error);

    // Verify open
    await expect(policy(mockContext, next)).rejects.toThrow(CircuitBreakerOpenError);

    // Wait for reset
    vi.setSystemTime(new Date(Date.now() + 1100));

    // Should try again (HALF_OPEN)
    next.mockResolvedValueOnce(new Response('ok'));
    await policy(mockContext, next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('should close circuit on success in HALF_OPEN', async () => {
    const error = new Error('Network error');
    const next = vi.fn().mockRejectedValue(error);
    const policy = circuitBreaker({ failureThreshold: 1, resetTimeout: 1000 });

    // Open circuit
    await expect(policy(mockContext, next)).rejects.toThrow(error);

    // Wait for reset
    vi.setSystemTime(new Date(Date.now() + 1100));

    // Success in HALF_OPEN
    next.mockResolvedValueOnce(new Response('ok'));
    await policy(mockContext, next);

    // Should be CLOSED now (allow subsequent requests)
    next.mockResolvedValueOnce(new Response('ok'));
    await policy(mockContext, next);
    expect(next).toHaveBeenCalledTimes(3);
  });

  it('should reopen circuit on failure in HALF_OPEN', async () => {
    const error = new Error('Network error');
    const next = vi.fn().mockRejectedValue(error);
    const policy = circuitBreaker({ failureThreshold: 1, resetTimeout: 1000 });

    // Open circuit
    await expect(policy(mockContext, next)).rejects.toThrow(error);

    // Wait for reset
    vi.setSystemTime(new Date(Date.now() + 1100));

    // Fail in HALF_OPEN
    await expect(policy(mockContext, next)).rejects.toThrow(error);

    // Should be OPEN again immediately
    await expect(policy(mockContext, next)).rejects.toThrow(CircuitBreakerOpenError);
  });

  it('should respect shouldFail predicate', async () => {
    const error = new Error('Ignored error');
    const next = vi.fn().mockRejectedValue(error);
    const policy = circuitBreaker({
      failureThreshold: 1,
      shouldFail: (err) => (err as Error).message !== 'Ignored error',
    });

    // Should not count as failure
    await expect(policy(mockContext, next)).rejects.toThrow(error);

    // Should still be CLOSED
    await expect(policy(mockContext, next)).rejects.toThrow(error);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('should reset failure count on success in CLOSED state', async () => {
    const error = new Error('Network error');
    const next = vi.fn();
    const policy = circuitBreaker({ failureThreshold: 2 });

    // 1 failure
    next.mockRejectedValueOnce(error);
    await expect(policy(mockContext, next)).rejects.toThrow(error);

    // 1 success (should reset count)
    next.mockResolvedValueOnce(new Response('ok'));
    await policy(mockContext, next);

    // 1 failure (should be count 1, not 2)
    next.mockRejectedValueOnce(error);
    await expect(policy(mockContext, next)).rejects.toThrow(error);

    // Should still be CLOSED
    next.mockResolvedValueOnce(new Response('ok'));
    await policy(mockContext, next);
  });
});
