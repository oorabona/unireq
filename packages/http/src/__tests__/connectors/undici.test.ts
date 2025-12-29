import { NetworkError, SerializationError, TimeoutError } from '@unireq/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UndiciConnector } from '../../connectors/undici.js';

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
});
