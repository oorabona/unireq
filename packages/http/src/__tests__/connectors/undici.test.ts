import { NetworkError, SerializationError, TimeoutError } from '@unireq/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BODY_TIMEOUT_KEY, UndiciConnector } from '../../connectors/undici.js';

// Mock global fetch
const originalFetch = global.fetch;

describe('UndiciConnector', () => {
  const connector = new UndiciConnector();

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should make a successful request', async () => {
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true }),
      ok: true,
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const result = await connector.request(
      {},
      {
        url: 'https://example.com',
        method: 'GET',
        headers: {},
      },
    );

    expect(result.status).toBe(200);
    expect(result.data).toEqual({ success: true });
  });

  it('should handle text response', async () => {
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: async () => 'hello',
      ok: true,
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const result = await connector.request(
      {},
      {
        url: 'https://example.com',
        method: 'GET',
        headers: {},
      },
    );

    expect(result.data).toBe('hello');
  });

  it('should handle binary response', async () => {
    const buffer = new ArrayBuffer(8);
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/octet-stream' }),
      arrayBuffer: async () => buffer,
      ok: true,
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const result = await connector.request(
      {},
      {
        url: 'https://example.com',
        method: 'GET',
        headers: {},
      },
    );

    expect(result.data).toBe(buffer);
  });

  it('should handle network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

    await expect(
      connector.request(
        {},
        {
          url: 'https://example.com',
          method: 'GET',
          headers: {},
        },
      ),
    ).rejects.toThrow(NetworkError);
  });

  it('should handle timeout error (AbortError)', async () => {
    const error = new Error('The operation was aborted');
    error.name = 'AbortError';
    global.fetch = vi.fn().mockRejectedValue(error);

    await expect(
      connector.request(
        {},
        {
          url: 'https://example.com',
          method: 'GET',
          headers: {},
        },
      ),
    ).rejects.toThrow(TimeoutError);
  });

  it('should handle serialization error', async () => {
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => {
        throw new Error('Invalid JSON');
      },
      ok: true,
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    await expect(
      connector.request(
        {},
        {
          url: 'https://example.com',
          method: 'GET',
          headers: {},
        },
      ),
    ).rejects.toThrow(SerializationError);
  });

  it('should handle request body (string)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
      arrayBuffer: async () => new ArrayBuffer(0),
      ok: true,
    });

    await connector.request(
      {},
      {
        url: 'https://example.com',
        method: 'POST',
        headers: {},
        body: 'test-body',
      },
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        body: 'test-body',
      }),
    );
  });

  it('should handle request body (object)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
      arrayBuffer: async () => new ArrayBuffer(0),
      ok: true,
    });

    await connector.request(
      {},
      {
        url: 'https://example.com',
        method: 'POST',
        headers: {},
        body: { foo: 'bar' },
      },
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        body: '{"foo":"bar"}',
        headers: { 'content-type': 'application/json' },
      }),
    );
  });

  it('should handle request body (FormData)', async () => {
    const formData = new FormData();
    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
      arrayBuffer: async () => new ArrayBuffer(0),
      ok: true,
    });

    await connector.request(
      {},
      {
        url: 'https://example.com',
        method: 'POST',
        headers: {},
        body: formData,
      },
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        body: formData,
      }),
    );
  });

  describe('readBodyWithTimeout (body phase timeout)', () => {
    it('should read body with timeout when BODY_TIMEOUT_KEY is set', async () => {
      // Arrange - Create a ReadableStream that delivers chunks
      const chunks = [new TextEncoder().encode('{"hello":'), new TextEncoder().encode('"world"}')];
      let chunkIndex = 0;

      const mockBody = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (chunkIndex < chunks.length) {
            controller.enqueue(chunks[chunkIndex++]);
          } else {
            controller.close();
          }
        },
      });

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: mockBody,
        ok: true,
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      // Act - Pass body timeout via symbol
      const ctx = {
        url: 'https://example.com',
        method: 'GET' as const,
        headers: {},
        [BODY_TIMEOUT_KEY]: 5000, // 5 second timeout
      };

      const result = await connector.request({}, ctx);

      // Assert
      expect(result.status).toBe(200);
      expect(result.data).toEqual({ hello: 'world' });
    });

    it('should timeout when body download takes too long', async () => {
      // Arrange - Create a ReadableStream where pull() never resolves
      // This simulates a slow/stalled body download
      let pullResolver: (() => void) | null = null;
      let cancelled = false;

      const mockBody = new ReadableStream<Uint8Array>({
        async pull(_controller) {
          // Block forever until cancelled
          return new Promise((resolve) => {
            pullResolver = resolve;
          });
        },
        cancel() {
          cancelled = true;
          // Resolve the pending pull when cancelled
          if (pullResolver) pullResolver();
        },
      });

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: mockBody,
        ok: true,
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      // Act - Pass very short body timeout
      const ctx = {
        url: 'https://example.com',
        method: 'GET' as const,
        headers: {},
        [BODY_TIMEOUT_KEY]: 50, // 50ms timeout
      };

      // Assert - Should throw TimeoutError
      await expect(connector.request({}, ctx)).rejects.toThrow(TimeoutError);
      expect(cancelled).toBe(true);
    });

    it('should handle text content-type with body timeout', async () => {
      // Arrange
      const chunks = [new TextEncoder().encode('hello '), new TextEncoder().encode('world')];
      let chunkIndex = 0;

      const mockBody = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (chunkIndex < chunks.length) {
            controller.enqueue(chunks[chunkIndex++]);
          } else {
            controller.close();
          }
        },
      });

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/plain' }),
        body: mockBody,
        ok: true,
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      // Act
      const ctx = {
        url: 'https://example.com',
        method: 'GET' as const,
        headers: {},
        [BODY_TIMEOUT_KEY]: 5000,
      };

      const result = await connector.request({}, ctx);

      // Assert
      expect(result.data).toBe('hello world');
    });

    it('should handle binary content-type with body timeout', async () => {
      // Arrange
      const chunk1 = new Uint8Array([1, 2, 3]);
      const chunk2 = new Uint8Array([4, 5, 6]);
      let chunkIndex = 0;
      const chunks = [chunk1, chunk2];

      const mockBody = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (chunkIndex < chunks.length) {
            controller.enqueue(chunks[chunkIndex++]);
          } else {
            controller.close();
          }
        },
      });

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/octet-stream' }),
        body: mockBody,
        ok: true,
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      // Act
      const ctx = {
        url: 'https://example.com',
        method: 'GET' as const,
        headers: {},
        [BODY_TIMEOUT_KEY]: 5000,
      };

      const result = await connector.request({}, ctx);

      // Assert - Should return ArrayBuffer
      expect(result.data).toBeInstanceOf(ArrayBuffer);
      expect(new Uint8Array(result.data as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
    });

    it('should handle empty body (null response.body) with body timeout', async () => {
      // Arrange - Response with no body
      const mockResponse = {
        status: 204,
        statusText: 'No Content',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: null, // No body
        ok: true,
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      // Act
      const ctx = {
        url: 'https://example.com',
        method: 'DELETE' as const,
        headers: {},
        [BODY_TIMEOUT_KEY]: 5000,
      };

      const result = await connector.request({}, ctx);

      // Assert - Should return undefined for empty body
      expect(result.status).toBe(204);
      expect(result.data).toBeUndefined();
    });

    it('should re-throw TimeoutError from readBodyWithTimeout', async () => {
      // Arrange - Create a stream that stalls with proper cancellation handling
      let pullResolver: (() => void) | null = null;

      const mockBody = new ReadableStream<Uint8Array>({
        async pull(_controller) {
          // Block forever until cancelled
          return new Promise((resolve) => {
            pullResolver = resolve;
          });
        },
        cancel() {
          if (pullResolver) pullResolver();
        },
      });

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: mockBody,
        ok: true,
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      // Act
      const ctx = {
        url: 'https://example.com',
        method: 'GET' as const,
        headers: {},
        [BODY_TIMEOUT_KEY]: 10, // Very short timeout
      };

      // Assert - TimeoutError should propagate
      try {
        await connector.request({}, ctx);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect((error as TimeoutError).timeoutMs).toBe(10);
      }
    });

    it('should propagate non-timeout errors during streaming', async () => {
      // Arrange - Create a stream that throws an error
      const mockBody = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(new Error('Stream read error'));
        },
      });

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: mockBody,
        ok: true,
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      // Act
      const ctx = {
        url: 'https://example.com',
        method: 'GET' as const,
        headers: {},
        [BODY_TIMEOUT_KEY]: 5000,
      };

      // Assert - Should throw SerializationError (wraps non-timeout errors)
      await expect(connector.request({}, ctx)).rejects.toThrow(SerializationError);
    });

    it('should throw TimeoutError when reader.read() throws during timeout cancellation', async () => {
      // Arrange - Create a stream where cancel() calls controller.error(),
      // which makes the pending read() throw instead of returning { done: true }
      let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;

      const mockBody = new ReadableStream<Uint8Array>({
        start(controller) {
          streamController = controller;
        },
        async pull() {
          // Wait forever - the cancel() will error the stream
          return new Promise(() => {});
        },
        cancel() {
          // Call error() to make read() throw instead of returning { done: true }
          if (streamController) {
            streamController.error(new Error('Stream aborted due to timeout'));
          }
        },
      });

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: mockBody,
        ok: true,
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      // Act - Pass short body timeout
      const ctx = {
        url: 'https://example.com',
        method: 'GET' as const,
        headers: {},
        [BODY_TIMEOUT_KEY]: 20, // 20ms timeout
      };

      // Assert - Should throw TimeoutError (catch block path with timeoutFired=true)
      try {
        await connector.request({}, ctx);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect((error as TimeoutError).message).toContain('Body download timed out');
      }
    });
  });
});
