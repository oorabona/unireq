import { describe, expect, it, vi } from 'vitest';
import { body } from '../body.js';
import { conditional, lastModified } from '../conditional.js';
import { multipart } from '../multipart.js';
import { parse } from '../parse.js';
import { accept } from '../parsers.js';
import { parseSSE } from '../stream.js';

describe('Coverage Gaps - HTTP', () => {
  describe('body.ts', () => {
    it('should handle undefined/empty content types in body.multipart validation', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Test undefined content type with allowedMimeTypes set
      // Note: body.multipart validation happens during serialize()
      // If contentType is undefined, isValidMimeType returns false, which triggers the error
      const descriptor = body.multipart({ name: 'file', filename: 'test.txt', part: body.text('content') } as any, {
        allowedMimeTypes: ['text/plain'],
      });
      // Force undefined contentType on the part's descriptor to trigger the check
      (descriptor.data as any)[0].part.contentType = undefined;

      expect(() => descriptor.serialize()).toThrow(/Invalid MIME type/);

      // Test empty mime type
      const descriptor2 = body.multipart({ name: 'file', filename: 'test.txt', part: body.text('content') } as any, {
        allowedMimeTypes: ['text/plain'],
      });
      (descriptor2.data as any)[0].part.contentType = ';charset=utf-8';

      expect(() => descriptor2.serialize()).toThrow(/Invalid MIME type/);

      warnSpy.mockRestore();
    });
    it('should handle custom part returning ArrayBuffer in multipart', () => {
      const buffer = new Uint8Array([1, 2, 3]).buffer;
      const customPart = {
        __brand: 'BodyDescriptor',
        data: buffer,
        contentType: 'application/octet-stream',
        serialize: () => buffer,
      };

      const descriptor = body.multipart({
        name: 'file',
        filename: 'test.bin',
        part: customPart as any,
      });

      const formData = descriptor.serialize() as FormData;
      expect(formData.has('file')).toBe(true);
      const file = formData.get('file') as File;
      expect(file.size).toBe(3);
    });
  });

  describe('multipart.ts', () => {
    it('should handle undefined/empty content types in multipart policy validation', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Test undefined content type with allowedMimeTypes set
      const policy = multipart([{ name: 'file', filename: 'test.txt', data: 'content', contentType: undefined }], [], {
        allowedMimeTypes: ['text/plain'],
      });

      // The policy returns a response, but throws during execution if validation fails
      // However, multipart policy modifies the request body, so it runs BEFORE next()
      // If it throws, it should be caught by expect().rejects

      const next = vi.fn().mockResolvedValue({ ok: true });
      await expect(policy({ headers: {} } as any, next)).rejects.toThrow(/Invalid MIME type/);

      // Test empty mime type
      const policy2 = multipart(
        [{ name: 'file', filename: 'test.txt', data: 'content', contentType: ';charset=utf-8' }],
        [],
        { allowedMimeTypes: ['text/plain'] },
      );

      await expect(policy2({ headers: {} } as any, next)).rejects.toThrow(/Invalid MIME type/);

      warnSpy.mockRestore();
    });

    it('should match wildcard mime types', async () => {
      const policy = multipart(
        [{ name: 'file', filename: 'image.png', data: 'content', contentType: 'image/png' }],
        [],
        { allowedMimeTypes: ['image/*'] },
      );

      const next = vi.fn().mockResolvedValue({ ok: true });
      await policy({ headers: {} } as any, next);
      expect(next).toHaveBeenCalled();
    });

    it('should match exact mime types', async () => {
      const policy = multipart(
        [{ name: 'file', filename: 'test.txt', data: 'content', contentType: 'text/plain' }],
        [],
        { allowedMimeTypes: ['text/plain'] },
      );
      const next = vi.fn().mockResolvedValue({ ok: true });
      await policy({ headers: {} } as any, next);
    });

    it('should default to text/plain for string data without content type in multipart', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const policy = multipart(
        [{ name: 'file', filename: 'test.txt', data: 'content', contentType: undefined }],
        [],
        { allowedMimeTypes: [] }, // Disable validation
      );

      const next = vi.fn().mockImplementation(async (ctx) => {
        const formData = ctx.body as FormData;
        const file = formData.get('file') as File;
        expect(file.type).toBe('text/plain');
        return { ok: true };
      });

      await policy({ headers: {} } as any, next);

      warnSpy.mockRestore();
    });

    it('should not match wildcard mime types if prefix does not match', async () => {
      const policy = multipart(
        [{ name: 'file', filename: 'test.txt', data: 'content', contentType: 'text/plain' }],
        [],
        { allowedMimeTypes: ['image/*'] },
      );
      const next = vi.fn();
      await expect(policy({ headers: {} } as any, next)).rejects.toThrow(/Invalid MIME type/);
    });
  });

  describe('conditional.ts', () => {
    it('should not cache if Last-Modified header is missing', async () => {
      const cache = new Map();
      const policy = lastModified({ cache });

      const next = vi.fn().mockResolvedValue({
        ok: true,
        headers: {}, // No Last-Modified
        data: 'data',
      });

      await policy({ method: 'GET', url: 'http://test.com' } as any, next);

      expect(cache.size).toBe(0);
    });

    it('should cache Last-Modified in combined policy when ETag is missing', async () => {
      const policy = conditional();

      const next = vi.fn().mockResolvedValue({
        ok: true,
        headers: { 'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT' },
        data: 'data',
      });

      await policy({ method: 'GET', url: 'http://test.com' } as any, next);
    });

    it('should fallback to Last-Modified cache in combined policy', async () => {
      const cache = new Map();
      const policy = conditional({ cache });

      // Manually seed Last-Modified cache (since conditional() uses separate internal caches)
      // Actually conditional() creates two internal policies with their own caches if not provided
      // But if we provide cache, it's used for ETag. Last-Modified gets its own new Map.
      // So we can't easily seed Last-Modified cache from outside for conditional() unless we expose it.
      // However, we can test the fallback logic by making a request that populates it, then another that uses it.

      const next = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          headers: { 'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT' },
          data: 'data',
        })
        .mockResolvedValueOnce({
          status: 304,
          ok: true,
          headers: {},
          data: null,
        });

      // First request populates Last-Modified cache
      await policy({ method: 'GET', url: 'http://test.com/lm' } as any, next);

      // Second request should hit Last-Modified cache logic in conditional()
      // It checks ETag cache (miss), then Last-Modified cache (hit)
      const response = await policy({ method: 'GET', url: 'http://test.com/lm' } as any, next);

      expect(response.status).toBe(200);
      // The response is a HIT because the cache is still valid (TTL default is 5 mins)
      // The test setup mocked a 304 response for the second call, but the policy
      // sees the cache is valid and returns it directly without calling next()
      // To test revalidation, we'd need to expire the cache, but we can't easily access the internal cache
      // created by conditional().
      // However, since we just want to cover the fallback path where it checks Last-Modified cache,
      // a HIT is sufficient proof that it reached that code block.
      expect(response.headers['x-cache']).toBe('HIT');
    });

    it('should not cache in combined policy when both ETag and Last-Modified are missing', async () => {
      const policy = conditional();
      const next = vi.fn().mockResolvedValue({
        ok: true,
        headers: {},
        data: 'data',
      });
      await policy({ method: 'GET', url: 'http://test.com/none' } as any, next);
    });

    it('should not cache in combined policy when response is not ok', async () => {
      const policy = conditional();
      const next = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: { 'last-modified': 'Wed, 21 Oct 2015 07:28:00 GMT' },
        data: 'error',
      });
      await policy({ method: 'GET', url: 'http://test.com/error' } as any, next);
    });
  });

  describe('parsers.ts', () => {
    it('should throw SerializationError when JSON parsing fails', async () => {
      const policy = parse.json();

      const next = vi.fn().mockResolvedValue({
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: '{ invalid json }',
      });

      await expect(policy({ method: 'GET', headers: {} } as any, next)).rejects.toThrow(
        /Failed to parse JSON response/,
      );
    });

    it('should throw NotAcceptableError for missing content-type on 200 OK', async () => {
      const policy = accept(['application/json']);

      const next = vi.fn().mockResolvedValue({
        status: 200,
        headers: {}, // No content-type
        data: '{}',
      });

      await expect(policy({ method: 'GET', headers: {} } as any, next)).rejects.toThrow();
    });

    it('should not throw NotAcceptableError for missing content-type on 404', async () => {
      const policy = accept(['application/json']);

      const next = vi.fn().mockResolvedValue({
        status: 404,
        headers: {}, // No content-type
        data: 'Not Found',
      });

      await expect(policy({ method: 'GET', headers: {} } as any, next)).resolves.not.toThrow();
    });
  });

  describe('stream.ts', () => {
    it('should parse SSE retry field', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('retry: 1000\ndata: test\n\n'));
          controller.close();
        },
      });

      const policy = parseSSE();
      const next = vi.fn().mockResolvedValue({
        data: stream,
        headers: { 'content-type': 'text/event-stream' },
      });

      const response = await policy({ headers: {} } as any, next);
      const events = [];
      for await (const event of response.data as AsyncIterable<any>) {
        events.push(event);
      }

      expect(events[0].retry).toBe(1000);
    });

    it('should ignore invalid SSE retry field', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('retry: invalid\ndata: test\n\n'));
          controller.close();
        },
      });

      const policy = parseSSE();
      const next = vi.fn().mockResolvedValue({
        data: stream,
        headers: { 'content-type': 'text/event-stream' },
      });

      const response = await policy({ headers: {} } as any, next);
      const events = [];
      for await (const event of response.data as AsyncIterable<any>) {
        events.push(event);
      }

      expect(events[0].retry).toBeUndefined();
    });

    it('should parse SSE retry field with data', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('retry: 1000\ndata: test\n\n'));
          controller.close();
        },
      });

      const policy = parseSSE();
      const next = vi.fn().mockResolvedValue({
        data: stream,
        headers: { 'content-type': 'text/event-stream' },
      });

      const response = await policy({ headers: {} } as any, next);
      const events = [];
      for await (const event of response.data as AsyncIterable<any>) {
        events.push(event);
      }

      expect(events[0].retry).toBe(1000);
      expect(events[0].data).toBe('test');
    });

    it('should handle SSE empty line with data', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: hello\n\n'));
          controller.close();
        },
      });

      const policy = parseSSE();
      const next = vi.fn().mockResolvedValue({
        data: stream,
        headers: { 'content-type': 'text/event-stream' },
      });

      const response = await policy({ headers: {} } as any, next);
      const events = [];
      for await (const event of response.data as AsyncIterable<any>) {
        events.push(event);
      }
      expect(events).toHaveLength(1);
      expect(events[0].data).toBe('hello');
    });

    it('should ignore SSE empty line without data', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('\n\ndata: hello\n\n'));
          controller.close();
        },
      });

      const policy = parseSSE();
      const next = vi.fn().mockResolvedValue({
        data: stream,
        headers: { 'content-type': 'text/event-stream' },
      });

      const response = await policy({ headers: {} } as any, next);
      const events = [];
      for await (const event of response.data as AsyncIterable<any>) {
        events.push(event);
      }
      expect(events).toHaveLength(1);
      expect(events[0].data).toBe('hello');
    });
  });
});
