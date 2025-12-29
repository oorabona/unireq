/**
 * Tests for streaming body and parse functions
 */

import type { Response } from '@unireq/core';
import { describe, expect, it } from 'vitest';
import { parseSSE, parseStream, type SSEEvent, stream } from '../stream.js';

describe('@unireq/http - stream', () => {
  describe('body.stream()', () => {
    it('should create streaming body descriptor with default content type', () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      const readableStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        },
      });

      const descriptor = stream(readableStream);

      expect(descriptor.__brand).toBe('BodyDescriptor');
      expect(descriptor.contentType).toBe('application/octet-stream');
      expect(descriptor.data).toBe(readableStream);
      expect(descriptor.serialize()).toBe(readableStream);
    });

    it('should create streaming body descriptor with custom content type', () => {
      const readableStream = new ReadableStream<Uint8Array>();
      const descriptor = stream(readableStream, { contentType: 'video/mp4' });

      expect(descriptor.contentType).toBe('video/mp4');
    });

    it('should include content length when provided', () => {
      const readableStream = new ReadableStream<Uint8Array>();
      const descriptor = stream(readableStream, {
        contentType: 'application/pdf',
        contentLength: 1024000,
      });

      expect(descriptor.contentLength).toBe(1024000);
    });

    it('should not include content length when not provided', () => {
      const readableStream = new ReadableStream<Uint8Array>();
      const descriptor = stream(readableStream);

      expect(descriptor.contentLength).toBeUndefined();
    });
  });

  describe('parse.stream()', () => {
    it('should return ReadableStream as-is if response.data is already a stream', async () => {
      const mockStream = new ReadableStream<Uint8Array>();
      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: mockStream,
          ok: true,
        }) as Response;

      const policy = parseStream();
      const response = await policy({ url: '/test', method: 'GET', headers: {} }, mockNext);

      expect(response.data).toBe(mockStream);
    });

    it('should convert Blob to ReadableStream', async () => {
      const blob = new Blob(['test data']);
      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: blob,
          ok: true,
        }) as Response;

      const policy = parseStream();
      const response = await policy({ url: '/test', method: 'GET', headers: {} }, mockNext);

      expect(response.data).toBeInstanceOf(ReadableStream);

      // Read and verify stream content
      const reader = (response.data as ReadableStream<Uint8Array>).getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      const text = new TextDecoder().decode(combined);
      expect(text).toBe('test data');
    });

    it('should convert ArrayBuffer to ReadableStream', async () => {
      const buffer = new TextEncoder().encode('buffer data').buffer;
      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: buffer,
          ok: true,
        }) as Response;

      const policy = parseStream();
      const response = await policy({ url: '/test', method: 'GET', headers: {} }, mockNext);

      expect(response.data).toBeInstanceOf(ReadableStream);

      // Read and verify
      const reader = (response.data as ReadableStream<Uint8Array>).getReader();
      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      expect(text).toBe('buffer data');
    });

    it('should convert string to ReadableStream', async () => {
      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: 'string data',
          ok: true,
        }) as Response;

      const policy = parseStream();
      const response = await policy({ url: '/test', method: 'GET', headers: {} }, mockNext);

      expect(response.data).toBeInstanceOf(ReadableStream);

      const reader = (response.data as ReadableStream<Uint8Array>).getReader();
      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);
      expect(text).toBe('string data');
    });

    it('should set Accept header to application/octet-stream by default', async () => {
      let capturedContext: unknown;
      const mockNext = async (ctx: unknown) => {
        capturedContext = ctx;
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          data: new ReadableStream<Uint8Array>(),
          ok: true,
        } as Response;
      };

      const policy = parseStream();
      await policy({ url: '/test', method: 'GET', headers: {} }, mockNext);

      expect((capturedContext as any).headers['accept']).toBe('application/octet-stream');
    });

    it('should set custom Accept header', async () => {
      let capturedContext: unknown;
      const mockNext = async (ctx: unknown) => {
        capturedContext = ctx;
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          data: new ReadableStream<Uint8Array>(),
          ok: true,
        } as Response;
      };

      const policy = parseStream({ accept: 'video/mp4' });
      await policy({ url: '/test', method: 'GET', headers: {} }, mockNext);

      expect((capturedContext as any).headers['accept']).toBe('video/mp4');
    });

    it('should preserve existing Accept header', async () => {
      let capturedContext: unknown;
      const mockNext = async (ctx: unknown) => {
        capturedContext = ctx;
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          data: new ReadableStream<Uint8Array>(),
          ok: true,
        } as Response;
      };

      const policy = parseStream();
      await policy({ url: '/test', method: 'GET', headers: { Accept: 'custom/type' } }, mockNext);

      expect((capturedContext as any).headers['Accept']).toBe('custom/type');
      expect((capturedContext as any).headers['accept']).toBeUndefined();
    });

    it('should return response as-is for unknown data types', async () => {
      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: { custom: 'object' },
          ok: true,
        }) as Response;

      const policy = parseStream();
      const response = await policy({ url: '/test', method: 'GET', headers: {} }, mockNext);

      expect(response.data).toEqual({ custom: 'object' });
    });
  });

  describe('parse.sse()', () => {
    it('should parse simple SSE event', async () => {
      const sseData = 'data: Hello, World!\n\n';
      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: sseData,
          ok: true,
        }) as Response;

      const policy = parseSSE();
      const response = await policy({ url: '/events', method: 'GET', headers: {} }, mockNext);

      const events: SSEEvent[] = [];
      for await (const event of response.data as AsyncIterable<SSEEvent>) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0]?.data).toBe('Hello, World!');
      expect(events[0]?.event).toBeUndefined();
      expect(events[0]?.id).toBeUndefined();
    });

    it('should parse SSE event with id and event type', async () => {
      const sseData = 'id: 123\nevent: message\ndata: Test data\n\n';
      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: sseData,
          ok: true,
        }) as Response;

      const policy = parseSSE();
      const response = await policy({ url: '/events', method: 'GET', headers: {} }, mockNext);

      const events: SSEEvent[] = [];
      for await (const event of response.data as AsyncIterable<SSEEvent>) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0]?.id).toBe('123');
      expect(events[0]?.event).toBe('message');
      expect(events[0]?.data).toBe('Test data');
    });

    it('should parse multiple SSE events', async () => {
      const sseData = 'data: First\n\ndata: Second\n\ndata: Third\n\n';
      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: sseData,
          ok: true,
        }) as Response;

      const policy = parseSSE();
      const response = await policy({ url: '/events', method: 'GET', headers: {} }, mockNext);

      const events: SSEEvent[] = [];
      for await (const event of response.data as AsyncIterable<SSEEvent>) {
        events.push(event);
      }

      expect(events).toHaveLength(3);
      expect(events[0]?.data).toBe('First');
      expect(events[1]?.data).toBe('Second');
      expect(events[2]?.data).toBe('Third');
    });

    it('should parse multi-line data fields', async () => {
      const sseData = 'data: Line 1\ndata: Line 2\ndata: Line 3\n\n';
      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: sseData,
          ok: true,
        }) as Response;

      const policy = parseSSE();
      const response = await policy({ url: '/events', method: 'GET', headers: {} }, mockNext);

      const events: SSEEvent[] = [];
      for await (const event of response.data as AsyncIterable<SSEEvent>) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0]?.data).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should parse retry field', async () => {
      const sseData = 'retry: 5000\ndata: Test\n\n';
      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: sseData,
          ok: true,
        }) as Response;

      const policy = parseSSE();
      const response = await policy({ url: '/events', method: 'GET', headers: {} }, mockNext);

      const events: SSEEvent[] = [];
      for await (const event of response.data as AsyncIterable<SSEEvent>) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0]?.retry).toBe(5000);
    });

    it('should ignore comment lines', async () => {
      const sseData = ': This is a comment\ndata: Real data\n\n';
      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: sseData,
          ok: true,
        }) as Response;

      const policy = parseSSE();
      const response = await policy({ url: '/events', method: 'GET', headers: {} }, mockNext);

      const events: SSEEvent[] = [];
      for await (const event of response.data as AsyncIterable<SSEEvent>) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0]?.data).toBe('Real data');
    });

    it('should set Accept header to text/event-stream', async () => {
      let capturedContext: unknown;
      const mockNext = async (ctx: unknown) => {
        capturedContext = ctx;
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          data: '',
          ok: true,
        } as Response;
      };

      const policy = parseSSE();
      await policy({ url: '/events', method: 'GET', headers: {} }, mockNext);

      expect((capturedContext as any).headers['accept']).toBe('text/event-stream');
    });

    it('should handle Blob response data', async () => {
      const sseData = 'data: From blob\n\n';
      const blob = new Blob([sseData]);
      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: blob,
          ok: true,
        }) as Response;

      const policy = parseSSE();
      const response = await policy({ url: '/events', method: 'GET', headers: {} }, mockNext);

      const events: SSEEvent[] = [];
      for await (const event of response.data as AsyncIterable<SSEEvent>) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0]?.data).toBe('From blob');
    });

    it('should handle ArrayBuffer response data', async () => {
      const sseData = 'data: From buffer\n\n';
      const buffer = new TextEncoder().encode(sseData).buffer;
      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: buffer,
          ok: true,
        }) as Response;

      const policy = parseSSE();
      const response = await policy({ url: '/events', method: 'GET', headers: {} }, mockNext);

      const events: SSEEvent[] = [];
      for await (const event of response.data as AsyncIterable<SSEEvent>) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0]?.data).toBe('From buffer');
    });

    it('should handle ReadableStream response data', async () => {
      const sseData = 'data: From stream\n\n';
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sseData));
          controller.close();
        },
      });
      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: stream,
          ok: true,
        }) as Response;

      const policy = parseSSE();
      const response = await policy({ url: '/events', method: 'GET', headers: {} }, mockNext);

      const events: SSEEvent[] = [];
      for await (const event of response.data as AsyncIterable<SSEEvent>) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0]?.data).toBe('From stream');
    });

    it('should return empty async iterable for non-stream data', async () => {
      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: 123, // Non-stream type
          ok: true,
        }) as Response;

      const policy = parseSSE();
      const response = await policy({ url: '/events', method: 'GET', headers: {} }, mockNext);

      const events: SSEEvent[] = [];
      for await (const event of response.data as AsyncIterable<SSEEvent>) {
        events.push(event);
      }

      expect(events).toHaveLength(0);
    });

    it('should yield incomplete event at end of stream', async () => {
      // Event with newline-delimited fields but no final double newline (stream ends abruptly)
      const sseData = 'data: Incomplete event\n';
      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: sseData,
          ok: true,
        }) as Response;

      const policy = parseSSE();
      const response = await policy({ url: '/events', method: 'GET', headers: {} }, mockNext);

      const events: SSEEvent[] = [];
      for await (const event of response.data as AsyncIterable<SSEEvent>) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0]?.data).toBe('Incomplete event');
    });

    it('should ignore lines without colon separator', async () => {
      const sseData = 'malformed line\ndata: Valid data\n\n';
      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: sseData,
          ok: true,
        }) as Response;

      const policy = parseSSE();
      const response = await policy({ url: '/events', method: 'GET', headers: {} }, mockNext);

      const events: SSEEvent[] = [];
      for await (const event of response.data as AsyncIterable<SSEEvent>) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0]?.data).toBe('Valid data');
    });

    it('should not override existing Accept header', async () => {
      const sseData = 'data: test\n\n';
      let capturedHeaders: Record<string, string> = {};

      const mockNext = async (ctx: unknown) => {
        capturedHeaders = (ctx as { headers: Record<string, string> }).headers;
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          data: sseData,
          ok: true,
        } as Response;
      };

      const policy = parseSSE();
      await policy({ url: '/events', method: 'GET', headers: { accept: 'custom/type' } }, mockNext);

      // Should preserve existing accept header
      expect(capturedHeaders['accept']).toBe('custom/type');
    });

    it('should handle null/undefined response data (tests line 200 - empty generator)', async () => {
      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: null, // No stream data
          ok: true,
        }) as Response;

      const policy = parseSSE();
      const response = await policy({ url: '/events', method: 'GET', headers: {} }, mockNext);

      const events: SSEEvent[] = [];
      for await (const event of response.data as AsyncIterable<SSEEvent>) {
        events.push(event);
      }

      // Empty generator should yield no events
      expect(events).toHaveLength(0);
    });

    it('should handle unknown response data type (tests line 200 - empty generator)', async () => {
      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: { unknown: 'type' }, // Unknown type
          ok: true,
        }) as Response;

      const policy = parseSSE();
      const response = await policy({ url: '/events', method: 'GET', headers: {} }, mockNext);

      const events: SSEEvent[] = [];
      for await (const event of response.data as AsyncIterable<SSEEvent>) {
        events.push(event);
      }

      // Empty generator should yield no events
      expect(events).toHaveLength(0);
    });
  });
});
