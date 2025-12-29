/**
 * @unireq/http - Transport tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from '../transport.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('@unireq/http - http transport', () => {
  beforeEach(() => {
    mockFetch.mockReset();
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
    const mockHeaders = new Headers({ 'content-type': 'application/json' });

    const mockResponse = {
      status: 200,
      statusText: 'OK',
      ok: true,
      headers: mockHeaders,
      json: async () => ({ message: 'success' }),
    };

    mockFetch.mockResolvedValueOnce(mockResponse);

    const { transport } = http('https://api.example.com');
    const result = await transport({
      url: '/users',
      method: 'GET',
      headers: {},
    });

    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/users', {
      method: 'GET',
      headers: {},
      signal: undefined,
    });

    expect(result.status).toBe(200);
    expect(result.data).toEqual({ message: 'success' });
  });

  it('should execute GET request', async () => {
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ message: 'success' }),
    };

    mockFetch.mockResolvedValueOnce(mockResponse);

    const { transport } = http();
    const result = await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/api', {
      method: 'GET',
      headers: {},
      signal: undefined,
    });

    expect(result.status).toBe(200);
    expect(result.statusText).toBe('OK');
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ message: 'success' });
  });

  it('should execute POST request with JSON body', async () => {
    const mockResponse = {
      status: 201,
      statusText: 'Created',
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ id: 123 }),
    };

    mockFetch.mockResolvedValueOnce(mockResponse);

    const { transport } = http();
    const result = await transport({
      url: 'https://example.com/api',
      method: 'POST',
      headers: {},
      body: { name: 'test' },
    });

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'test' }),
      signal: undefined,
    });

    expect(result.status).toBe(201);
    expect(result.data).toEqual({ id: 123 });
  });

  it('should not override existing content-type header', async () => {
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      ok: true,
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: async () => 'OK',
    };

    mockFetch.mockResolvedValueOnce(mockResponse);

    const { transport } = http();
    await transport({
      url: 'https://example.com/api',
      method: 'POST',
      headers: { 'content-type': 'application/custom' },
      body: { data: 'test' },
    });

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/api', {
      method: 'POST',
      headers: { 'content-type': 'application/custom' },
      body: JSON.stringify({ data: 'test' }),
      signal: undefined,
    });
  });

  it('should handle string body', async () => {
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      ok: true,
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: async () => 'OK',
    };

    mockFetch.mockResolvedValueOnce(mockResponse);

    const { transport } = http();
    await transport({
      url: 'https://example.com/api',
      method: 'POST',
      headers: {},
      body: 'plain text',
    });

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/api', {
      method: 'POST',
      headers: {},
      body: 'plain text',
      signal: undefined,
    });
  });

  it('should handle FormData body', async () => {
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ uploaded: true }),
    };

    mockFetch.mockResolvedValueOnce(mockResponse);

    const formData = new FormData();
    formData.append('field', 'value');

    const { transport } = http();
    await transport({
      url: 'https://example.com/upload',
      method: 'POST',
      headers: {},
      body: formData,
    });

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/upload', {
      method: 'POST',
      headers: {},
      body: formData,
      signal: undefined,
    });
  });

  it('should handle Blob body', async () => {
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ uploaded: true }),
    };

    mockFetch.mockResolvedValueOnce(mockResponse);

    const blob = new Blob(['test content'], { type: 'text/plain' });

    const { transport } = http();
    await transport({
      url: 'https://example.com/upload',
      method: 'POST',
      headers: {},
      body: blob,
    });

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/upload', {
      method: 'POST',
      headers: {},
      body: blob,
      signal: undefined,
    });
  });

  it('should parse JSON response', async () => {
    const mockHeaders = new Headers({ 'content-type': 'application/json' });

    const mockResponse = {
      status: 200,
      statusText: 'OK',
      ok: true,
      headers: mockHeaders,
      json: async () => ({ key: 'value' }),
    };

    mockFetch.mockResolvedValueOnce(mockResponse);

    const { transport } = http();
    const result = await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    expect(result.data).toEqual({ key: 'value' });
  });

  it('should parse text response', async () => {
    const mockHeaders = new Headers({ 'content-type': 'text/plain' });

    const mockResponse = {
      status: 200,
      statusText: 'OK',
      ok: true,
      headers: mockHeaders,
      text: async () => 'plain text response',
    };

    mockFetch.mockResolvedValueOnce(mockResponse);

    const { transport } = http();
    const result = await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    expect(result.data).toBe('plain text response');
  });

  it('should parse binary response as ArrayBuffer', async () => {
    const mockHeaders = new Headers({ 'content-type': 'application/octet-stream' });

    const buffer = new ArrayBuffer(8);
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      ok: true,
      headers: mockHeaders,
      arrayBuffer: async () => buffer,
    };

    mockFetch.mockResolvedValueOnce(mockResponse);

    const { transport } = http();
    const result = await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    expect(result.data).toBe(buffer);
  });

  it('should include response headers', async () => {
    const mockHeaders = new Headers({
      'content-type': 'application/json',
      'x-custom-header': 'custom-value',
    });

    const mockResponse = {
      status: 200,
      statusText: 'OK',
      ok: true,
      headers: mockHeaders,
      json: async () => ({}),
    };

    mockFetch.mockResolvedValueOnce(mockResponse);

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
    const mockHeaders = new Headers({ 'content-type': 'application/json' });

    const mockResponse = {
      status: 200,
      statusText: 'OK',
      ok: true,
      headers: mockHeaders,
      json: async () => ({}),
    };

    mockFetch.mockResolvedValueOnce(mockResponse);

    const controller = new AbortController();
    const { transport } = http();

    await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
      signal: controller.signal,
    });

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/api', {
      method: 'GET',
      headers: {},
      signal: controller.signal,
    });
  });

  it('should handle 404 error', async () => {
    const mockHeaders = new Headers({ 'content-type': 'text/html' });

    const mockResponse = {
      status: 404,
      statusText: 'Not Found',
      ok: false,
      headers: mockHeaders,
      text: async () => 'Not Found',
    };

    mockFetch.mockResolvedValueOnce(mockResponse);

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
    const mockHeaders = new Headers({ 'content-type': 'application/json' });

    const mockResponse = {
      status: 500,
      statusText: 'Internal Server Error',
      ok: false,
      headers: mockHeaders,
      json: async () => ({ error: 'server error' }),
    };

    mockFetch.mockResolvedValueOnce(mockResponse);

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
    // Verify that existing content-type header is preserved
    const mockHeaders = new Headers({ 'content-type': 'application/json' });

    const mockResponse = {
      status: 200,
      statusText: 'OK',
      ok: true,
      headers: mockHeaders,
      json: async () => ({ data: 'test' }),
    };

    mockFetch.mockResolvedValueOnce(mockResponse);

    const { transport } = http();
    await transport({
      url: 'https://example.com/api',
      method: 'POST',
      headers: { 'Content-Type': 'application/custom' },
      body: { test: 'data' },
    });

    // Verify headers were passed correctly and content-type was preserved
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/custom' },
      body: JSON.stringify({ test: 'data' }),
      signal: undefined,
    });
  });

  it('should handle request without body', async () => {
    const mockResponse = {
      status: 200,
      statusText: 'OK',
      ok: true,
      headers: new Headers(),
      arrayBuffer: async () => new ArrayBuffer(0),
    };

    mockFetch.mockResolvedValueOnce(mockResponse);

    const { transport } = http();
    await transport({
      url: 'https://example.com/api',
      method: 'GET',
      headers: {},
    });

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/api', {
      method: 'GET',
      headers: {},
      signal: undefined,
    });
  });
});
