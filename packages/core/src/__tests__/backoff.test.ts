/**
 * @unireq/core - Backoff strategy tests
 */

import { describe, expect, it, vi } from 'vitest';
import { backoff } from '../backoff.js';

describe('@unireq/core - backoff', () => {
  it('should calculate exponential backoff', () => {
    const strategy = backoff({ initial: 100, max: 1000, jitter: false });

    const delay0 = strategy.getDelay(null, null, 0);
    expect(delay0).toBe(100); // 100 * 2^0

    const delay1 = strategy.getDelay(null, null, 1);
    expect(delay1).toBe(200); // 100 * 2^1

    const delay2 = strategy.getDelay(null, null, 2);
    expect(delay2).toBe(400); // 100 * 2^2

    const delay3 = strategy.getDelay(null, null, 3);
    expect(delay3).toBe(800); // 100 * 2^3

    const delay4 = strategy.getDelay(null, null, 4);
    expect(delay4).toBe(1000); // 100 * 2^4 = 1600, capped at 1000
  });

  it('should respect max backoff', () => {
    const strategy = backoff({ initial: 1000, max: 2000, jitter: false });

    const delay0 = strategy.getDelay(null, null, 0);
    expect(delay0).toBe(1000);

    const delay1 = strategy.getDelay(null, null, 1);
    expect(delay1).toBe(2000); // 1000 * 2^1 = 2000

    const delay2 = strategy.getDelay(null, null, 2);
    expect(delay2).toBe(2000); // 1000 * 2^2 = 4000, capped at 2000

    const delay3 = strategy.getDelay(null, null, 3);
    expect(delay3).toBe(2000); // Capped at 2000
  });

  it('should add jitter when enabled', () => {
    const strategy = backoff({ initial: 100, max: 1000, jitter: true });

    // Run multiple times to ensure jitter varies
    const delays = Array.from({ length: 10 }, () => strategy.getDelay(null, null, 0));

    // All delays should be between 0 and 100
    for (const delay of delays) {
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(100);
    }

    // At least some variation (not all the same)
    const uniqueDelays = new Set(delays);
    expect(uniqueDelays.size).toBeGreaterThan(1);
  });

  it('should not add jitter when disabled', () => {
    const strategy = backoff({ initial: 100, max: 1000, jitter: false });

    const delay1 = strategy.getDelay(null, null, 0);
    const delay2 = strategy.getDelay(null, null, 0);
    const delay3 = strategy.getDelay(null, null, 0);

    expect(delay1).toBe(100);
    expect(delay2).toBe(100);
    expect(delay3).toBe(100);
  });

  it('should use default values', () => {
    const strategy = backoff();

    const delay0 = strategy.getDelay(null, null, 0);
    expect(delay0).toBeGreaterThanOrEqual(0);
    expect(delay0).toBeLessThanOrEqual(1000); // Default initial: 1000

    const delay1 = strategy.getDelay(null, null, 1);
    expect(delay1).toBeGreaterThanOrEqual(0);
    expect(delay1).toBeLessThanOrEqual(2000); // 1000 * 2^1
  });

  it('should use custom multiplier', () => {
    const strategy = backoff({ initial: 100, max: 10000, multiplier: 3, jitter: false });

    const delay0 = strategy.getDelay(null, null, 0);
    expect(delay0).toBe(100); // 100 * 3^0

    const delay1 = strategy.getDelay(null, null, 1);
    expect(delay1).toBe(300); // 100 * 3^1

    const delay2 = strategy.getDelay(null, null, 2);
    expect(delay2).toBe(900); // 100 * 3^2

    const delay3 = strategy.getDelay(null, null, 3);
    expect(delay3).toBe(2700); // 100 * 3^3
  });

  it('should ignore result and error parameters', () => {
    const strategy = backoff({ initial: 100, max: 1000, jitter: false });

    const delay1 = strategy.getDelay({ status: 500 }, null, 0);
    expect(delay1).toBe(100);

    const delay2 = strategy.getDelay(null, new Error('test'), 0);
    expect(delay2).toBe(100);

    const delay3 = strategy.getDelay({ status: 500 }, new Error('test'), 0);
    expect(delay3).toBe(100);
  });

  it('should work with different types', () => {
    const strategy = backoff<{ status: number }>({ initial: 100, max: 1000, jitter: false });

    const delay = strategy.getDelay({ status: 500 }, null, 0);
    expect(delay).toBe(100);
  });

  it('should handle attempt 0', () => {
    const strategy = backoff({ initial: 100, max: 1000, jitter: false });

    const delay = strategy.getDelay(null, null, 0);
    expect(delay).toBe(100); // 100 * 2^0 = 100
  });

  it('should handle large attempt numbers', () => {
    const strategy = backoff({ initial: 1, max: 1000, jitter: false });

    const delay = strategy.getDelay(null, null, 20);
    expect(delay).toBe(1000); // 1 * 2^20 = 1048576, capped at 1000
  });

  it('should respect jitter with max cap', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const strategy = backoff({ initial: 100, max: 200, jitter: true });

    // Attempt 0: 100 * 2^0 = 100, jitter = 50
    const delay0 = strategy.getDelay(null, null, 0);
    expect(delay0).toBe(50);

    // Attempt 1: 100 * 2^1 = 200, jitter = 100
    const delay1 = strategy.getDelay(null, null, 1);
    expect(delay1).toBe(100);

    // Attempt 2: 100 * 2^2 = 400, capped at 200, jitter = 100
    const delay2 = strategy.getDelay(null, null, 2);
    expect(delay2).toBe(100);

    vi.restoreAllMocks();
  });
});
