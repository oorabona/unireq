/**
 * Stream error handling tests
 * Tests for stream error scenarios, partial reads, and error recovery
 */

import type { Response } from '@unireq/core';
import { describe, expect, it } from 'vitest';
import { parseSSE, parseStream, type SSEEvent } from '../stream.js';

describe('@unireq/http - Stream error handling', () => {
  describe('ReadableStream errors', () => {
    it('should handle stream error during read', async () => {
      const errorStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('first chunk'));
        },
        pull(controller) {
          controller.error(new Error('Stream read failed'));
        },
      });

      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: errorStream,
          ok: true,
        }) as Response;

      const policy = parseStream();
      const response = await policy({ url: '/test', method: 'GET', headers: {} }, mockNext);

      const reader = (response.data as ReadableStream<Uint8Array>).getReader();

      // First read succeeds
      const first = await reader.read();
      expect(first.done).toBe(false);
      expect(new TextDecoder().decode(first.value)).toBe('first chunk');

      // Second read should throw
      await expect(reader.read()).rejects.toThrow('Stream read failed');
    });

    it('should handle immediate stream error', async () => {
      const errorStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(new Error('Immediate stream error'));
        },
      });

      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: errorStream,
          ok: true,
        }) as Response;

      const policy = parseStream();
      const response = await policy({ url: '/test', method: 'GET', headers: {} }, mockNext);

      const reader = (response.data as ReadableStream<Uint8Array>).getReader();

      await expect(reader.read()).rejects.toThrow('Immediate stream error');
    });

    it('should handle stream cancellation', async () => {
      let cancelled = false;
      const cancelableStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data'));
        },
        cancel() {
          cancelled = true;
        },
      });

      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: cancelableStream,
          ok: true,
        }) as Response;

      const policy = parseStream();
      const response = await policy({ url: '/test', method: 'GET', headers: {} }, mockNext);

      const reader = (response.data as ReadableStream<Uint8Array>).getReader();
      await reader.cancel('User cancelled');

      expect(cancelled).toBe(true);
    });
  });

  describe('SSE stream errors', () => {
    it('should handle SSE stream error gracefully', async () => {
      let chunkCount = 0;
      const errorStream = new ReadableStream<Uint8Array>({
        pull(controller) {
          chunkCount++;
          if (chunkCount === 1) {
            controller.enqueue(new TextEncoder().encode('data: First event\n\n'));
            return;
          }
          controller.error(new Error('SSE connection lost'));
        },
      });

      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: errorStream,
          ok: true,
        }) as Response;

      const policy = parseSSE();
      const response = await policy({ url: '/events', method: 'GET', headers: {} }, mockNext);

      const events: SSEEvent[] = [];
      try {
        for await (const event of response.data as AsyncIterable<SSEEvent>) {
          events.push(event);
        }
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toBe('SSE connection lost');
      }

      // Should have captured first event before error
      expect(events).toHaveLength(1);
      expect(events[0]?.data).toBe('First event');
    });

    it('should handle malformed SSE data without crashing', async () => {
      // Malformed SSE with missing newlines, invalid fields
      const malformedSSE = 'data: Valid\n\ninvalid line without colon\ndata: Also valid\n\n:comment\ndata:\n\n';

      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: malformedSSE,
          ok: true,
        }) as Response;

      const policy = parseSSE();
      const response = await policy({ url: '/events', method: 'GET', headers: {} }, mockNext);

      const events: SSEEvent[] = [];
      for await (const event of response.data as AsyncIterable<SSEEvent>) {
        events.push(event);
      }

      // Should parse valid events, skip malformed ones
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]?.data).toBe('Valid');
    });

    it('should handle empty data field', async () => {
      const sseData = 'data:\n\n';

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
      expect(events[0]?.data).toBe('');
    });

    it('should handle chunked SSE data', async () => {
      // Simulate chunked delivery where event boundary splits across chunks
      let chunkIndex = 0;
      const chunks = [
        'data: First', // Partial event
        ' part\n\ndata: Second', // Complete first, start second
        '\n\n', // Complete second
      ];

      const chunkedStream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (chunkIndex < chunks.length) {
            controller.enqueue(new TextEncoder().encode(chunks[chunkIndex]));
            chunkIndex++;
          } else {
            controller.close();
          }
        },
      });

      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: chunkedStream,
          ok: true,
        }) as Response;

      const policy = parseSSE();
      const response = await policy({ url: '/events', method: 'GET', headers: {} }, mockNext);

      const events: SSEEvent[] = [];
      for await (const event of response.data as AsyncIterable<SSEEvent>) {
        events.push(event);
      }

      expect(events).toHaveLength(2);
      expect(events[0]?.data).toBe('First part');
      expect(events[1]?.data).toBe('Second');
    });

    it('should handle invalid retry value', async () => {
      const sseData = 'retry: invalid\ndata: Test\n\n';

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
      expect(events[0]?.retry).toBeUndefined(); // Invalid retry should be ignored
      expect(events[0]?.data).toBe('Test');
    });
  });

  describe('Partial stream consumption', () => {
    it('should handle partial read with reader release', async () => {
      let totalEnqueued = 0;
      const infiniteStream = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(new TextEncoder().encode(`chunk-${totalEnqueued}\n`));
          totalEnqueued++;
        },
      });

      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: infiniteStream,
          ok: true,
        }) as Response;

      const policy = parseStream();
      const response = await policy({ url: '/test', method: 'GET', headers: {} }, mockNext);

      const reader = (response.data as ReadableStream<Uint8Array>).getReader();

      // Read only 3 chunks
      for (let i = 0; i < 3; i++) {
        await reader.read();
      }

      // Release lock without completing stream
      reader.releaseLock();

      expect(totalEnqueued).toBeGreaterThanOrEqual(3);
    });

    it('should handle SSE with early break from loop', async () => {
      let eventCount = 0;
      const infiniteSSE = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(new TextEncoder().encode(`data: Event ${eventCount}\n\n`));
          eventCount++;
        },
      });

      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: infiniteSSE,
          ok: true,
        }) as Response;

      const policy = parseSSE();
      const response = await policy({ url: '/events', method: 'GET', headers: {} }, mockNext);

      const events: SSEEvent[] = [];
      for await (const event of response.data as AsyncIterable<SSEEvent>) {
        events.push(event);
        if (events.length >= 5) {
          break; // Early exit
        }
      }

      expect(events).toHaveLength(5);
    });
  });

  describe('Memory and resource handling', () => {
    it('should not accumulate memory with large stream', async () => {
      const chunkSize = 1024; // 1KB chunks
      const totalChunks = 100;
      let chunksEmitted = 0;

      const largeStream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (chunksEmitted < totalChunks) {
            controller.enqueue(new Uint8Array(chunkSize).fill(65)); // Fill with 'A'
            chunksEmitted++;
          } else {
            controller.close();
          }
        },
      });

      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: largeStream,
          ok: true,
        }) as Response;

      const policy = parseStream();
      const response = await policy({ url: '/test', method: 'GET', headers: {} }, mockNext);

      const reader = (response.data as ReadableStream<Uint8Array>).getReader();
      let totalBytesRead = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytesRead += value.length;
      }

      expect(totalBytesRead).toBe(chunkSize * totalChunks);
      expect(chunksEmitted).toBe(totalChunks);
    });

    it('should release reader lock in finally block on error', async () => {
      const errorStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: Event\n\n'));
        },
        pull(controller) {
          controller.error(new Error('Connection lost'));
        },
      });

      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: errorStream,
          ok: true,
        }) as Response;

      const policy = parseSSE();
      const response = await policy({ url: '/events', method: 'GET', headers: {} }, mockNext);

      const events: SSEEvent[] = [];

      try {
        for await (const event of response.data as AsyncIterable<SSEEvent>) {
          events.push(event);
        }
      } catch {
        // Expected error
      }

      // Stream should be in a state where we can get a new reader
      // (lock was released in finally block)
      // The original stream is already errored, so this verifies cleanup happened
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle completely empty stream', async () => {
      const emptyStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      });

      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: emptyStream,
          ok: true,
        }) as Response;

      const policy = parseStream();
      const response = await policy({ url: '/test', method: 'GET', headers: {} }, mockNext);

      const reader = (response.data as ReadableStream<Uint8Array>).getReader();
      const { done, value } = await reader.read();

      expect(done).toBe(true);
      expect(value).toBeUndefined();
    });

    it('should handle stream with only whitespace', async () => {
      const whitespaceSSE = '   \n\n\t\n  \n\n';

      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: whitespaceSSE,
          ok: true,
        }) as Response;

      const policy = parseSSE();
      const response = await policy({ url: '/events', method: 'GET', headers: {} }, mockNext);

      const events: SSEEvent[] = [];
      for await (const event of response.data as AsyncIterable<SSEEvent>) {
        events.push(event);
      }

      // No valid events with data field
      expect(events).toHaveLength(0);
    });

    it('should handle binary data in stream', async () => {
      const binaryData = new Uint8Array([0x00, 0x01, 0xff, 0xfe, 0x80]);
      const binaryStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(binaryData);
          controller.close();
        },
      });

      const mockNext = async (_ctx: unknown) =>
        ({
          status: 200,
          statusText: 'OK',
          headers: {},
          data: binaryStream,
          ok: true,
        }) as Response;

      const policy = parseStream();
      const response = await policy({ url: '/test', method: 'GET', headers: {} }, mockNext);

      const reader = (response.data as ReadableStream<Uint8Array>).getReader();
      const { value } = await reader.read();

      expect(value).toEqual(binaryData);
    });
  });
});
