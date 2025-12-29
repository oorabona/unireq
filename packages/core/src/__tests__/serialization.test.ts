import { describe, expect, it } from 'vitest';
import { isBodyDescriptor, serializationPolicy } from '../serialization.js';
import type { BodyDescriptor, RequestContext } from '../types.js';

describe('@unireq/core - serialization', () => {
  describe('isBodyDescriptor()', () => {
    it('should return true for valid BodyDescriptor', () => {
      const descriptor: BodyDescriptor = {
        __brand: 'BodyDescriptor',
        data: { test: 'data' },
        contentType: 'application/json',
        serialize: () => '{"test":"data"}',
      };

      expect(isBodyDescriptor(descriptor)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isBodyDescriptor(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isBodyDescriptor(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isBodyDescriptor('string')).toBe(false);
      expect(isBodyDescriptor(123)).toBe(false);
      expect(isBodyDescriptor(true)).toBe(false);
    });

    it('should return false for object without __brand', () => {
      expect(isBodyDescriptor({ data: 'test', serialize: () => 'test' })).toBe(false);
    });

    it('should return false for object with wrong __brand', () => {
      expect(isBodyDescriptor({ __brand: 'WrongBrand', serialize: () => 'test' })).toBe(false);
    });

    it('should return false for object without serialize function', () => {
      expect(isBodyDescriptor({ __brand: 'BodyDescriptor', data: 'test' })).toBe(false);
    });

    it('should return false for object with serialize not a function', () => {
      expect(isBodyDescriptor({ __brand: 'BodyDescriptor', serialize: 'not a function' })).toBe(false);
    });
  });

  describe('serializationPolicy()', () => {
    it('should serialize BodyDescriptor and set Content-Type', async () => {
      const descriptor: BodyDescriptor = {
        __brand: 'BodyDescriptor',
        data: { name: 'John' },
        contentType: 'application/json',
        serialize: () => '{"name":"John"}',
      };

      const ctx: RequestContext = {
        url: 'https://api.example.com/users',
        method: 'POST',
        headers: {},
        body: descriptor,
      };

      const policy = serializationPolicy();
      const next = async (updatedCtx: RequestContext) => updatedCtx as any;

      const result = (await policy(ctx, next)) as any;

      expect(result.body).toBe('{"name":"John"}');
      expect(result.headers['content-type']).toBe('application/json');
    });

    it('should NOT set Content-Type for FormData', async () => {
      const formData = new FormData();
      formData.append('file', 'test');

      const descriptor: BodyDescriptor = {
        __brand: 'BodyDescriptor',
        data: formData,
        contentType: 'multipart/form-data',
        serialize: () => formData,
      };

      const ctx: RequestContext = {
        url: 'https://api.example.com/upload',
        method: 'POST',
        headers: {},
        body: descriptor,
      };

      const policy = serializationPolicy();
      const next = async (updatedCtx: RequestContext) => updatedCtx as any;

      const result = (await policy(ctx, next)) as any;

      expect(result.body).toBe(formData);
      expect(result.headers['content-type']).toBeUndefined();
      expect(result.headers['Content-Type']).toBeUndefined();
    });

    it('should pass through non-BodyDescriptor unchanged', async () => {
      const ctx: RequestContext = {
        url: 'https://api.example.com/users',
        method: 'POST',
        headers: {},
        body: '{"name":"John"}',
      };

      const policy = serializationPolicy();
      const next = async (updatedCtx: RequestContext) => updatedCtx as any;

      const result = (await policy(ctx, next)) as any;

      expect(result.body).toBe('{"name":"John"}');
      expect(result.headers).toEqual({});
    });

    it('should NOT override existing Content-Type header (lowercase)', async () => {
      const descriptor: BodyDescriptor = {
        __brand: 'BodyDescriptor',
        data: { name: 'John' },
        contentType: 'application/json',
        serialize: () => '{"name":"John"}',
      };

      const ctx: RequestContext = {
        url: 'https://api.example.com/users',
        method: 'POST',
        headers: { 'content-type': 'application/custom' },
        body: descriptor,
      };

      const policy = serializationPolicy();
      const next = async (updatedCtx: RequestContext) => updatedCtx as any;

      const result = (await policy(ctx, next)) as any;

      expect(result.body).toBe('{"name":"John"}');
      expect(result.headers['content-type']).toBe('application/custom');
    });

    it('should NOT override existing Content-Type header (capitalized)', async () => {
      const descriptor: BodyDescriptor = {
        __brand: 'BodyDescriptor',
        data: { name: 'John' },
        contentType: 'application/json',
        serialize: () => '{"name":"John"}',
      };

      const ctx: RequestContext = {
        url: 'https://api.example.com/users',
        method: 'POST',
        headers: { 'Content-Type': 'application/custom' },
        body: descriptor,
      };

      const policy = serializationPolicy();
      const next = async (updatedCtx: RequestContext) => updatedCtx as any;

      const result = (await policy(ctx, next)) as any;

      expect(result.body).toBe('{"name":"John"}');
      expect(result.headers['Content-Type']).toBe('application/custom');
    });

    it('should handle BodyDescriptor without contentType', async () => {
      const descriptor: BodyDescriptor = {
        __brand: 'BodyDescriptor',
        data: 'plain text',
        serialize: () => 'plain text',
      };

      const ctx: RequestContext = {
        url: 'https://api.example.com/notes',
        method: 'POST',
        headers: {},
        body: descriptor,
      };

      const policy = serializationPolicy();
      const next = async (updatedCtx: RequestContext) => updatedCtx as any;

      const result = (await policy(ctx, next)) as any;

      expect(result.body).toBe('plain text');
      expect(result.headers['content-type']).toBeUndefined();
    });

    it('should serialize ArrayBuffer from BodyDescriptor', async () => {
      const buffer = new Uint8Array([1, 2, 3]).buffer;
      const descriptor: BodyDescriptor = {
        __brand: 'BodyDescriptor',
        data: buffer,
        contentType: 'application/octet-stream',
        serialize: () => buffer,
      };

      const ctx: RequestContext = {
        url: 'https://api.example.com/upload',
        method: 'POST',
        headers: {},
        body: descriptor,
      };

      const policy = serializationPolicy();
      const next = async (updatedCtx: RequestContext) => updatedCtx as any;

      const result = (await policy(ctx, next)) as any;

      expect(result.body).toBe(buffer);
      expect(result.headers['content-type']).toBe('application/octet-stream');
    });

    it('should serialize Blob from BodyDescriptor', async () => {
      const blob = new Blob(['test'], { type: 'text/plain' });
      const descriptor: BodyDescriptor = {
        __brand: 'BodyDescriptor',
        data: blob,
        contentType: 'text/plain',
        serialize: () => blob,
      };

      const ctx: RequestContext = {
        url: 'https://api.example.com/upload',
        method: 'POST',
        headers: {},
        body: descriptor,
      };

      const policy = serializationPolicy();
      const next = async (updatedCtx: RequestContext) => updatedCtx as any;

      const result = (await policy(ctx, next)) as any;

      expect(result.body).toBe(blob);
      expect(result.headers['content-type']).toBe('text/plain');
    });
  });
});
