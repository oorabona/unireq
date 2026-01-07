/**
 * @unireq/core - Client tests
 */

import { describe, expect, it } from 'vitest';
import type { Policy, RequestContext, Response } from '../index.js';
import { client, compose, either, match } from '../index.js';
import { policy } from '../introspection.js';

// Mock transport
const mockTransport = async (ctx: RequestContext): Promise<Response> => ({
  status: 200,
  statusText: 'OK',
  headers: {},
  data: `Response for ${ctx.url}`,
  ok: true,
});

describe('@unireq/core - client', () => {
  it('should create a client with transport', async () => {
    const c = client(mockTransport);
    expect(c).toBeDefined();
    expect(typeof c).toBe('object');
    expect(typeof c.request).toBe('function');
    expect(typeof c.get).toBe('function');
  });

  it('should execute request with transport', async () => {
    const c = client(mockTransport);
    const response = await c.get('https://example.com');

    expect(response.status).toBe(200);
    expect(response.data).toBe('Response for https://example.com/');
  });

  it('should apply single policy', async () => {
    const addHeaderPolicy: Policy = async (ctx, next) => {
      return next({
        ...ctx,
        headers: { ...ctx.headers, 'X-Custom': 'test' },
      });
    };

    const c = client(mockTransport, addHeaderPolicy);
    const response = await c.get('https://example.com');

    expect(response.status).toBe(200);
  });

  it('should apply multiple policies in order', async () => {
    const executionOrder: string[] = [];

    const policy1: Policy = async (ctx, next) => {
      executionOrder.push('policy1-before');
      const result = await next(ctx);
      executionOrder.push('policy1-after');
      return result;
    };

    const policy2: Policy = async (ctx, next) => {
      executionOrder.push('policy2-before');
      const result = await next(ctx);
      executionOrder.push('policy2-after');
      return result;
    };

    const c = client(mockTransport, policy1, policy2);
    await c.get('https://example.com');

    expect(executionOrder).toEqual(['policy1-before', 'policy2-before', 'policy2-after', 'policy1-after']);
  });

  it('should pass relative URLs to transport', async () => {
    const c = client(mockTransport);
    const response = await c.get('/users');

    // Transport receives relative URL as-is and handles it
    expect(response.status).toBe(200);
    expect(response.data).toBe('Response for /users');
  });

  it('should throw error for invalid URL - empty string', async () => {
    const c = client(mockTransport);

    await expect(c.get('')).rejects.toThrow('URL must be a non-empty string');
  });

  it('should throw error for invalid URL - whitespace only', async () => {
    const c = client(mockTransport);

    await expect(c.get('   ')).rejects.toThrow('URL must be a non-empty string');
  });

  it('should throw error for invalid URL - null', async () => {
    const c = client(mockTransport);

    // @ts-expect-error - testing runtime validation
    await expect(c.get(null)).rejects.toThrow('URL must be a non-empty string');
  });

  it('should throw error for invalid URL - undefined', async () => {
    const c = client(mockTransport);

    // @ts-expect-error - testing runtime validation
    await expect(c.get(undefined)).rejects.toThrow('URL must be a non-empty string');
  });

  it('should throw error for invalid URL - non-string', async () => {
    const c = client(mockTransport);

    // @ts-expect-error - testing runtime validation
    await expect(c.get(123)).rejects.toThrow('URL must be a non-empty string');
  });

  it('should accept valid absolute URL strings', async () => {
    const c = client(mockTransport);

    await expect(c.get('https://example.com')).resolves.toBeDefined();
    await expect(c.get('http://localhost:3000')).resolves.toBeDefined();
  });

  it('should support POST method', async () => {
    const c = client(mockTransport);
    const response = await c.post('https://example.com', { data: 'test' });

    expect(response.status).toBe(200);
  });

  it('should support PUT method', async () => {
    const c = client(mockTransport);
    const response = await c.put('https://example.com', { data: 'test' });

    expect(response.status).toBe(200);
  });

  it('should support DELETE method', async () => {
    const c = client(mockTransport);
    const response = await c.delete('https://example.com');

    expect(response.status).toBe(200);
  });

  it('should support PATCH method', async () => {
    const c = client(mockTransport);
    const response = await c.patch('https://example.com', { data: 'test' });

    expect(response.status).toBe(200);
  });

  it('should support HEAD method', async () => {
    const c = client(mockTransport);
    const response = await c.head('https://example.com');

    expect(response.status).toBe(200);
  });

  it('should support OPTIONS method', async () => {
    const c = client(mockTransport);
    const response = await c.options('https://example.com');

    expect(response.status).toBe(200);
  });

  it('should handle transport with capabilities object', async () => {
    const transportWithCaps = {
      transport: mockTransport,
      capabilities: { http2: true, streaming: true },
    };

    const c = client(transportWithCaps);
    const response = await c.get('https://example.com');

    expect(response.status).toBe(200);
    expect(c).toBeDefined();
  });

  it('should support per-request policies', async () => {
    const globalPolicy: Policy = async (ctx, next) => {
      return next({ ...ctx, headers: { ...ctx.headers, 'X-Global': 'global' } });
    };

    const perRequestPolicy: Policy = async (ctx, next) => {
      return next({ ...ctx, headers: { ...ctx.headers, 'X-Per-Request': 'per-request' } });
    };

    const c = client(mockTransport, globalPolicy);
    const response = await c.get('https://example.com', perRequestPolicy);

    expect(response.status).toBe(200);
  });

  it('should work without per-request policies', async () => {
    const globalPolicy: Policy = async (ctx, next) => {
      return next({ ...ctx, headers: { ...ctx.headers, 'X-Global': 'global' } });
    };

    const c = client(mockTransport, globalPolicy);
    const response = await c.get('https://example.com');

    expect(response.status).toBe(200);
  });

  it('should support request method with policies', async () => {
    const policy: Policy = async (ctx, next) => {
      return next({ ...ctx, headers: { ...ctx.headers, 'X-Test': 'value' } });
    };

    const c = client(mockTransport);
    const response = await c.request('https://example.com', policy);

    expect(response.status).toBe(200);
  });
});

describe('@unireq/core - compose', () => {
  it('should compose multiple policies', async () => {
    const policy1: Policy = async (ctx, next) => next({ ...ctx, headers: { ...ctx.headers, 'X-Test-1': 'value1' } });

    const policy2: Policy = async (ctx, next) => next({ ...ctx, headers: { ...ctx.headers, 'X-Test-2': 'value2' } });

    const composed = compose(policy1, policy2);

    const result = await composed({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => ({
      status: 200,
      statusText: 'OK',
      headers: ctx.headers,
      data: 'OK',
      ok: true,
    }));

    expect(result.headers['X-Test-1']).toBe('value1');
    expect(result.headers['X-Test-2']).toBe('value2');
  });

  it('should compose with non-inspectable policies', async () => {
    // Plain policy without metadata
    const plainPolicy: Policy = async (ctx, next) => next({ ...ctx, headers: { ...ctx.headers, 'X-Plain': 'test' } });

    const composed = compose(plainPolicy);

    const result = await composed({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => ({
      status: 200,
      statusText: 'OK',
      headers: ctx.headers,
      data: 'OK',
      ok: true,
    }));

    expect(result.headers['X-Plain']).toBe('test');
  });

  it('should handle empty policy list', async () => {
    const composed = compose();

    const result = await composed({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: 'OK',
      ok: true,
    }));

    expect(result.status).toBe(200);
  });

  it('should handle single undefined policy', async () => {
    // @ts-expect-error - testing runtime behavior with undefined
    const composed = compose(undefined);

    const result = await composed({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: 'OK',
      ok: true,
    }));

    expect(result.status).toBe(200);
  });

  it('should handle array with undefined policy', async () => {
    const policy1: Policy = async (ctx, next) => next({ ...ctx, headers: { ...ctx.headers, 'X-Test': 'value' } });

    // @ts-expect-error - testing runtime behavior with undefined
    const composed = compose(policy1, undefined);

    const result = await composed({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => ({
      status: 200,
      statusText: 'OK',
      headers: ctx.headers,
      data: 'OK',
      ok: true,
    }));

    expect(result.status).toBe(200);
    expect(result.headers['X-Test']).toBe('value');
  });

  it('should handle match() with non-inspectable default policy', async () => {
    const predicate1 = (ctx: RequestContext) => ctx.method === 'GET';
    const getPolicy: Policy = async (ctx, next) => next({ ...ctx, headers: { ...ctx.headers, 'X-Method': 'GET' } });

    // Plain policy without metadata
    const defaultPolicy: Policy = async (ctx, next) =>
      next({ ...ctx, headers: { ...ctx.headers, 'X-Method': 'OTHER' } });

    const matched = match([[predicate1, getPolicy]], defaultPolicy);

    const result = await matched({ url: 'https://example.com', method: 'POST', headers: {} }, async (ctx) => ({
      status: 200,
      statusText: 'OK',
      headers: ctx.headers,
      data: 'OK',
      ok: true,
    }));

    expect(result.headers['X-Method']).toBe('OTHER');
  });

  it('should handle match() with non-inspectable case policy', async () => {
    // Plain predicate and policy without metadata
    const predicate1 = (ctx: RequestContext) => ctx.method === 'GET';
    const getPolicy: Policy = async (ctx, next) => next({ ...ctx, headers: { ...ctx.headers, 'X-Method': 'GET' } });

    const matched = match([[predicate1, getPolicy]]);

    const result = await matched({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => ({
      status: 200,
      statusText: 'OK',
      headers: ctx.headers,
      data: 'OK',
      ok: true,
    }));

    expect(result.headers['X-Method']).toBe('GET');
  });

  it('should handle match() with inspectable default policy (tests line 116)', async () => {
    const predicate1 = (ctx: RequestContext) => ctx.method === 'GET';
    const getPolicy: Policy = async (ctx, next) => next({ ...ctx, headers: { ...ctx.headers, 'X-Method': 'GET' } });

    // Policy WITH metadata
    const defaultPolicy = policy(
      async (ctx, next) => next({ ...ctx, headers: { ...ctx.headers, 'X-Method': 'DEFAULT' } }),
      {
        name: 'defaultHandler',
        kind: 'other',
      },
    );

    const matched = match([[predicate1, getPolicy]], defaultPolicy);

    const result = await matched({ url: 'https://example.com', method: 'POST', headers: {} }, async (ctx) => ({
      status: 200,
      statusText: 'OK',
      headers: ctx.headers,
      data: 'OK',
      ok: true,
    }));

    expect(result.headers['X-Method']).toBe('DEFAULT');
  });

  it('should handle match() with inspectable case policy (tests line 106)', async () => {
    // Predicate with policy WITH metadata
    const predicate1 = (ctx: RequestContext) => ctx.method === 'GET';
    const getPolicy = policy(async (ctx, next) => next({ ...ctx, headers: { ...ctx.headers, 'X-Method': 'GET' } }), {
      name: 'getHandler',
      kind: 'other',
    });

    const matched = match([[predicate1, getPolicy]]);

    const result = await matched({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => ({
      status: 200,
      statusText: 'OK',
      headers: ctx.headers,
      data: 'OK',
      ok: true,
    }));

    expect(result.headers['X-Method']).toBe('GET');
  });

  it('should handle single valid policy', async () => {
    const policy: Policy = async (ctx, next) => next({ ...ctx, headers: { ...ctx.headers, 'X-Single': 'test' } });

    const composed = compose(policy);

    const result = await composed({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => ({
      status: 200,
      statusText: 'OK',
      headers: ctx.headers,
      data: 'OK',
      ok: true,
    }));

    expect(result.headers['X-Single']).toBe('test');
  });

  it('should maintain execution order with many policies', async () => {
    const executionOrder: string[] = [];

    const policy1: Policy = async (ctx, next) => {
      executionOrder.push('p1-before');
      const result = await next(ctx);
      executionOrder.push('p1-after');
      return result;
    };

    const policy2: Policy = async (ctx, next) => {
      executionOrder.push('p2-before');
      const result = await next(ctx);
      executionOrder.push('p2-after');
      return result;
    };

    const policy3: Policy = async (ctx, next) => {
      executionOrder.push('p3-before');
      const result = await next(ctx);
      executionOrder.push('p3-after');
      return result;
    };

    const composed = compose(policy1, policy2, policy3);

    await composed({ url: 'https://example.com', method: 'GET', headers: {} }, async () => {
      executionOrder.push('transport');
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: 'OK',
        ok: true,
      };
    });

    expect(executionOrder).toEqual([
      'p1-before',
      'p2-before',
      'p3-before',
      'transport',
      'p3-after',
      'p2-after',
      'p1-after',
    ]);
  });
});

describe('@unireq/core - either', () => {
  it('should execute left policy when condition is true', async () => {
    const leftPolicy: Policy = async (ctx, next) => next({ ...ctx, headers: { ...ctx.headers, 'X-Branch': 'left' } });

    const rightPolicy: Policy = async (ctx, next) => next({ ...ctx, headers: { ...ctx.headers, 'X-Branch': 'right' } });

    const conditional = either((ctx) => ctx.url.includes('api'), leftPolicy, rightPolicy);

    const result = await conditional({ url: 'https://api.example.com', method: 'GET', headers: {} }, async (ctx) => ({
      status: 200,
      statusText: 'OK',
      headers: ctx.headers,
      data: 'OK',
      ok: true,
    }));

    expect(result.headers['X-Branch']).toBe('left');
  });

  it('should execute right policy when condition is false', async () => {
    const leftPolicy: Policy = async (ctx, next) => next({ ...ctx, headers: { ...ctx.headers, 'X-Branch': 'left' } });

    const rightPolicy: Policy = async (ctx, next) => next({ ...ctx, headers: { ...ctx.headers, 'X-Branch': 'right' } });

    const conditional = either((ctx) => ctx.url.includes('api'), leftPolicy, rightPolicy);

    const result = await conditional({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => ({
      status: 200,
      statusText: 'OK',
      headers: ctx.headers,
      data: 'OK',
      ok: true,
    }));

    expect(result.headers['X-Branch']).toBe('right');
  });

  it('should pass through when condition is false and no else branch', async () => {
    const leftPolicy: Policy = async (ctx, next) => next({ ...ctx, headers: { ...ctx.headers, 'X-Branch': 'left' } });

    const conditional = either((ctx) => ctx.url.includes('api'), leftPolicy);

    const result = await conditional({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => ({
      status: 200,
      statusText: 'OK',
      headers: ctx.headers,
      data: 'OK',
      ok: true,
    }));

    expect(result.headers['X-Branch']).toBeUndefined();
  });
});

describe('@unireq/core - match', () => {
  it('should execute first matching policy', async () => {
    const { match } = await import('../either.js');

    const jsonPolicy: Policy = async (ctx, next) => next({ ...ctx, headers: { ...ctx.headers, 'X-Parser': 'json' } });

    const xmlPolicy: Policy = async (ctx, next) => next({ ...ctx, headers: { ...ctx.headers, 'X-Parser': 'xml' } });

    const textPolicy: Policy = async (ctx, next) => next({ ...ctx, headers: { ...ctx.headers, 'X-Parser': 'text' } });

    const parser = match(
      [
        [(ctx) => ctx.headers['accept']?.includes('json'), jsonPolicy],
        [(ctx) => ctx.headers['accept']?.includes('xml'), xmlPolicy],
      ],
      textPolicy,
    );

    const result = await parser(
      { url: 'https://example.com', method: 'GET', headers: { accept: 'application/json' } },
      async (ctx) => ({
        status: 200,
        statusText: 'OK',
        headers: ctx.headers,
        data: 'OK',
        ok: true,
      }),
    );

    expect(result.headers['X-Parser']).toBe('json');
  });

  it('should execute default policy when no match', async () => {
    const { match } = await import('../either.js');

    const jsonPolicy: Policy = async (ctx, next) => next({ ...ctx, headers: { ...ctx.headers, 'X-Parser': 'json' } });

    const textPolicy: Policy = async (ctx, next) => next({ ...ctx, headers: { ...ctx.headers, 'X-Parser': 'text' } });

    const parser = match([[(ctx) => ctx.headers['accept']?.includes('json'), jsonPolicy]], textPolicy);

    const result = await parser({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => ({
      status: 200,
      statusText: 'OK',
      headers: ctx.headers,
      data: 'OK',
      ok: true,
    }));

    expect(result.headers['X-Parser']).toBe('text');
  });

  it('should pass through when no match and no default', async () => {
    const { match } = await import('../either.js');

    const jsonPolicy: Policy = async (ctx, next) => next({ ...ctx, headers: { ...ctx.headers, 'X-Parser': 'json' } });

    const parser = match([[(ctx) => ctx.headers['accept']?.includes('json'), jsonPolicy]]);

    const result = await parser({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => ({
      status: 200,
      statusText: 'OK',
      headers: ctx.headers,
      data: 'OK',
      ok: true,
    }));

    expect(result.headers['X-Parser']).toBeUndefined();
  });
});

describe('@unireq/core - RequestOptions API', () => {
  // Mock transport that captures request details
  const captureTransport = async (ctx: RequestContext): Promise<Response> => ({
    status: 200,
    statusText: 'OK',
    headers: ctx.headers,
    data: {
      url: ctx.url,
      method: ctx.method,
      body: ctx.body,
      signal: ctx.signal !== undefined,
    },
    ok: true,
  });

  describe('GET with options object', () => {
    it('should accept RequestOptions with policies', async () => {
      const executionOrder: string[] = [];
      const trackingPolicy: Policy = async (ctx, next) => {
        executionOrder.push('tracking');
        return next(ctx);
      };

      const c = client(captureTransport);
      await c.get('/users', { policies: [trackingPolicy] });

      expect(executionOrder).toEqual(['tracking']);
    });

    it('should accept RequestOptions with signal', async () => {
      const controller = new AbortController();
      const c = client(captureTransport);
      const response = await c.get<{ signal: boolean }>('/users', { signal: controller.signal });

      expect(response.data.signal).toBe(true);
    });

    it('should accept empty RequestOptions', async () => {
      const c = client(captureTransport);
      const response = await c.get<{ url: string }>('/users', {});

      expect(response.data.url).toBe('/users');
    });
  });

  describe('POST with options object', () => {
    it('should accept RequestOptions with body and policies', async () => {
      const executionOrder: string[] = [];
      const trackingPolicy: Policy = async (ctx, next) => {
        executionOrder.push('tracking');
        return next(ctx);
      };

      const c = client(captureTransport);
      const response = await c.post<{ body: unknown }>('/users', {
        body: { name: 'Alice' },
        policies: [trackingPolicy],
      });

      expect(executionOrder).toEqual(['tracking']);
      expect(response.data.body).toEqual({ name: 'Alice' });
    });

    it('should accept RequestOptions with only body', async () => {
      const c = client(captureTransport);
      const response = await c.post<{ body: unknown }>('/users', { body: { name: 'Bob' } });

      expect(response.data.body).toEqual({ name: 'Bob' });
    });

    it('should accept RequestOptions with only signal', async () => {
      const controller = new AbortController();
      const c = client(captureTransport);
      const response = await c.post<{ signal: boolean }>('/users', { signal: controller.signal });

      expect(response.data.signal).toBe(true);
    });
  });

  describe('backward compatibility with variadic API', () => {
    it('GET should still work with variadic policies', async () => {
      const executionOrder: string[] = [];
      const policy1: Policy = async (ctx, next) => {
        executionOrder.push('p1');
        return next(ctx);
      };
      const policy2: Policy = async (ctx, next) => {
        executionOrder.push('p2');
        return next(ctx);
      };

      const c = client(captureTransport);
      await c.get('/users', policy1, policy2);

      expect(executionOrder).toEqual(['p1', 'p2']);
    });

    it('POST should still work with body + variadic policies', async () => {
      const executionOrder: string[] = [];
      const trackingPolicy: Policy = async (ctx, next) => {
        executionOrder.push('tracking');
        return next(ctx);
      };

      const c = client(captureTransport);
      const response = await c.post<{ body: unknown }>('/users', { name: 'Charlie' }, trackingPolicy);

      expect(executionOrder).toEqual(['tracking']);
      // The body should be the plain object, not RequestOptions
      expect(response.data.body).toEqual({ name: 'Charlie' });
    });

    it('should distinguish between body object and RequestOptions', async () => {
      const c = client(captureTransport);

      // Body object with arbitrary keys should NOT be treated as RequestOptions
      const response = await c.post<{ body: unknown }>('/users', { name: 'Dave', email: 'dave@example.com' });
      expect(response.data.body).toEqual({ name: 'Dave', email: 'dave@example.com' });
    });
  });

  describe('PUT, PATCH, DELETE with options', () => {
    it('PUT should accept RequestOptions', async () => {
      const c = client(captureTransport);
      const response = await c.put<{ body: unknown; method: string }>('/users/1', {
        body: { name: 'Updated' },
      });

      expect(response.data.method).toBe('PUT');
      expect(response.data.body).toEqual({ name: 'Updated' });
    });

    it('PATCH should accept RequestOptions', async () => {
      const c = client(captureTransport);
      const response = await c.patch<{ body: unknown; method: string }>('/users/1', {
        body: { name: 'Patched' },
      });

      expect(response.data.method).toBe('PATCH');
      expect(response.data.body).toEqual({ name: 'Patched' });
    });

    it('DELETE should accept RequestOptions with policies', async () => {
      const executed: string[] = [];
      const confirmPolicy: Policy = async (ctx, next) => {
        executed.push('confirm');
        return next(ctx);
      };

      const c = client(captureTransport);
      await c.delete('/users/1', { policies: [confirmPolicy] });

      expect(executed).toEqual(['confirm']);
    });
  });

  describe('edge cases', () => {
    it('should handle null body differently from RequestOptions', async () => {
      const c = client(captureTransport);
      const response = await c.post<{ body: unknown }>('/users', null);

      // null is passed as body, not as RequestOptions
      expect(response.data.body).toBeNull();
    });

    it('should handle array body differently from RequestOptions', async () => {
      const c = client(captureTransport);
      const response = await c.post<{ body: unknown }>('/users', [1, 2, 3]);

      // Array is passed as body, not as RequestOptions
      expect(response.data.body).toEqual([1, 2, 3]);
    });

    it('should handle undefined second arg as no body', async () => {
      const c = client(captureTransport);
      const response = await c.post<{ body: unknown }>('/users', undefined);

      expect(response.data.body).toBeUndefined();
    });
  });
});

describe('@unireq/core - client.safe methods', () => {
  // Mock transport that can simulate success or error
  const createMockTransport = (shouldFail = false) => async (ctx: RequestContext): Promise<Response> => {
    if (shouldFail) {
      throw new Error(`Request failed for ${ctx.url}`);
    }
    return {
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { url: ctx.url, method: ctx.method, body: ctx.body },
      ok: true,
    };
  };

  it('should return Ok Result on successful GET request', async () => {
    const c = client(createMockTransport(false));
    const result = await c.safe.get<{ url: string }>('/users');

    expect(result.isOk()).toBe(true);
    expect(result.isErr()).toBe(false);
    expect(result.unwrap().status).toBe(200);
    expect(result.unwrap().data.url).toBe('/users');
  });

  it('should return Err Result on failed GET request', async () => {
    const c = client(createMockTransport(true));
    const result = await c.safe.get('/users');

    expect(result.isOk()).toBe(false);
    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toBe('Request failed for /users');
  });

  it('should return Ok Result on successful POST request', async () => {
    const c = client(createMockTransport(false));
    const result = await c.safe.post<{ body: { name: string } }>('/users', { name: 'Alice' });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().data.body).toEqual({ name: 'Alice' });
  });

  it('should return Err Result on failed POST request', async () => {
    const c = client(createMockTransport(true));
    const result = await c.safe.post('/users', { name: 'Alice' });

    expect(result.isOk()).toBe(false);
    expect(result.isErr()).toBe(true);
  });

  it('should support PUT method', async () => {
    const c = client(createMockTransport(false));
    const result = await c.safe.put<{ method: string }>('/users/1', { name: 'Updated' });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().data.method).toBe('PUT');
  });

  it('should support PATCH method', async () => {
    const c = client(createMockTransport(false));
    const result = await c.safe.patch<{ method: string }>('/users/1', { name: 'Patched' });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().data.method).toBe('PATCH');
  });

  it('should support DELETE method', async () => {
    const c = client(createMockTransport(false));
    const result = await c.safe.delete<{ method: string }>('/users/1');

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().data.method).toBe('DELETE');
  });

  it('should support HEAD method', async () => {
    const c = client(createMockTransport(false));
    const result = await c.safe.head('/users');

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().status).toBe(200);
  });

  it('should support OPTIONS method', async () => {
    const c = client(createMockTransport(false));
    const result = await c.safe.options<{ method: string }>('/users');

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().data.method).toBe('OPTIONS');
  });

  it('should allow pattern matching on Result', async () => {
    const c = client(createMockTransport(false));
    const result = await c.safe.get<{ url: string }>('/users');

    const message = result.match({
      ok: (response) => `Success: ${response.data.url}`,
      err: (error) => `Error: ${error.message}`,
    });

    expect(message).toBe('Success: /users');
  });

  it('should allow pattern matching on error Result', async () => {
    const c = client(createMockTransport(true));
    const result = await c.safe.get('/users');

    const message = result.match({
      ok: () => 'Success',
      err: (error) => `Error: ${error.message}`,
    });

    expect(message).toBe('Error: Request failed for /users');
  });

  it('should allow chaining with map', async () => {
    const c = client(createMockTransport(false));
    const result = await c.safe.get<{ url: string }>('/users');

    const url = result.map((r) => r.data.url).unwrap();

    expect(url).toBe('/users');
  });

  it('should allow chaining with flatMap', async () => {
    const { ok } = await import('../result.js');

    const c = client(createMockTransport(false));
    const result = await c.safe.get<{ url: string }>('/users');

    const transformed = result.flatMap((r) => ok<string, Error>(`Transformed: ${r.data.url}`));

    expect(transformed.unwrap()).toBe('Transformed: /users');
  });

  it('should provide fallback with unwrapOr on error', async () => {
    const c = client(createMockTransport(true));
    const result = await c.safe.get<{ url: string }>('/users');

    const fallback: Response<{ url: string }> = {
      status: 0,
      statusText: 'Fallback',
      headers: {},
      data: { url: 'fallback' },
      ok: false,
    };

    const response = result.unwrapOr(fallback);
    expect(response.data.url).toBe('fallback');
  });

  it('should work with policies', async () => {
    const executed: string[] = [];
    const trackingPolicy: Policy = async (ctx, next) => {
      executed.push('tracking');
      return next(ctx);
    };

    const c = client(createMockTransport(false));
    const result = await c.safe.get('/users', trackingPolicy);

    expect(result.isOk()).toBe(true);
    expect(executed).toEqual(['tracking']);
  });
});

describe('@unireq/core - appendQueryParams', () => {
  it('should append query parameters to URL', async () => {
    const { appendQueryParams } = await import('../index.js');

    const url = appendQueryParams('https://example.com', { foo: 'bar', baz: 123 });
    expect(url).toBe('https://example.com/?foo=bar&baz=123');
  });

  it('should handle existing query parameters', async () => {
    const { appendQueryParams } = await import('../index.js');

    const url = appendQueryParams('https://example.com?existing=value', { foo: 'bar' });
    expect(url).toContain('existing=value');
    expect(url).toContain('foo=bar');
  });

  it('should skip undefined values', async () => {
    const { appendQueryParams } = await import('../index.js');

    const url = appendQueryParams('https://example.com', { foo: 'bar', baz: undefined });
    expect(url).toBe('https://example.com/?foo=bar');
  });
});
