import type { RequestContext } from '@unireq/core';
import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';

describe('@unireq/http - response parsers', () => {
  describe('parse.json()', () => {
    it('should set Accept header to application/json', async () => {
      const ctx: RequestContext = {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: {},
      };

      const policy = parse.json();
      const next = async (updatedCtx: RequestContext) => {
        expect(updatedCtx.headers['accept']).toBe('application/json');
        return { ...updatedCtx, data: '{"name":"John"}', status: 200, statusText: 'OK', ok: true };
      };

      await policy(ctx, next);
    });

    it('should NOT override existing Accept header (lowercase)', async () => {
      const ctx: RequestContext = {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: { accept: 'application/custom' },
      };

      const policy = parse.json();
      const next = async (updatedCtx: RequestContext) => {
        expect(updatedCtx.headers['accept']).toBe('application/custom');
        return { ...updatedCtx, data: '{"name":"John"}', status: 200, statusText: 'OK', ok: true };
      };

      const result = await policy(ctx, next);
      expect(result.data).toEqual({ name: 'John' });
    });

    it('should NOT override existing Accept header (capitalized)', async () => {
      const ctx: RequestContext = {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: { Accept: 'application/custom' },
      };

      const policy = parse.json();
      const next = async (updatedCtx: RequestContext) => {
        expect(updatedCtx.headers['Accept']).toBe('application/custom');
        return { ...updatedCtx, data: '{"name":"John"}', status: 200, statusText: 'OK', ok: true };
      };

      const result = await policy(ctx, next);
      expect(result.data).toEqual({ name: 'John' });
    });

    it('should parse JSON string response', async () => {
      const ctx: RequestContext = {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: {},
      };

      const policy = parse.json();
      const next = async (updatedCtx: RequestContext) => ({
        ...updatedCtx,
        data: '{"name":"John","age":30}',
        status: 200,
        statusText: 'OK',
        ok: true,
      });

      const result = await policy(ctx, next);
      expect(result.data).toEqual({ name: 'John', age: 30 });
    });

    it('should parse JSON from ArrayBuffer', async () => {
      const jsonString = '{"name":"John","age":30}';
      const buffer = new TextEncoder().encode(jsonString).buffer;

      const ctx: RequestContext = {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: {},
      };

      const policy = parse.json();
      const next = async (updatedCtx: RequestContext) => ({
        ...updatedCtx,
        data: buffer,
        status: 200,
        statusText: 'OK',
        ok: true,
      });

      const result = await policy(ctx, next);
      expect(result.data).toEqual({ name: 'John', age: 30 });
    });

    it('should parse JSON from Blob', async () => {
      const jsonString = '{"name":"John","age":30}';
      const blob = new Blob([jsonString], { type: 'application/json' });

      const ctx: RequestContext = {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: {},
      };

      const policy = parse.json();
      const next = async (updatedCtx: RequestContext) => ({
        ...updatedCtx,
        data: blob,
        status: 200,
        statusText: 'OK',
        ok: true,
      });

      const result = await policy(ctx, next);
      expect(result.data).toEqual({ name: 'John', age: 30 });
    });

    it('should handle empty response', async () => {
      const ctx: RequestContext = {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: {},
      };

      const policy = parse.json();
      const next = async (updatedCtx: RequestContext) => ({
        ...updatedCtx,
        data: undefined,
        status: 200,
        statusText: 'OK',
        ok: true,
      });

      const result = await policy(ctx, next);
      expect(result.data).toBeUndefined();
    });

    it('should handle already parsed object', async () => {
      const parsedData = { name: 'John', age: 30 };

      const ctx: RequestContext = {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: {},
      };

      const policy = parse.json();
      const next = async (updatedCtx: RequestContext) => ({
        ...updatedCtx,
        data: parsedData,
        status: 200,
        statusText: 'OK',
        ok: true,
      });

      const result = await policy(ctx, next);
      expect(result.data).toBe(parsedData);
    });
  });

  describe('parse.text()', () => {
    it('should set Accept header to text/plain', async () => {
      const ctx: RequestContext = {
        url: 'https://api.example.com/notes',
        method: 'GET',
        headers: {},
      };

      const policy = parse.text();
      const next = async (updatedCtx: RequestContext) => {
        expect(updatedCtx.headers['accept']).toBe('text/plain');
        return { ...updatedCtx, data: 'Hello world', status: 200, statusText: 'OK', ok: true };
      };

      await policy(ctx, next);
    });

    it('should NOT override existing Accept header', async () => {
      const ctx: RequestContext = {
        url: 'https://api.example.com/notes',
        method: 'GET',
        headers: { accept: 'text/html' },
      };

      const policy = parse.text();
      const next = async (updatedCtx: RequestContext) => {
        expect(updatedCtx.headers['accept']).toBe('text/html');
        return { ...updatedCtx, data: 'Hello world', status: 200, statusText: 'OK', ok: true };
      };

      await policy(ctx, next);
    });

    it('should parse text from string', async () => {
      const ctx: RequestContext = {
        url: 'https://api.example.com/notes',
        method: 'GET',
        headers: {},
      };

      const policy = parse.text();
      const next = async (updatedCtx: RequestContext) => ({
        ...updatedCtx,
        data: 'Hello world',
        status: 200,
        statusText: 'OK',
        ok: true,
      });

      const result = await policy(ctx, next);
      expect(result.data).toBe('Hello world');
    });

    it('should parse text from ArrayBuffer', async () => {
      const text = 'Hello world';
      const buffer = new TextEncoder().encode(text).buffer;

      const ctx: RequestContext = {
        url: 'https://api.example.com/notes',
        method: 'GET',
        headers: {},
      };

      const policy = parse.text();
      const next = async (updatedCtx: RequestContext) => ({
        ...updatedCtx,
        data: buffer,
        status: 200,
        statusText: 'OK',
        ok: true,
      });

      const result = await policy(ctx, next);
      expect(result.data).toBe('Hello world');
    });

    it('should parse text from Blob', async () => {
      const text = 'Hello world';
      const blob = new Blob([text], { type: 'text/plain' });

      const ctx: RequestContext = {
        url: 'https://api.example.com/notes',
        method: 'GET',
        headers: {},
      };

      const policy = parse.text();
      const next = async (updatedCtx: RequestContext) => ({
        ...updatedCtx,
        data: blob,
        status: 200,
        statusText: 'OK',
        ok: true,
      });

      const result = await policy(ctx, next);
      expect(result.data).toBe('Hello world');
    });

    it('should handle undefined response', async () => {
      const ctx: RequestContext = {
        url: 'https://api.example.com/notes',
        method: 'GET',
        headers: {},
      };

      const policy = parse.text();
      const next = async (updatedCtx: RequestContext) => ({
        ...updatedCtx,
        data: undefined,
        status: 200,
        statusText: 'OK',
        ok: true,
      });

      const result = await policy(ctx, next);
      expect(result.data).toBeUndefined();
    });
  });

  describe('parse.binary()', () => {
    it('should set Accept header to application/octet-stream', async () => {
      const ctx: RequestContext = {
        url: 'https://api.example.com/download',
        method: 'GET',
        headers: {},
      };

      const policy = parse.binary();
      const next = async (updatedCtx: RequestContext) => {
        expect(updatedCtx.headers['accept']).toBe('application/octet-stream');
        return { ...updatedCtx, data: new ArrayBuffer(0), status: 200, statusText: 'OK', ok: true };
      };

      await policy(ctx, next);
    });

    it('should NOT override existing Accept header', async () => {
      const ctx: RequestContext = {
        url: 'https://api.example.com/download',
        method: 'GET',
        headers: { accept: 'image/png' },
      };

      const policy = parse.binary();
      const next = async (updatedCtx: RequestContext) => {
        expect(updatedCtx.headers['accept']).toBe('image/png');
        return { ...updatedCtx, data: new ArrayBuffer(0), status: 200, statusText: 'OK', ok: true };
      };

      await policy(ctx, next);
    });

    it('should return ArrayBuffer as-is', async () => {
      const buffer = new Uint8Array([1, 2, 3]).buffer;

      const ctx: RequestContext = {
        url: 'https://api.example.com/download',
        method: 'GET',
        headers: {},
      };

      const policy = parse.binary();
      const next = async (updatedCtx: RequestContext) => ({
        ...updatedCtx,
        data: buffer,
        status: 200,
        statusText: 'OK',
        ok: true,
      });

      const result = await policy(ctx, next);
      expect(result.data).toBe(buffer);
    });

    it('should convert Blob to ArrayBuffer', async () => {
      const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'application/octet-stream' });

      const ctx: RequestContext = {
        url: 'https://api.example.com/download',
        method: 'GET',
        headers: {},
      };

      const policy = parse.binary();
      const next = async (updatedCtx: RequestContext) => ({
        ...updatedCtx,
        data: blob,
        status: 200,
        statusText: 'OK',
        ok: true,
      });

      const result = await policy(ctx, next);
      expect(result.data).toBeInstanceOf(ArrayBuffer);
      expect(new Uint8Array(result.data as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3]));
    });

    it('should convert string to ArrayBuffer', async () => {
      const ctx: RequestContext = {
        url: 'https://api.example.com/download',
        method: 'GET',
        headers: {},
      };

      const policy = parse.binary();
      const next = async (updatedCtx: RequestContext) => ({
        ...updatedCtx,
        data: 'test',
        status: 200,
        statusText: 'OK',
        ok: true,
      });

      const result = await policy(ctx, next);
      expect(result.data).toBeInstanceOf(ArrayBuffer);
      const decoded = new TextDecoder().decode(result.data as ArrayBuffer);
      expect(decoded).toBe('test');
    });

    it('should handle undefined response', async () => {
      const ctx: RequestContext = {
        url: 'https://api.example.com/download',
        method: 'GET',
        headers: {},
      };

      const policy = parse.binary();
      const next = async (updatedCtx: RequestContext) => ({
        ...updatedCtx,
        data: undefined,
        status: 200,
        statusText: 'OK',
        ok: true,
      });

      const result = await policy(ctx, next);
      expect(result.data).toBeUndefined();
    });
  });

  describe('parse.raw()', () => {
    it('should set Accept header to */*', async () => {
      const ctx: RequestContext = {
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: {},
      };

      const policy = parse.raw();
      const next = async (updatedCtx: RequestContext) => {
        expect(updatedCtx.headers['accept']).toBe('*/*');
        return { ...updatedCtx, data: 'raw data', status: 200, statusText: 'OK', ok: true };
      };

      await policy(ctx, next);
    });

    it('should NOT override existing Accept header', async () => {
      const ctx: RequestContext = {
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: { accept: 'application/custom' },
      };

      const policy = parse.raw();
      const next = async (updatedCtx: RequestContext) => {
        expect(updatedCtx.headers['accept']).toBe('application/custom');
        return { ...updatedCtx, data: 'raw data', status: 200, statusText: 'OK', ok: true };
      };

      await policy(ctx, next);
    });

    it('should return response data unchanged', async () => {
      const ctx: RequestContext = {
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: {},
      };

      const policy = parse.raw();
      const next = async (updatedCtx: RequestContext) => ({
        ...updatedCtx,
        data: 'raw data',
        status: 200,
        statusText: 'OK',
        ok: true,
      });

      const result = await policy(ctx, next);
      expect(result.data).toBe('raw data');
    });

    it('should handle ArrayBuffer unchanged', async () => {
      const buffer = new Uint8Array([1, 2, 3]).buffer;

      const ctx: RequestContext = {
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: {},
      };

      const policy = parse.raw();
      const next = async (updatedCtx: RequestContext) => ({
        ...updatedCtx,
        data: buffer,
        status: 200,
        statusText: 'OK',
        ok: true,
      });

      const result = await policy(ctx, next);
      expect(result.data).toBe(buffer);
    });

    it('should handle Blob unchanged', async () => {
      const blob = new Blob(['test'], { type: 'text/plain' });

      const ctx: RequestContext = {
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: {},
      };

      const policy = parse.raw();
      const next = async (updatedCtx: RequestContext) => ({
        ...updatedCtx,
        data: blob,
        status: 200,
        statusText: 'OK',
        ok: true,
      });

      const result = await policy(ctx, next);
      expect(result.data).toBe(blob);
    });

    it('should handle undefined unchanged', async () => {
      const ctx: RequestContext = {
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: {},
      };

      const policy = parse.raw();
      const next = async (updatedCtx: RequestContext) => ({
        ...updatedCtx,
        data: undefined,
        status: 200,
        statusText: 'OK',
        ok: true,
      });

      const result = await policy(ctx, next);
      expect(result.data).toBeUndefined();
    });
  });
});
