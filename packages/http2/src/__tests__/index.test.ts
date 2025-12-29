/**
 * @unireq/http2 - HTTP/2 transport tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http2 } from '../index.js';

vi.mock('node:http2', () => {
  const mockRequest = vi.fn();
  const mockConnect = vi.fn();
  const mockSessionClose = vi.fn();

  return {
    connect: mockConnect,
    mockRequest,
    mockSessionClose,
  };
});

// Mock node:http for STATUS_CODES
vi.mock('node:http', () => ({
  STATUS_CODES: {
    200: 'OK',
    201: 'Created',
    404: 'Not Found',
    500: 'Internal Server Error',
  },
}));

describe('@unireq/http2 - http2', () => {
  let mockSession: any;
  let mockReq: any;
  let mockRequest: any;
  let mockConnect: any;
  let mockSessionClose: any;

  beforeEach(async () => {
    const http2Module = await import('node:http2');
    mockConnect = http2Module.connect as any;

    mockRequest = vi.fn();
    mockSessionClose = vi.fn();

    mockReq = {
      on: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    };

    mockSession = {
      on: vi.fn(),
      close: mockSessionClose,
      request: mockRequest,
      unref: vi.fn(),
      off: vi.fn(),
    };

    mockConnect.mockReturnValue(mockSession);
    mockRequest.mockReturnValue(mockReq);
    mockSessionClose.mockClear();
    mockConnect.mockClear();
  });

  it('should return transport with capabilities', () => {
    const { transport, capabilities } = http2();

    expect(transport).toBeDefined();
    expect(typeof transport).toBe('function');
    expect(capabilities).toEqual({
      streams: true,
      http2: true,
      serverPush: true,
    });
  });

  it('should create HTTP/2 session with correct origin', async () => {
    setupSuccessfulResponse();

    const { transport } = http2();
    await transport({
      url: 'https://example.com/api/users',
      method: 'GET',
      headers: {},
    });

    expect(mockConnect).toHaveBeenCalledWith('https://example.com', {
      timeout: 30000,
    });
  });

  it('should use custom session timeout via connector', async () => {
    setupSuccessfulResponse();

    const { Http2Connector } = await import('../connectors/native.js');
    const connector = new Http2Connector({ sessionTimeout: 60000 });

    const { transport } = http2(undefined, connector);
    await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    expect(mockConnect).toHaveBeenCalledWith('https://example.com', {
      timeout: 60000,
    });
  });

  it('should send request with correct HTTP/2 headers', async () => {
    setupSuccessfulResponse();

    const { transport } = http2();
    await transport({
      url: 'https://example.com/api/users?page=1',
      method: 'POST',
      headers: { 'x-custom': 'value', authorization: 'Bearer token' },
    });

    expect(mockRequest).toHaveBeenCalledWith(
      {
        ':method': 'POST',
        ':path': '/api/users?page=1',
        ':scheme': 'https',
        'x-custom': 'value',
        authorization: 'Bearer token',
      },
      { endStream: true },
    );
  });

  it('should handle request with string body', async () => {
    setupSuccessfulResponse();

    const { transport } = http2();
    await transport({
      url: 'https://example.com/api',
      method: 'POST',
      headers: {},
      body: 'plain text body',
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.any(Object), { endStream: false });
    expect(mockReq.write).toHaveBeenCalledWith('plain text body');
    expect(mockReq.end).toHaveBeenCalled();
  });

  it('should handle request with Buffer body', async () => {
    setupSuccessfulResponse();
    const buffer = Buffer.from('binary data');

    const { transport } = http2();
    await transport({
      url: 'https://example.com/api',
      method: 'POST',
      headers: {},
      body: buffer,
    });

    expect(mockReq.write).toHaveBeenCalledWith(buffer);
    expect(mockReq.end).toHaveBeenCalled();
  });

  it('should serialize object body as JSON', async () => {
    setupSuccessfulResponse();

    const { transport } = http2();
    await transport({
      url: 'https://example.com/api',
      method: 'POST',
      headers: {},
      body: { key: 'value', number: 42 },
    });

    expect(mockReq.write).toHaveBeenCalledWith(JSON.stringify({ key: 'value', number: 42 }));
    expect(mockReq.end).toHaveBeenCalled();
  });

  it('should parse JSON response', async () => {
    const responseData = { message: 'success', id: 123 };
    setupSuccessfulResponse({
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: JSON.stringify(responseData),
    });

    const { transport } = http2();
    const result = await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    expect(result.status).toBe(200);
    expect(result.statusText).toBe('OK');
    expect(result.ok).toBe(true);
    expect(result.data).toEqual(responseData);
  });

  it('should parse text response', async () => {
    setupSuccessfulResponse({
      status: 200,
      headers: { 'content-type': 'text/plain' },
      data: 'plain text response',
    });

    const { transport } = http2();
    const result = await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    expect(result.data).toBe('plain text response');
  });

  it('should return binary response as ArrayBuffer', async () => {
    const binaryData = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    setupSuccessfulResponse({
      status: 200,
      headers: { 'content-type': 'application/octet-stream' },
      data: binaryData,
    });

    const { transport } = http2();
    const result = await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    expect(result.data).toBeInstanceOf(ArrayBuffer);
  });

  it('should handle 404 Not Found', async () => {
    setupSuccessfulResponse({
      status: 404,
      headers: { 'content-type': 'text/html' },
      data: 'Not Found',
    });

    const { transport } = http2();
    const result = await transport({
      url: 'https://example.com/missing',
      method: 'GET',
      headers: {},
    });

    expect(result.status).toBe(404);
    expect(result.statusText).toBe('Not Found');
    expect(result.ok).toBe(false);
  });

  it('should handle 500 Internal Server Error', async () => {
    setupSuccessfulResponse({
      status: 500,
      headers: { 'content-type': 'application/json' },
      data: JSON.stringify({ error: 'server error' }),
    });

    const { transport } = http2();
    const result = await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    expect(result.status).toBe(500);
    expect(result.statusText).toBe('Internal Server Error');
    expect(result.ok).toBe(false);
    expect(result.data).toEqual({ error: 'server error' });
  });

  it('should include response headers', async () => {
    setupSuccessfulResponse({
      status: 200,
      headers: {
        'content-type': 'application/json',
        'x-custom-header': 'custom-value',
        'cache-control': 'no-cache',
      },
      data: '{}',
    });

    const { transport } = http2();
    const result = await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    expect(result.headers['content-type']).toBe('application/json');
    expect(result.headers['x-custom-header']).toBe('custom-value');
    expect(result.headers['cache-control']).toBe('no-cache');
  });

  it('should handle array values in response headers', async () => {
    setupSuccessfulResponse({
      status: 200,
      headers: {
        'set-cookie': ['cookie1=value1', 'cookie2=value2'],
      },
      data: '',
    });

    const { transport } = http2();
    const result = await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    expect(result.headers['set-cookie']).toBe('cookie1=value1, cookie2=value2');
  });

  it('should not close session after successful request (session reuse)', async () => {
    setupSuccessfulResponse();

    const { transport } = http2();
    await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    // Session should remain open for reuse
    expect(mockSessionClose).not.toHaveBeenCalled();
  });

  it('should handle abort signal', async () => {
    let abortListenerForSignal: (() => void) | null = null;

    // Capture the abort event listener
    const signal = {
      addEventListener: vi.fn((event, listener: () => void) => {
        if (event === 'abort') {
          abortListenerForSignal = listener;
        }
      }),
    };

    const { transport } = http2();
    const promise = transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
      signal: signal as any,
    });

    // Trigger abort
    if (abortListenerForSignal) {
      (abortListenerForSignal as any)();
    }

    await expect(promise).rejects.toThrow('Request aborted');
    // Session is not closed on abort, just the request fails
    expect(mockSessionClose).not.toHaveBeenCalled();
  });

  it('should handle session error', async () => {
    let sessionErrorListenerForTest: ((err: Error) => void) | null = null;

    mockSession.on.mockImplementation((event: string, listener: (err: Error) => void) => {
      if (event === 'error') {
        sessionErrorListenerForTest = listener;
      }
    });

    const { transport } = http2();
    const promise = transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    // Trigger error
    if (sessionErrorListenerForTest) {
      (sessionErrorListenerForTest as any)(new Error('Session error'));
    }

    await expect(promise).rejects.toThrow('Session error');
  });

  it('should handle request error', async () => {
    let requestErrorListenerForTest: ((err: Error) => void) | null = null;

    mockReq.on.mockImplementation((event: string, listener: (err: Error) => void) => {
      if (event === 'error') {
        requestErrorListenerForTest = listener;
        return mockReq;
      }
      return mockReq;
    });

    const { transport } = http2();
    const promise = transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    // Trigger error
    if (requestErrorListenerForTest) {
      (requestErrorListenerForTest as any)(new Error('Request error'));
    }

    await expect(promise).rejects.toThrow('Request error');
    // Session is not closed on request error, only the error handler is removed
    expect(mockSessionClose).not.toHaveBeenCalled();
  });

  it('should handle request without body', async () => {
    setupSuccessfulResponse();

    const { transport } = http2();
    await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.any(Object), { endStream: true });
    expect(mockReq.write).not.toHaveBeenCalled();
    expect(mockReq.end).not.toHaveBeenCalled();
  });

  it('should handle query parameters in URL', async () => {
    setupSuccessfulResponse();

    const { transport } = http2();
    await transport({
      url: 'https://example.com/api?foo=bar&baz=qux',
      method: 'GET',
      headers: {},
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        ':path': '/api?foo=bar&baz=qux',
      }),
      expect.any(Object),
    );
  });

  it('should handle root path', async () => {
    setupSuccessfulResponse();

    const { transport } = http2();
    await transport({
      url: 'https://example.com/',
      method: 'GET',
      headers: {},
    });

    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        ':path': '/',
      }),
      expect.any(Object),
    );
  });

  it('should reuse HTTP/2 session for multiple requests to same origin', async () => {
    setupSuccessfulResponse();

    const { transport } = http2();

    // First request
    await transport({
      url: 'https://example.com/api/users',
      method: 'GET',
      headers: {},
    });

    // Second request to the same origin
    await transport({
      url: 'https://example.com/api/posts',
      method: 'GET',
      headers: {},
    });

    // Third request to the same origin
    await transport({
      url: 'https://example.com/api/comments',
      method: 'GET',
      headers: {},
    });

    // http2.connect should only be called once for the same origin
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockConnect).toHaveBeenCalledWith('https://example.com', {
      timeout: 30000,
    });

    // But mockRequest should be called for each request
    expect(mockRequest).toHaveBeenCalledTimes(3);
  });

  it('should create separate sessions for different origins', async () => {
    setupSuccessfulResponse();

    const { transport } = http2();

    // Request to first origin
    await transport({
      url: 'https://api1.example.com/data',
      method: 'GET',
      headers: {},
    });

    // Request to second origin
    await transport({
      url: 'https://api2.example.com/data',
      method: 'GET',
      headers: {},
    });

    // http2.connect should be called twice, once per origin
    expect(mockConnect).toHaveBeenCalledTimes(2);
    expect(mockConnect).toHaveBeenCalledWith('https://api1.example.com', {
      timeout: 30000,
    });
    expect(mockConnect).toHaveBeenCalledWith('https://api2.example.com', {
      timeout: 30000,
    });
  });

  it('should create new session after previous session is closed', async () => {
    let closeListenerForReuse: (() => void) | null = null;

    mockSession.on.mockImplementation((event: string, listener: () => void) => {
      if (event === 'close') {
        closeListenerForReuse = listener;
      }
      return mockSession;
    });

    setupSuccessfulResponse();

    const { transport } = http2();

    // First request
    await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    expect(mockConnect).toHaveBeenCalledTimes(1);

    // Simulate session close
    if (closeListenerForReuse) {
      (closeListenerForReuse as any)();
    }

    // Second request after session close should create a new session
    await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    expect(mockConnect).toHaveBeenCalledTimes(2);
  });

  it('should clean up all sessions on disconnect', async () => {
    setupSuccessfulResponse();

    const { Http2Connector } = await import('../connectors/native.js');
    const connector = new Http2Connector();

    const { transport } = http2(undefined, connector);

    // Make requests to multiple origins
    await transport({
      url: 'https://api1.example.com/data',
      method: 'GET',
      headers: {},
    });

    await transport({
      url: 'https://api2.example.com/data',
      method: 'GET',
      headers: {},
    });

    // Disconnect should close all sessions
    connector.disconnect();

    expect(mockSessionClose).toHaveBeenCalledTimes(2);
  });

  // Helper function to setup successful response
  function setupSuccessfulResponse(options: any = {}) {
    const { status = 200, headers = { 'content-type': 'application/json' }, data = '{}' } = options;

    const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

    mockReq.on.mockImplementation((event: string, listener: Function) => {
      if (event === 'response') {
        const h2Headers: any = {
          ':status': status,
          ...headers,
        };
        // Call response listener immediately
        setImmediate(() => listener(h2Headers));
      } else if (event === 'data') {
        // Emit data
        setImmediate(() => listener(dataBuffer));
      } else if (event === 'end') {
        // Emit end
        setImmediate(() => listener());
      }
      return mockReq;
    });
  }
});
