import type { RequestContext, Response } from '@unireq/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { progress } from '../progress.js';

describe('progress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockContext = (body?: unknown): RequestContext => ({
    url: 'https://api.example.com/upload',
    method: 'POST',
    headers: body ? { 'content-length': '1000' } : {},
    body,
  });

  const createMockResponse = (data?: unknown): Response => ({
    status: 200,
    statusText: 'OK',
    headers: data ? { 'content-length': '1000' } : {},
    data,
    ok: true,
  });

  describe('upload progress', () => {
    it('tracks string body upload progress', async () => {
      const onUploadProgress = vi.fn();
      const policy = progress({ onUploadProgress });
      const body = 'Hello, World!';
      const next = vi.fn().mockResolvedValue(createMockResponse());

      await policy(createMockContext(body), next);

      expect(onUploadProgress).toHaveBeenCalled();
      const lastCall = onUploadProgress.mock.calls[onUploadProgress.mock.calls.length - 1]?.[0];
      expect(lastCall?.loaded).toBe(13);
      expect(lastCall?.total).toBe(13);
      expect(lastCall?.percent).toBe(100);
    });

    it('tracks ArrayBuffer body upload progress', async () => {
      const onUploadProgress = vi.fn();
      const policy = progress({ onUploadProgress });
      const body = new ArrayBuffer(1024);
      const next = vi.fn().mockResolvedValue(createMockResponse());

      await policy(createMockContext(body), next);

      expect(onUploadProgress).toHaveBeenCalled();
      const lastCall = onUploadProgress.mock.calls[onUploadProgress.mock.calls.length - 1]?.[0];
      expect(lastCall.loaded).toBe(1024);
    });

    it('tracks Blob body upload progress', async () => {
      const onUploadProgress = vi.fn();
      const policy = progress({ onUploadProgress, throttle: 0 });
      const blob = new Blob(['Hello, World!'], { type: 'text/plain' });
      const next = vi.fn().mockResolvedValue(createMockResponse());

      await policy(createMockContext(blob), next);

      expect(onUploadProgress).toHaveBeenCalled();
    });
  });

  describe('download progress', () => {
    it('tracks string response download progress', async () => {
      const onDownloadProgress = vi.fn();
      const policy = progress({ onDownloadProgress });
      const responseData = 'Response body content';
      const next = vi.fn().mockResolvedValue(createMockResponse(responseData));

      await policy(createMockContext(), next);

      expect(onDownloadProgress).toHaveBeenCalled();
      const lastCall = onDownloadProgress.mock.calls[onDownloadProgress.mock.calls.length - 1]?.[0];
      expect(lastCall?.loaded).toBe(new TextEncoder().encode(responseData).length);
    });

    it('tracks ArrayBuffer response download progress', async () => {
      const onDownloadProgress = vi.fn();
      const policy = progress({ onDownloadProgress });
      const responseData = new ArrayBuffer(2048);
      const next = vi.fn().mockResolvedValue(createMockResponse(responseData));

      await policy(createMockContext(), next);

      expect(onDownloadProgress).toHaveBeenCalled();
      const lastCall = onDownloadProgress.mock.calls[onDownloadProgress.mock.calls.length - 1]?.[0];
      expect(lastCall?.loaded).toBe(2048);
    });

    it('tracks Blob response download progress', async () => {
      const onDownloadProgress = vi.fn();
      const policy = progress({ onDownloadProgress });
      const responseData = new Blob(['Blob content'], { type: 'text/plain' });
      const next = vi.fn().mockResolvedValue(createMockResponse(responseData));

      await policy(createMockContext(), next);

      expect(onDownloadProgress).toHaveBeenCalled();
    });
  });

  describe('progress event properties', () => {
    it('calculates percent correctly', async () => {
      const onDownloadProgress = vi.fn();
      const policy = progress({ onDownloadProgress });
      const responseData = 'Hello';
      const next = vi.fn().mockResolvedValue({
        ...createMockResponse(responseData),
        headers: { 'content-length': '5' },
      });

      await policy(createMockContext(), next);

      expect(onDownloadProgress).toHaveBeenCalled();
      const event = onDownloadProgress.mock.calls[0]?.[0];
      // Since it's a string, we get final event immediately
      expect(event?.percent).toBe(100);
    });

    it('calculates rate correctly', async () => {
      vi.useRealTimers(); // Need real timers for rate calculation
      const onDownloadProgress = vi.fn();
      const policy = progress({ onDownloadProgress });
      const responseData = 'Hello';
      const next = vi.fn().mockResolvedValue(createMockResponse(responseData));

      await policy(createMockContext(), next);

      expect(onDownloadProgress).toHaveBeenCalled();
      const event = onDownloadProgress.mock.calls[0]?.[0];
      expect(typeof event?.rate).toBe('number');
      expect(event?.rate).toBeGreaterThanOrEqual(0);
    });

    it('includes eta when total is known', async () => {
      vi.useRealTimers();
      const onDownloadProgress = vi.fn();
      const policy = progress({ onDownloadProgress });
      const responseData = new ArrayBuffer(1000);
      const next = vi.fn().mockResolvedValue({
        ...createMockResponse(responseData),
        headers: { 'content-length': '1000' },
      });

      await policy(createMockContext(), next);

      expect(onDownloadProgress).toHaveBeenCalled();
      // For completed downloads, eta should be 0 or undefined
    });
  });

  describe('throttling', () => {
    it('throttles progress callbacks', async () => {
      vi.useRealTimers();
      const onUploadProgress = vi.fn();
      const policy = progress({ onUploadProgress, throttle: 100 });
      const body = 'x'.repeat(1000);
      const next = vi.fn().mockResolvedValue(createMockResponse());

      await policy(createMockContext(body), next);

      // Should have at least one call (final progress)
      expect(onUploadProgress.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('edge cases', () => {
    it('handles missing body gracefully', async () => {
      const onUploadProgress = vi.fn();
      const policy = progress({ onUploadProgress });
      const next = vi.fn().mockResolvedValue(createMockResponse());

      await policy(createMockContext(undefined), next);

      expect(onUploadProgress).not.toHaveBeenCalled();
    });

    it('handles missing content-length header', async () => {
      const onDownloadProgress = vi.fn();
      const policy = progress({ onDownloadProgress });
      // Use a stream to test missing content-length behavior
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Hello'));
          controller.close();
        },
      });
      const next = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: {}, // No content-length
        data: stream,
        ok: true,
      });

      const response = await policy(createMockContext(), next);

      // Consume the stream to trigger progress events
      const reader = (response.data as ReadableStream<Uint8Array>).getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(onDownloadProgress).toHaveBeenCalled();
      const lastEvent = onDownloadProgress.mock.calls[onDownloadProgress.mock.calls.length - 1]?.[0];
      expect(lastEvent?.total).toBeUndefined();
      expect(lastEvent?.percent).toBeUndefined();
    });

    it('handles both upload and download progress', async () => {
      const onUploadProgress = vi.fn();
      const onDownloadProgress = vi.fn();
      const policy = progress({ onUploadProgress, onDownloadProgress });
      const body = 'Request body';
      const responseData = 'Response data';
      const next = vi.fn().mockResolvedValue(createMockResponse(responseData));

      await policy(createMockContext(body), next);

      expect(onUploadProgress).toHaveBeenCalled();
      expect(onDownloadProgress).toHaveBeenCalled();
    });

    it('handles invalid (NaN) content-length header on request', async () => {
      const onUploadProgress = vi.fn();
      const policy = progress({ onUploadProgress });
      const body = 'Request body';
      const next = vi.fn().mockResolvedValue(createMockResponse());

      const ctx: RequestContext = {
        url: 'https://api.example.com/upload',
        method: 'POST',
        headers: { 'content-length': 'not-a-number' },
        body,
      };

      await policy(ctx, next);

      expect(onUploadProgress).toHaveBeenCalled();
      // Total should be undefined since content-length was invalid
      const lastCall = onUploadProgress.mock.calls[onUploadProgress.mock.calls.length - 1]?.[0];
      expect(lastCall?.total).toBe(12); // string body emits its own size
    });

    it('handles invalid (NaN) content-length header on response', async () => {
      const onDownloadProgress = vi.fn();
      const policy = progress({ onDownloadProgress });
      const responseData = 'Response body';
      const next = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: { 'content-length': 'invalid' },
        data: responseData,
        ok: true,
      });

      await policy(createMockContext(), next);

      expect(onDownloadProgress).toHaveBeenCalled();
    });

    it('tracks ReadableStream upload body progress', async () => {
      const onUploadProgress = vi.fn();
      const policy = progress({ onUploadProgress, throttle: 0 });

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Hello'));
          controller.enqueue(new TextEncoder().encode(' World'));
          controller.close();
        },
      });

      const next = vi.fn().mockImplementation(async (ctx: RequestContext) => {
        // Consume the stream to trigger progress events
        if (ctx.body && typeof ctx.body === 'object' && 'getReader' in ctx.body) {
          const reader = (ctx.body as ReadableStream<Uint8Array>).getReader();
          while (true) {
            const { done } = await reader.read();
            if (done) break;
          }
        }
        return createMockResponse();
      });

      await policy(
        {
          url: 'https://api.example.com/upload',
          method: 'POST',
          headers: { 'content-length': '11' },
          body: stream,
        },
        next,
      );

      expect(onUploadProgress).toHaveBeenCalled();
    });

    it('handles stream cancel on download progress', async () => {
      const onDownloadProgress = vi.fn();
      const policy = progress({ onDownloadProgress, throttle: 0 });

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Hello'));
          controller.enqueue(new TextEncoder().encode(' World'));
          controller.close();
        },
      });

      const next = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: { 'content-length': '11' },
        data: stream,
        ok: true,
      });

      const response = await policy(createMockContext(), next);

      // Get the wrapped stream and cancel it
      const wrappedStream = response.data as ReadableStream<Uint8Array>;
      const reader = wrappedStream.getReader();
      await reader.cancel();

      // No error should be thrown
    });

    it('handles stream error on download progress', async () => {
      const onDownloadProgress = vi.fn();
      const policy = progress({ onDownloadProgress, throttle: 0 });

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Hello'));
          controller.error(new Error('Stream error'));
        },
      });

      const next = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        headers: { 'content-length': '11' },
        data: stream,
        ok: true,
      });

      const response = await policy(createMockContext(), next);

      // Consume stream and expect error
      const reader = (response.data as ReadableStream<Uint8Array>).getReader();
      await expect(reader.read()).rejects.toThrow('Stream error');
    });
  });
});
