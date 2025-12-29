/**
 * @unireq/http - Policies tests
 */

import type { RequestContext } from '@unireq/core';
import { describe, expect, it } from 'vitest';
import { headers, query, redirectPolicy, timeout } from '../policies.js';

describe('@unireq/http - headers policy', () => {
  it('should add headers to request', async () => {
    const policy = headers({ 'X-Custom': 'test-value' });

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => ({
      status: 200,
      statusText: 'OK',
      headers: ctx.headers,
      data: 'OK',
      ok: true,
    }));

    expect(result.headers['X-Custom']).toBe('test-value');
  });

  it('should reject CRLF injection in header values', async () => {
    const policy = headers({ 'X-Custom': 'test\r\nInjection: malicious' });

    await expect(
      policy({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => ({
        status: 200,
        statusText: 'OK',
        headers: ctx.headers,
        data: 'OK',
        ok: true,
      })),
    ).rejects.toThrow('contains CRLF characters');
  });

  it('should merge with existing headers', async () => {
    const policy = headers({ 'X-Custom': 'new-value' });

    const result = await policy(
      {
        url: 'https://example.com',
        method: 'GET',
        headers: { 'X-Existing': 'existing-value' },
      },
      async (ctx) => ({ status: 200, statusText: 'OK', headers: ctx.headers, data: 'OK', ok: true }),
    );

    expect(result.headers['X-Existing']).toBe('existing-value');
    expect(result.headers['X-Custom']).toBe('new-value');
  });
});

describe('@unireq/http - query policy', () => {
  it('should append query parameters to URL', async () => {
    const policy = query({ foo: 'bar', baz: 123 });

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: ctx.url,
      ok: true,
    }));

    expect(result.data).toContain('foo=bar');
    expect(result.data).toContain('baz=123');
  });

  it('should skip undefined values', async () => {
    const policy = query({ foo: 'bar', baz: undefined });

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: ctx.url,
      ok: true,
    }));

    expect(result.data).toContain('foo=bar');
    expect(result.data).not.toContain('baz');
  });
});

describe('@unireq/http - timeout policy', () => {
  it('should abort request after timeout', async () => {
    const policy = timeout(100);

    await expect(
      policy({ url: 'https://example.com', method: 'GET', headers: {} }, async (ctx) => {
        // Check if signal was provided
        if (ctx.signal) {
          return new Promise((resolve, reject) => {
            // Listen for abort signal
            ctx.signal?.addEventListener('abort', () => {
              reject(new Error('Request aborted'));
            });
            // Simulate slow request
            setTimeout(() => {
              resolve({ status: 200, statusText: 'OK', headers: {}, data: 'OK', ok: true });
            }, 200);
          });
        }
        // Fallback if no signal
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { status: 200, statusText: 'OK', headers: {}, data: 'OK', ok: true };
      }),
    ).rejects.toThrow();
  });

  it('should not abort fast requests', async () => {
    const policy = timeout(1000);

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { status: 200, statusText: 'OK', headers: {}, data: 'OK', ok: true };
    });

    expect(result.status).toBe(200);
  });
});

describe('@unireq/http - redirectPolicy', () => {
  it('should follow 307 redirects', async () => {
    const policy = redirectPolicy();

    let requestCount = 0;
    const result = await policy(
      { url: 'https://example.com', method: 'POST', headers: {}, body: 'data' },
      async (ctx: RequestContext) => {
        requestCount++;
        if (requestCount === 1) {
          return {
            status: 307,
            statusText: 'Temporary Redirect',
            headers: { location: 'https://example.com/redirected' },
            data: '',
            ok: false,
          } as any;
        }
        return { status: 200, statusText: 'OK', headers: {}, data: ctx.url, ok: true };
      },
    );

    expect(requestCount).toBe(2);
    expect(result.data).toBe('https://example.com/redirected');
  });

  it('should follow 308 redirects', async () => {
    const policy = redirectPolicy();

    let requestCount = 0;
    const result = await policy(
      { url: 'https://example.com', method: 'GET', headers: {} },
      async (ctx: RequestContext) => {
        requestCount++;
        if (requestCount === 1) {
          return {
            status: 308,
            statusText: 'Permanent Redirect',
            headers: { location: 'https://example.com/permanent' },
            data: '',
            ok: false,
          } as any;
        }
        return { status: 200, statusText: 'OK', headers: {}, data: ctx.url, ok: true };
      },
    );

    expect(requestCount).toBe(2);
    expect(result.data).toBe('https://example.com/permanent');
  });

  it('should not follow 303 by default', async () => {
    const policy = redirectPolicy();

    const result = await policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
      status: 303,
      statusText: 'See Other',
      headers: { location: 'https://example.com/other' },
      data: '',
      ok: false,
    }));

    expect(result.status).toBe(303);
  });

  it('should follow 303 when enabled', async () => {
    const policy = redirectPolicy({ follow303: true });

    let requestCount = 0;
    const result = await policy(
      { url: 'https://example.com', method: 'POST', headers: {}, body: 'data' },
      async (ctx: RequestContext) => {
        requestCount++;
        if (requestCount === 1) {
          return {
            status: 303,
            statusText: 'See Other',
            headers: { location: 'https://example.com/see-other' },
            data: '',
            ok: false,
          } as any;
        }
        // 303 should convert to GET
        expect(ctx.method).toBe('GET');
        expect(ctx.body).toBeUndefined();
        return { status: 200, statusText: 'OK', headers: {}, data: 'OK', ok: true };
      },
    );

    expect(requestCount).toBe(2);
    expect(result.status).toBe(200);
  });

  it('should respect maxRedirects', async () => {
    const policy = redirectPolicy({ maxRedirects: 2 });

    await expect(
      policy({ url: 'https://example.com', method: 'GET', headers: {} }, async () => ({
        status: 307,
        statusText: 'Temporary Redirect',
        headers: { location: 'https://example.com/redirect' },
        data: '',
        ok: false,
      })),
    ).rejects.toThrow('Maximum redirect limit');
  });

  it('should detect redirect loops', async () => {
    const policy = redirectPolicy({ maxRedirects: 5 });
    let redirectCount = 0;

    await expect(
      policy({ url: 'https://a.com/', method: 'GET', headers: {} }, async (ctx) => {
        redirectCount++;
        // Create a loop: a -> b -> a
        if (ctx.url === 'https://a.com/') {
          return {
            status: 307,
            statusText: 'Temporary Redirect',
            headers: { location: 'https://b.com/' },
            data: '',
            ok: false,
          } as any;
        }
        if (ctx.url === 'https://b.com/') {
          return {
            status: 307,
            statusText: 'Temporary Redirect',
            headers: { location: 'https://a.com/' }, // Back to A - creates loop
            data: '',
            ok: false,
          } as any;
        }
        return { status: 200, statusText: 'OK', headers: {}, data: 'OK', ok: true };
      }),
    ).rejects.toThrow('Redirect loop detected');

    expect(redirectCount).toBeLessThanOrEqual(3); // Should detect loop quickly
  });
});

describe('@unireq/http - timeout policy with AbortSignal', () => {
  it('should merge with existing AbortSignal', async () => {
    const { timeout } = await import('../policies.js');
    const existingController = new AbortController();
    const policy = timeout(5000);

    // Create a promise that will be aborted
    const promise = policy(
      { url: 'https://example.com', method: 'GET', headers: {}, signal: existingController.signal },
      async (ctx) => {
        // Simulate long-running operation
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            resolve({ status: 200, statusText: 'OK', headers: {}, data: 'OK', ok: true });
          }, 10000);

          // Listen for abort - must reject, not throw
          ctx.signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('Aborted'));
          });
        });
      },
    );

    // Abort the external signal
    setTimeout(() => existingController.abort(), 10);

    await expect(promise).rejects.toThrow('Aborted');
  });
});
