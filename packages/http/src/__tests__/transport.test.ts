/**
 * @unireq/http - Transport tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from '../transport.js';

// Mock undici module
vi.mock('undici', () => ({
  request: vi.fn(),
}));

import { request as mockRequest } from 'undici';
import type { Dispatcher } from 'undici';

/**
 * Create a mock body with convenience methods
 * Cast to Dispatcher.ResponseData['body'] for proper typing in mocks
 */
function createMockBody(data: unknown, contentType: string): Dispatcher.ResponseData['body'] {
  const encoder = new TextEncoder();
  let content: Uint8Array;

  if (contentType.includes('application/json') && typeof data === 'object') {
    content = encoder.encode(JSON.stringify(data));
  } else if (contentType.includes('text/') || typeof data === 'string') {
    content = encoder.encode(String(data));
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
    async *[Symbol.asyncIterator]() {
      yield content;
    },
  } as unknown as Dispatcher.ResponseData['body'];
}

describe('@unireq/http - http transport', () => {
  beforeEach(() => {
    vi.mocked(mockRequest).mockReset();
  });

  it('should return transport with capabilities', () => {
    const { transport, capabilities } = http();

    expect(transport).toBeDefined();
    expect(typeof transport).toBe('function');
    expect(capabilities).toEqual({
      streams: true,
      multipartFormData: true,
      randomAccess: true,
    });
  });

  it('should handle transport with URI for relative URLs', async () => {
    vi.mocked(mockRequest).mockResolvedValueOnce({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: createMockBody({ message: 'success' }, 'application/json'),
      trailers: {},
      opaque: null,
      context: {},
    });

    const { transport } = http('https://api.example.com');
    const result = await transport({
      url: '/users',
      method: 'GET',
      headers: {},
    });

    expect(mockRequest).toHaveBeenCalledWith('https://api.example.com/users', {
      method: 'GET',
      headers: {},
      body: undefined,
      signal: undefined,
    });

    expect(result.status).toBe(200);
    expect(result.data).toEqual({ message: 'success' });
  });

  it('should execute GET request', async () => {
    vi.mocked(mockRequest).mockResolvedValueOnce({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: createMockBody({ message: 'success' }, 'application/json'),
      trailers: {},
      opaque: null,
      context: {},
    });

    const { transport } = http();
    const result = await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    expect(mockRequest).toHaveBeenCalledWith('https://example.com/api', {
      method: 'GET',
      headers: {},
      body: undefined,
      signal: undefined,
    });

    expect(result.status).toBe(200);
    expect(result.statusText).toBe('OK');
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ message: 'success' });
  });

  it('should execute POST request with JSON body', async () => {
    vi.mocked(mockRequest).mockResolvedValueOnce({
      statusCode: 201,
      headers: { 'content-type': 'application/json' },
      body: createMockBody({ id: 123 }, 'application/json'),
      trailers: {},
      opaque: null,
      context: {},
    });

    const { transport } = http();
    const result = await transport({
      url: 'https://example.com/api',
      method: 'POST',
      headers: {},
      body: { name: 'test' },
    });

    expect(mockRequest).toHaveBeenCalledWith('https://example.com/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'test' }),
      signal: undefined,
    });

    expect(result.status).toBe(201);
    expect(result.data).toEqual({ id: 123 });
  });

  it('should not override existing content-type header', async () => {
    vi.mocked(mockRequest).mockResolvedValueOnce({
      statusCode: 200,
      headers: { 'content-type': 'text/plain' },
      body: createMockBody('OK', 'text/plain'),
      trailers: {},
      opaque: null,
      context: {},
    });

    const { transport } = http();
    await transport({
      url: 'https://example.com/api',
      method: 'POST',
      headers: { 'content-type': 'application/custom' },
      body: { data: 'test' },
    });

    expect(mockRequest).toHaveBeenCalledWith('https://example.com/api', {
      method: 'POST',
      headers: { 'content-type': 'application/custom' },
      body: JSON.stringify({ data: 'test' }),
      signal: undefined,
    });
  });

  it('should handle string body', async () => {
    vi.mocked(mockRequest).mockResolvedValueOnce({
      statusCode: 200,
      headers: { 'content-type': 'text/plain' },
      body: createMockBody('OK', 'text/plain'),
      trailers: {},
      opaque: null,
      context: {},
    });

    const { transport } = http();
    await transport({
      url: 'https://example.com/api',
      method: 'POST',
      headers: {},
      body: 'plain text',
    });

    expect(mockRequest).toHaveBeenCalledWith('https://example.com/api', {
      method: 'POST',
      headers: {},
      body: 'plain text',
      signal: undefined,
    });
  });

  it('should handle FormData body', async () => {
    vi.mocked(mockRequest).mockResolvedValueOnce({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: createMockBody({ uploaded: true }, 'application/json'),
      trailers: {},
      opaque: null,
      context: {},
    });

    const formData = new FormData();
    formData.append('field', 'value');

    const { transport } = http();
    await transport({
      url: 'https://example.com/upload',
      method: 'POST',
      headers: {},
      body: formData,
    });

    expect(mockRequest).toHaveBeenCalledWith('https://example.com/upload', {
      method: 'POST',
      headers: {},
      body: formData,
      signal: undefined,
    });
  });

  it('should handle Blob body', async () => {
    vi.mocked(mockRequest).mockResolvedValueOnce({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: createMockBody({ uploaded: true }, 'application/json'),
      trailers: {},
      opaque: null,
      context: {},
    });

    const blob = new Blob(['test content'], { type: 'text/plain' });

    const { transport } = http();
    await transport({
      url: 'https://example.com/upload',
      method: 'POST',
      headers: {},
      body: blob,
    });

    expect(mockRequest).toHaveBeenCalledWith('https://example.com/upload', {
      method: 'POST',
      headers: {},
      body: blob,
      signal: undefined,
    });
  });

  it('should parse JSON response', async () => {
    vi.mocked(mockRequest).mockResolvedValueOnce({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: createMockBody({ key: 'value' }, 'application/json'),
      trailers: {},
      opaque: null,
      context: {},
    });

    const { transport } = http();
    const result = await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    expect(result.data).toEqual({ key: 'value' });
  });

  it('should parse text response', async () => {
    vi.mocked(mockRequest).mockResolvedValueOnce({
      statusCode: 200,
      headers: { 'content-type': 'text/plain' },
      body: createMockBody('plain text response', 'text/plain'),
      trailers: {},
      opaque: null,
      context: {},
    });

    const { transport } = http();
    const result = await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    expect(result.data).toBe('plain text response');
  });

  it('should parse binary response as ArrayBuffer', async () => {
    const buffer = new ArrayBuffer(8);
    vi.mocked(mockRequest).mockResolvedValueOnce({
      statusCode: 200,
      headers: { 'content-type': 'application/octet-stream' },
      body: createMockBody(buffer, 'application/octet-stream'),
      trailers: {},
      opaque: null,
      context: {},
    });

    const { transport } = http();
    const result = await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    expect(result.data).toBeInstanceOf(ArrayBuffer);
  });

  it('should include response headers', async () => {
    vi.mocked(mockRequest).mockResolvedValueOnce({
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        'x-custom-header': 'custom-value',
      },
      body: createMockBody({}, 'application/json'),
      trailers: {},
      opaque: null,
      context: {},
    });

    const { transport } = http();
    const result = await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    expect(result.headers['content-type']).toBe('application/json');
    expect(result.headers['x-custom-header']).toBe('custom-value');
  });

  it('should handle abort signal', async () => {
    vi.mocked(mockRequest).mockResolvedValueOnce({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: createMockBody({}, 'application/json'),
      trailers: {},
      opaque: null,
      context: {},
    });

    const controller = new AbortController();
    const { transport } = http();

    await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
      signal: controller.signal,
    });

    expect(mockRequest).toHaveBeenCalledWith('https://example.com/api', {
      method: 'GET',
      headers: {},
      body: undefined,
      signal: controller.signal,
    });
  });

  it('should handle 404 error', async () => {
    vi.mocked(mockRequest).mockResolvedValueOnce({
      statusCode: 404,
      headers: { 'content-type': 'text/html' },
      body: createMockBody('Not Found', 'text/html'),
      trailers: {},
      opaque: null,
      context: {},
    });

    const { transport } = http();
    const result = await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    expect(result.status).toBe(404);
    expect(result.ok).toBe(false);
  });

  it('should handle 500 error', async () => {
    vi.mocked(mockRequest).mockResolvedValueOnce({
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: createMockBody({ error: 'server error' }, 'application/json'),
      trailers: {},
      opaque: null,
      context: {},
    });

    const { transport } = http();
    const result = await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    expect(result.status).toBe(500);
    expect(result.ok).toBe(false);
    expect(result.data).toEqual({ error: 'server error' });
  });

  it('should not override content-type when already set', async () => {
    vi.mocked(mockRequest).mockResolvedValueOnce({
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: createMockBody({ data: 'test' }, 'application/json'),
      trailers: {},
      opaque: null,
      context: {},
    });

    const { transport } = http();
    await transport({
      url: 'https://example.com/api',
      method: 'POST',
      headers: { 'Content-Type': 'application/custom' },
      body: { test: 'data' },
    });

    // Verify headers were passed correctly and content-type was preserved
    expect(mockRequest).toHaveBeenCalledWith('https://example.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/custom' },
      body: JSON.stringify({ test: 'data' }),
      signal: undefined,
    });
  });

  it('should handle request without body', async () => {
    vi.mocked(mockRequest).mockResolvedValueOnce({
      statusCode: 200,
      headers: {},
      body: createMockBody('', 'application/octet-stream'),
      trailers: {},
      opaque: null,
      context: {},
    });

    const { transport } = http();
    await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    expect(mockRequest).toHaveBeenCalledWith('https://example.com/api', {
      method: 'GET',
      headers: {},
      body: undefined,
      signal: undefined,
    });
  });
});
