import type { RequestContext, Response } from '@unireq/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTimingMarker, type TimedResponse, timing } from '../timing.js';

describe('timing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockContext = (): RequestContext => ({
    url: 'https://api.example.com/users',
    method: 'GET',
    headers: {},
  });

  const createMockResponse = (): Response => ({
    status: 200,
    statusText: 'OK',
    headers: {},
    data: { id: 1 },
    ok: true,
  });

  it('adds timing information to response', async () => {
    const policy = timing();
    const next = vi.fn().mockImplementation(async () => {
      await vi.advanceTimersByTimeAsync(100);
      return createMockResponse();
    });

    const response = (await policy(createMockContext(), next)) as TimedResponse;

    expect(response.timing).toBeDefined();
    expect(response.timing.total).toBeGreaterThanOrEqual(0);
    expect(response.timing.ttfb).toBeGreaterThanOrEqual(0);
    expect(response.timing.download).toBeGreaterThanOrEqual(0);
    expect(response.timing.startTime).toBeDefined();
    expect(response.timing.endTime).toBeDefined();
  });

  it('calculates correct timing values', async () => {
    const policy = timing();
    const next = vi.fn().mockImplementation(async () => {
      await vi.advanceTimersByTimeAsync(150);
      return createMockResponse();
    });

    vi.setSystemTime(1000);
    const response = (await policy(createMockContext(), next)) as TimedResponse;

    expect(response.timing.total).toBe(150);
    expect(response.timing.startTime).toBe(1000);
    expect(response.timing.endTime).toBe(1150);
  });

  it('calls onTiming callback', async () => {
    const onTiming = vi.fn();
    const policy = timing({ onTiming });
    const next = vi.fn().mockResolvedValue(createMockResponse());

    const ctx = createMockContext();
    await policy(ctx, next);

    expect(onTiming).toHaveBeenCalledTimes(1);
    expect(onTiming).toHaveBeenCalledWith(
      expect.objectContaining({
        total: expect.any(Number),
        ttfb: expect.any(Number),
        download: expect.any(Number),
      }),
      ctx,
    );
  });

  it('includes timing in headers when configured', async () => {
    const policy = timing({ includeInHeaders: true });
    const next = vi.fn().mockResolvedValue(createMockResponse());

    const response = await policy(createMockContext(), next);

    expect(response.headers['x-unireq-timing']).toBeDefined();
    const headerTiming = JSON.parse(response.headers['x-unireq-timing'] ?? '{}');
    expect(headerTiming.total).toBeDefined();
  });

  it('uses custom header name', async () => {
    const policy = timing({ includeInHeaders: true, headerName: 'x-custom-timing' });
    const next = vi.fn().mockResolvedValue(createMockResponse());

    const response = await policy(createMockContext(), next);

    expect(response.headers['x-custom-timing']).toBeDefined();
    expect(response.headers['x-unireq-timing']).toBeUndefined();
  });

  it('handles request errors', async () => {
    const onTiming = vi.fn();
    const policy = timing({ onTiming });
    const error = new Error('Network error');
    const next = vi.fn().mockImplementation(async () => {
      await vi.advanceTimersByTimeAsync(50);
      throw error;
    });

    await expect(policy(createMockContext(), next)).rejects.toThrow('Network error');

    // Should still call onTiming for errors
    expect(onTiming).toHaveBeenCalledTimes(1);
    expect(onTiming).toHaveBeenCalledWith(
      expect.objectContaining({
        total: expect.any(Number),
      }),
      expect.any(Object),
    );
  });

  it('timing info is accurate for failed requests', async () => {
    const onTiming = vi.fn();
    const policy = timing({ onTiming });
    const next = vi.fn().mockImplementation(async () => {
      await vi.advanceTimersByTimeAsync(75);
      throw new Error('Timeout');
    });

    vi.setSystemTime(0);
    await expect(policy(createMockContext(), next)).rejects.toThrow();

    const call = onTiming.mock.calls[0];
    expect(call).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: call is asserted to be defined above
    const [timingInfo] = call!;
    expect(timingInfo.total).toBe(75);
    expect(timingInfo.startTime).toBe(0);
    expect(timingInfo.endTime).toBe(75);
  });

  it('calculates timing correctly when ttfb is marked before error', async () => {
    const onTiming = vi.fn();
    const policy = timing({ onTiming });
    const next = vi.fn().mockImplementation(async (ctx: RequestContext) => {
      await vi.advanceTimersByTimeAsync(30); // Time to first byte
      const marker = getTimingMarker(ctx);
      marker?.markTtfb();
      await vi.advanceTimersByTimeAsync(20); // Partial download before error
      throw new Error('Connection reset');
    });

    vi.setSystemTime(0);
    await expect(policy(createMockContext(), next)).rejects.toThrow('Connection reset');

    const call = onTiming.mock.calls[0];
    expect(call).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: call is asserted to be defined above
    const [timingInfo] = call!;
    expect(timingInfo.ttfb).toBe(30); // ttfbTime - startTime
    expect(timingInfo.download).toBe(20); // endTime - ttfbTime
    expect(timingInfo.total).toBe(50);
  });

  it('handles errors without onTiming callback', async () => {
    const policy = timing(); // No onTiming callback
    const next = vi.fn().mockRejectedValue(new Error('Server error'));

    await expect(policy(createMockContext(), next)).rejects.toThrow('Server error');
    // Should not throw due to missing callback
  });

  describe('getTimingMarker', () => {
    it('returns undefined for context without timing', () => {
      const ctx = createMockContext();
      expect(getTimingMarker(ctx)).toBeUndefined();
    });

    it('returns timing marker from enriched context', async () => {
      const policy = timing();
      let capturedCtx: RequestContext | undefined;

      const next = vi.fn().mockImplementation((ctx: RequestContext) => {
        capturedCtx = ctx;
        return Promise.resolve(createMockResponse());
      });

      await policy(createMockContext(), next);

      expect(capturedCtx).toBeDefined();
      // biome-ignore lint/style/noNonNullAssertion: capturedCtx is asserted to be defined above
      const marker = getTimingMarker(capturedCtx!);
      expect(marker).toBeDefined();
      expect(typeof marker?.markTtfb).toBe('function');
    });

    it('markTtfb only records first call', async () => {
      const policy = timing();

      const next = vi.fn().mockImplementation(async (ctx: RequestContext) => {
        await vi.advanceTimersByTimeAsync(50);
        const marker = getTimingMarker(ctx);
        marker?.markTtfb();
        await vi.advanceTimersByTimeAsync(50);
        marker?.markTtfb(); // Second call should be ignored
        return createMockResponse();
      });

      vi.setSystemTime(0);
      const response = (await policy(createMockContext(), next)) as TimedResponse;

      // TTFB should be ~50ms (first markTtfb call)
      expect(response.timing.ttfb).toBe(50);
      // Download should be ~50ms (from first markTtfb to end)
      expect(response.timing.download).toBe(50);
    });
  });

  describe('timing components', () => {
    it('ttfb + download equals total', async () => {
      const policy = timing();

      const next = vi.fn().mockImplementation(async (ctx: RequestContext) => {
        await vi.advanceTimersByTimeAsync(30); // Simulate connection time
        const marker = getTimingMarker(ctx);
        marker?.markTtfb();
        await vi.advanceTimersByTimeAsync(70); // Simulate download time
        return createMockResponse();
      });

      const response = (await policy(createMockContext(), next)) as TimedResponse;

      expect(response.timing.ttfb + response.timing.download).toBe(response.timing.total);
    });
  });
});
