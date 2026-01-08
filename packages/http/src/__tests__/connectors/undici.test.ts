import { NetworkError, SerializationError, TimeoutError } from '@unireq/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BODY_TIMEOUT_KEY, UndiciConnector } from '../../connectors/undici.js';

// Mock undici module
vi.mock('undici', () => ({
  request: vi.fn(),
}));

import { request as mockRequest } from 'undici';

import type { Dispatcher } from 'undici';

/**
 * Create a mock body stream with convenience methods like undici response body
 * Cast to Dispatcher.ResponseData['body'] for proper typing in mocks
 */
function createMockBody(data: unknown, contentType: string): Dispatcher.ResponseData['body'] {
  // Create async iterable for streaming reads
  const encoder = new TextEncoder();
  let content: Uint8Array;

  if (contentType.includes('application/json')) {
    content = encoder.encode(JSON.stringify(data));
  } else if (contentType.includes('text/')) {
    content = encoder.encode(String(data));
  } else if (data instanceof Uint8Array) {
    content = data;
  } else if (data instanceof ArrayBuffer) {
    content = new Uint8Array(data);
  } else {
    content = new Uint8Array(0);
  }

  return {
    async json() {
      return JSON.parse(new TextDecoder().decode(content));
    },
    async text() {
      return new TextDecoder().decode(content);
    },
    async arrayBuffer() {
      return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
    },
    // AsyncIterable implementation for streaming
    async *[Symbol.asyncIterator]() {
      yield content;
    },
  } as unknown as Dispatcher.ResponseData['body'];
}

/**
 * Create a mock body that fails on parse
 */
function createFailingMockBody(error: Error): Dispatcher.ResponseData['body'] {
  return {
    async json() {
      throw error;
    },
    async text() {
      throw error;
    },
    async arrayBuffer() {
      throw error;
    },
    async *[Symbol.asyncIterator]() {
      throw error;
    },
  } as unknown as Dispatcher.ResponseData['body'];
}

/**
 * Create a mock body that times out (never resolves)
 */
function createStallMockBody(): Dispatcher.ResponseData['body'] {
  let rejectFn: ((error: Error) => void) | null = null;

  return {
    async json() {
      return new Promise((_resolve, reject) => {
        rejectFn = reject;
      });
    },
    async text() {
      return new Promise((_resolve, reject) => {
        rejectFn = reject;
      });
    },
    async arrayBuffer() {
      return new Promise((_resolve, reject) => {
        rejectFn = reject;
      });
    },
    async *[Symbol.asyncIterator](): AsyncGenerator<Uint8Array> {
      // Stall forever
      await new Promise((_resolve, reject) => {
        rejectFn = reject;
      });
    },
    _abort() {
      if (rejectFn) {
        const error = new Error('aborted');
        error.name = 'AbortError';
        rejectFn(error);
      }
    },
  } as unknown as Dispatcher.ResponseData['body'];
}

describe('UndiciConnector', () => {
  const connector = new UndiciConnector();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should make a successful request', async () => {
    vi.mocked(mockRequest).mockResolvedValue({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: createMockBody({ success: true }, 'application/json'),
      trailers: {},
      opaque: null,
      context: {},
    });

    const result = await connector.request(
      {},
      {
        url: 'https://example.com',
        method: 'GET',
        headers: {},
      },
    );

    expect(result.status).toBe(200);
    expect(result.statusText).toBe('OK');
    expect(result.data).toEqual({ success: true });
  });

  it('should handle text response', async () => {
    vi.mocked(mockRequest).mockResolvedValue({
      statusCode: 200,
      headers: { 'content-type': 'text/plain' },
      body: createMockBody('hello', 'text/plain'),
      trailers: {},
      opaque: null,
      context: {},
    });

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
    const binaryData = new Uint8Array([1, 2, 3, 4]);
    vi.mocked(mockRequest).mockResolvedValue({
      statusCode: 200,
      headers: { 'content-type': 'application/octet-stream' },
      body: createMockBody(binaryData, 'application/octet-stream'),
      trailers: {},
      opaque: null,
      context: {},
    });

    const result = await connector.request(
      {},
      {
        url: 'https://example.com',
        method: 'GET',
        headers: {},
      },
    );

    expect(result.data).toBeInstanceOf(ArrayBuffer);
  });

  it('should handle network error', async () => {
    vi.mocked(mockRequest).mockRejectedValue(new Error('Network failure'));

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
    vi.mocked(mockRequest).mockRejectedValue(error);

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
    vi.mocked(mockRequest).mockResolvedValue({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: createFailingMockBody(new Error('Invalid JSON')),
      trailers: {},
      opaque: null,
      context: {},
    });

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
    vi.mocked(mockRequest).mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: createMockBody('', 'application/octet-stream'),
      trailers: {},
      opaque: null,
      context: {},
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

    expect(mockRequest).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        body: 'test-body',
      }),
    );
  });

  it('should handle request body (object)', async () => {
    vi.mocked(mockRequest).mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: createMockBody('', 'application/octet-stream'),
      trailers: {},
      opaque: null,
      context: {},
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

    expect(mockRequest).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        body: '{"foo":"bar"}',
        headers: { 'content-type': 'application/json' },
      }),
    );
  });

  it('should handle request body (FormData)', async () => {
    const formData = new FormData();
    vi.mocked(mockRequest).mockResolvedValue({
      statusCode: 200,
      headers: {},
      body: createMockBody('', 'application/octet-stream'),
      trailers: {},
      opaque: null,
      context: {},
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

    expect(mockRequest).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        body: formData,
      }),
    );
  });

  it('should convert array headers to comma-separated string', async () => {
    vi.mocked(mockRequest).mockResolvedValue({
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        'set-cookie': ['cookie1=a', 'cookie2=b'],
      },
      body: createMockBody({ ok: true }, 'application/json'),
      trailers: {},
      opaque: null,
      context: {},
    });

    const result = await connector.request(
      {},
      {
        url: 'https://example.com',
        method: 'GET',
        headers: {},
      },
    );

    expect(result.headers['set-cookie']).toBe('cookie1=a, cookie2=b');
  });

  it('should return ok=true for 2xx status codes', async () => {
    vi.mocked(mockRequest).mockResolvedValue({
      statusCode: 201,
      headers: { 'content-type': 'application/json' },
      body: createMockBody({ created: true }, 'application/json'),
      trailers: {},
      opaque: null,
      context: {},
    });

    const result = await connector.request(
      {},
      {
        url: 'https://example.com',
        method: 'POST',
        headers: {},
      },
    );

    expect(result.ok).toBe(true);
    expect(result.statusText).toBe('Created');
  });

  it('should return ok=false for non-2xx status codes', async () => {
    vi.mocked(mockRequest).mockResolvedValue({
      statusCode: 404,
      headers: { 'content-type': 'application/json' },
      body: createMockBody({ error: 'Not found' }, 'application/json'),
      trailers: {},
      opaque: null,
      context: {},
    });

    const result = await connector.request(
      {},
      {
        url: 'https://example.com',
        method: 'GET',
        headers: {},
      },
    );

    expect(result.ok).toBe(false);
    expect(result.statusText).toBe('Not Found');
  });

  describe('readBodyWithTimeout (body phase timeout)', () => {
    it('should read body with timeout when BODY_TIMEOUT_KEY is set', async () => {
      // Arrange - Create chunks that will be delivered via async iterator
      const chunks = [new TextEncoder().encode('{"hello":'), new TextEncoder().encode('"world"}')];

      const mockBody = {
        async json() {
          return { hello: 'world' };
        },
        async text() {
          return '{"hello":"world"}';
        },
        async arrayBuffer() {
          return new TextEncoder().encode('{"hello":"world"}').buffer;
        },
        async *[Symbol.asyncIterator]() {
          for (const chunk of chunks) {
            yield chunk;
          }
        },
      } as unknown as Dispatcher.ResponseData['body'];

      vi.mocked(mockRequest).mockResolvedValue({
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: mockBody,
        trailers: {},
        opaque: null,
        context: {},
      });

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
      // Create a body that stalls
      const stallBody = createStallMockBody();

      vi.mocked(mockRequest).mockResolvedValue({
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: stallBody,
        trailers: {},
        opaque: null,
        context: {},
      });

      // Act - Pass very short body timeout
      const ctx = {
        url: 'https://example.com',
        method: 'GET' as const,
        headers: {},
        [BODY_TIMEOUT_KEY]: 50, // 50ms timeout
      };

      // Assert - Should throw TimeoutError
      await expect(connector.request({}, ctx)).rejects.toThrow(TimeoutError);
    });

    it('should handle text content-type with body timeout', async () => {
      // Arrange
      const chunks = [new TextEncoder().encode('hello '), new TextEncoder().encode('world')];

      const mockBody = {
        async json() {
          throw new Error('Not JSON');
        },
        async text() {
          return 'hello world';
        },
        async arrayBuffer() {
          return new TextEncoder().encode('hello world').buffer;
        },
        async *[Symbol.asyncIterator]() {
          for (const chunk of chunks) {
            yield chunk;
          }
        },
      } as unknown as Dispatcher.ResponseData['body'];

      vi.mocked(mockRequest).mockResolvedValue({
        statusCode: 200,
        headers: { 'content-type': 'text/plain' },
        body: mockBody,
        trailers: {},
        opaque: null,
        context: {},
      });

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
      const chunks = [chunk1, chunk2];

      const mockBody = {
        async json() {
          throw new Error('Not JSON');
        },
        async text() {
          throw new Error('Not text');
        },
        async arrayBuffer() {
          return new Uint8Array([1, 2, 3, 4, 5, 6]).buffer;
        },
        async *[Symbol.asyncIterator]() {
          for (const chunk of chunks) {
            yield chunk;
          }
        },
      } as unknown as Dispatcher.ResponseData['body'];

      vi.mocked(mockRequest).mockResolvedValue({
        statusCode: 200,
        headers: { 'content-type': 'application/octet-stream' },
        body: mockBody,
        trailers: {},
        opaque: null,
        context: {},
      });

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

    it('should re-throw TimeoutError from readBodyWithTimeout', async () => {
      // Create a body that stalls
      const stallBody = createStallMockBody();

      vi.mocked(mockRequest).mockResolvedValue({
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: stallBody,
        trailers: {},
        opaque: null,
        context: {},
      });

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
      // Arrange - Create a body that throws an error
      const mockBody = {
        async json() {
          throw new Error('Stream read error');
        },
        async text() {
          throw new Error('Stream read error');
        },
        async arrayBuffer() {
          throw new Error('Stream read error');
        },
        async *[Symbol.asyncIterator]() {
          throw new Error('Stream read error');
        },
      } as unknown as Dispatcher.ResponseData['body'];

      vi.mocked(mockRequest).mockResolvedValue({
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: mockBody,
        trailers: {},
        opaque: null,
        context: {},
      });

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
  });
});
