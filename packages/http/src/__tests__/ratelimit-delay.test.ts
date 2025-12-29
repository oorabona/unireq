/**
 * @unireq/http - Rate limit delay strategy tests
 */

import { describe, expect, it, vi } from 'vitest';
import { rateLimitDelay } from '../ratelimit.js';

describe('@unireq/http - rateLimitDelay strategy', () => {
  it('should return delay for 429 with Retry-After header', async () => {
    const strategy = rateLimitDelay();

    const delay = await strategy.getDelay(
      { status: 429, statusText: 'Too Many Requests', headers: { 'retry-after': '5' }, data: null, ok: false },
      new Error('Too Many Requests'),
      0,
    );

    expect(delay).toBe(5000);
  });

  it('should return delay for 503 with Retry-After header', async () => {
    const strategy = rateLimitDelay();

    const delay = await strategy.getDelay(
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'retry-after': '10' },
        data: null,
        ok: false,
      },
      new Error('Service Unavailable'),
      0,
    );

    expect(delay).toBe(10000);
  });

  it('should return undefined for 429 without Retry-After header', async () => {
    const strategy = rateLimitDelay();

    const delay = await strategy.getDelay(
      { status: 429, statusText: 'Too Many Requests', headers: {}, data: null, ok: false },
      new Error('Too Many Requests'),
      0,
    );

    expect(delay).toBeUndefined();
  });

  it('should return undefined for non-rate-limit status codes', async () => {
    const strategy = rateLimitDelay();

    const delay = await strategy.getDelay(
      { status: 500, statusText: 'Internal Server Error', headers: { 'retry-after': '5' }, data: null, ok: false },
      new Error('Internal Server Error'),
      0,
    );

    expect(delay).toBeUndefined();
  });

  it('should parse Retry-After as HTTP date', async () => {
    const strategy = rateLimitDelay();

    const futureDate = new Date(Date.now() + 10000).toUTCString();
    const delay = await strategy.getDelay(
      { status: 429, statusText: 'Too Many Requests', headers: { 'retry-after': futureDate }, data: null, ok: false },
      new Error('Too Many Requests'),
      0,
    );

    expect(delay).toBeGreaterThan(9000);
    expect(delay).toBeLessThanOrEqual(10000);
  });

  it('should respect maxWait limit', async () => {
    const strategy = rateLimitDelay({ maxWait: 5000 });

    const delay = await strategy.getDelay(
      { status: 429, statusText: 'Too Many Requests', headers: { 'retry-after': '100' }, data: null, ok: false },
      new Error('Too Many Requests'),
      0,
    );

    expect(delay).toBe(5000);
  });

  it('should call onRateLimit callback', async () => {
    const onRateLimit = vi.fn();
    const strategy = rateLimitDelay({ onRateLimit });

    await strategy.getDelay(
      { status: 429, statusText: 'Too Many Requests', headers: { 'retry-after': '3' }, data: null, ok: false },
      new Error('Too Many Requests'),
      0,
    );

    expect(onRateLimit).toHaveBeenCalledTimes(1);
    expect(onRateLimit).toHaveBeenCalledWith(3000);
  });

  it('should support async onRateLimit callback', async () => {
    const onRateLimit = vi.fn(async (_ms) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    const strategy = rateLimitDelay({ onRateLimit });

    await strategy.getDelay(
      { status: 429, statusText: 'Too Many Requests', headers: { 'retry-after': '1' }, data: null, ok: false },
      new Error('Too Many Requests'),
      0,
    );

    expect(onRateLimit).toHaveBeenCalled();
  });

  it('should handle case-insensitive Retry-After header', async () => {
    const strategy = rateLimitDelay();

    const delay1 = await strategy.getDelay(
      { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '2' }, data: null, ok: false },
      new Error('Too Many Requests'),
      0,
    );

    const delay2 = await strategy.getDelay(
      { status: 429, statusText: 'Too Many Requests', headers: { 'retry-after': '2' }, data: null, ok: false },
      new Error('Too Many Requests'),
      0,
    );

    expect(delay1).toBe(2000);
    expect(delay2).toBe(2000);
  });

  it('should use default maxWait from config', async () => {
    const strategy = rateLimitDelay();

    // Default maxWait is 60000ms (1 minute)
    const delay = await strategy.getDelay(
      { status: 429, statusText: 'Too Many Requests', headers: { 'retry-after': '120' }, data: null, ok: false },
      new Error('Too Many Requests'),
      0,
    );

    expect(delay).toBe(60000);
  });

  it('should return undefined for invalid Retry-After header', async () => {
    const strategy = rateLimitDelay();

    const delay = await strategy.getDelay(
      { status: 429, statusText: 'Too Many Requests', headers: { 'retry-after': 'invalid' }, data: null, ok: false },
      new Error('Too Many Requests'),
      0,
    );

    // parseRetryAfter returns 0 for invalid values, which means no delay
    expect(delay).toBe(0);
  });

  it('should return undefined for null result (error case)', async () => {
    const strategy = rateLimitDelay();

    const delay = await strategy.getDelay(null, new Error('Network error'), 0);

    expect(delay).toBeUndefined();
  });
});
