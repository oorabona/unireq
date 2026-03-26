import { describe, expect, it, vi } from 'vitest';
import { backoff } from '../backoff.js';
import { compose } from '../compose.js';
import { URLNormalizationError } from '../errors.js';
import { assertHas, inspect } from '../inspect.js';
import { policy } from '../introspection.js';
import { retry } from '../retry.js';
import { slot, validatePolicyChain } from '../slots.js';
import type { Policy } from '../types.js';
import { normalizeURL } from '../url.js';

describe('Inspect API — behavioral', () => {
  describe('inspect()', () => {
    it('returns "[]" for a plain function with no policy metadata', () => {
      const plain = async (ctx: any, next: any) => next(ctx);
      expect(inspect(plain)).toBe('[]');
    });

    it('returns "(empty policy chain)" in tree format for a plain function', () => {
      const plain = async (ctx: any, next: any) => next(ctx);
      expect(inspect(plain, { format: 'tree' })).toBe('(empty policy chain)');
    });

    it('renders a tagged policy name in JSON format', () => {
      const myPolicy = policy(async (ctx, next) => next(ctx), {
        name: 'my-auth',
        kind: 'auth',
      });
      const result = inspect(myPolicy);
      expect(result).toContain('my-auth');
    });

    it('renders a tagged policy name in tree format', () => {
      const myPolicy = policy(async (ctx, next) => next(ctx), {
        name: 'my-auth',
        kind: 'auth',
      });
      const result = inspect(myPolicy, { format: 'tree' });
      expect(result).toContain('my-auth');
    });

    it('renders nested policies from compose() in JSON format', () => {
      const retryPolicy = policy(async (ctx, next) => next(ctx), { name: 'retry', kind: 'retry' });
      const authPolicy = policy(async (ctx, next) => next(ctx), { name: 'auth', kind: 'auth' });
      const composed = compose(retryPolicy, authPolicy);

      const result = inspect(composed);
      expect(result).toContain('retry');
      expect(result).toContain('auth');
    });

    it('renders a single-policy compose without wrapping in extra layer', () => {
      const singlePolicy = policy(async (ctx, next) => next(ctx), { name: 'only-policy', kind: 'auth' });
      const composed = compose(singlePolicy);

      const result = inspect(composed);
      expect(result).toContain('only-policy');
    });

    it('returns "(empty policy chain)" in tree format for compose with no policies', () => {
      const emptyCompose = compose();
      const result = inspect(emptyCompose, { format: 'tree' });
      expect(result).toBe('(empty policy chain)');
    });

    it('renders retry policy with its backoff strategy children', () => {
      const retryPolicy = retry(
        (result: any, err) => err !== null,
        [backoff({ initial: 100, max: 1000 })],
        { tries: 3 },
      );
      const result = inspect(retryPolicy);
      expect(result).toContain('retry');
      expect(result).toContain('backoff');
    });
  });

  describe('assertHas()', () => {
    it('does not throw when the requested kind is present at top level', () => {
      const authPolicy = policy(async (ctx, next) => next(ctx), { name: 'bearer', kind: 'auth' });
      expect(() => assertHas(authPolicy, 'auth')).not.toThrow();
    });

    it('throws when the requested kind is absent', () => {
      const logPolicy = policy(async (ctx, next) => next(ctx), { name: 'logger', kind: 'interceptor' });
      expect(() => assertHas(logPolicy, 'auth')).toThrow(/Expected policy kind "auth" not found/);
    });

    it('throws for a plain function with no metadata', () => {
      const plain: Policy = async (ctx, next) => next(ctx);
      expect(() => assertHas(plain, 'auth')).toThrow();
    });

    it('finds a kind nested inside compose() children', () => {
      const authPolicy = policy(async (ctx, next) => next(ctx), { name: 'bearer', kind: 'auth' });
      const logPolicy = policy(async (ctx, next) => next(ctx), { name: 'logger', kind: 'interceptor' });
      const composed = compose(logPolicy, authPolicy);

      expect(() => assertHas(composed, 'auth')).not.toThrow();
      expect(() => assertHas(composed, 'interceptor')).not.toThrow();
    });

    it('throws when kind is absent from all compose() children', () => {
      const logPolicy = policy(async (ctx, next) => next(ctx), { name: 'logger', kind: 'interceptor' });
      const cachePolicy = policy(async (ctx, next) => next(ctx), { name: 'cache', kind: 'cache' });
      const composed = compose(logPolicy, cachePolicy);

      expect(() => assertHas(composed, 'auth')).toThrow(/Expected policy kind "auth" not found/);
    });

    it('finds "retry" kind inside a retry policy', () => {
      const retryPolicy = retry(
        (result: any, err) => err !== null,
        [backoff({ initial: 100 })],
        { tries: 2 },
      );
      expect(() => assertHas(retryPolicy, 'retry')).not.toThrow();
    });
  });
});

describe('Policy slot validation — behavioral', () => {
  it('does not throw for an empty policy array', () => {
    expect(() => validatePolicyChain([])).not.toThrow();
  });

  it('does not throw for policies without slot metadata', () => {
    const p1: Policy = async (ctx, next) => next(ctx);
    const p2: Policy = async (ctx, next) => next(ctx);
    expect(() => validatePolicyChain([p1, p2])).not.toThrow();
  });

  it('throws DuplicatePolicyError when the same slot type is registered twice', () => {
    const makeSlottedPolicy = (name: string): Policy => {
      const p: Policy = async (ctx, next) => next(ctx);
      return slot({ type: 'singleton', name })(p);
    };

    const p1 = makeSlottedPolicy('auth');
    const p2 = makeSlottedPolicy('auth');

    expect(() => validatePolicyChain([p1, p2])).toThrow(/Duplicate policy detected/);
  });

  it('allows two different slot names in the same chain', () => {
    const makeSlottedPolicy = (name: string): Policy => {
      const p: Policy = async (ctx, next) => next(ctx);
      return slot({ type: 'singleton', name })(p);
    };

    const authPolicy = makeSlottedPolicy('auth');
    const retryPolicy = makeSlottedPolicy('retry');

    expect(() => validatePolicyChain([authPolicy, retryPolicy])).not.toThrow();
  });
});

describe('URL normalization — behavioral', () => {
  it('normalizes an absolute https URL to its canonical form', () => {
    const result = normalizeURL('https://api.example.com/users');
    expect(result).toBe('https://api.example.com/users');
  });

  it('throws URLNormalizationError for a relative URL with no base', () => {
    expect(() => normalizeURL('/api/users')).toThrow(URLNormalizationError);
    expect(() => normalizeURL('/api/users')).toThrow(/Relative URL requires URI/);
  });

  it('resolves a relative path against an absolute base', () => {
    const result = normalizeURL('/users', { base: 'https://api.example.com' });
    expect(result).toBe('https://api.example.com/users');
  });

  it('resolves a relative path using implicit https when base lacks a scheme', () => {
    const result = normalizeURL('/users', { base: 'api.example.com' });
    expect(result).toBe('https://api.example.com/users');
  });

  it('passes through non-http scheme URLs unchanged', () => {
    expect(normalizeURL('mailto:user@example.com')).toBe('mailto:user@example.com');
    expect(normalizeURL('ftp://files.example.com/file.txt')).toBe('ftp://files.example.com/file.txt');
  });

  it('throws URLNormalizationError for a syntactically invalid URL', () => {
    expect(() => normalizeURL('http://[')).toThrow(URLNormalizationError);
  });

  it('wraps a non-Error thrown during URL parsing in URLNormalizationError', () => {
    const originalURL = global.URL;
    // Override URL constructor to throw a raw string (not an Error instance)
    global.URL = class extends originalURL {
      constructor(url: string, base?: string | URL) {
        super(url, base);
        if (url === 'https://trigger-string-throw.com/') {
          throw 'raw string error';
        }
      }
    } as typeof URL;

    try {
      expect(() => normalizeURL('https://trigger-string-throw.com/')).toThrow(URLNormalizationError);
      expect(() => normalizeURL('https://trigger-string-throw.com/')).toThrow(/raw string error/);
    } finally {
      global.URL = originalURL;
    }
  });

  it('expands protocol-relative URLs using the default https scheme', () => {
    const result = normalizeURL('//api.example.com/data');
    expect(result).toBe('https://api.example.com/data');
  });

  it('expands protocol-relative URLs using a custom defaultScheme', () => {
    const result = normalizeURL('//api.example.com/data', { defaultScheme: 'http' });
    expect(result).toBe('http://api.example.com/data');
  });
});

describe('compose() — behavioral', () => {
  it('passes the request through unchanged with no policies', async () => {
    const transport = vi.fn().mockResolvedValue({ ok: true, status: 200, data: 'ok', headers: {} });
    const passthrough = compose();

    const ctx: any = { url: 'https://api.example.com', method: 'GET', headers: {} };
    const response = await passthrough(ctx, transport);

    expect(transport).toHaveBeenCalledWith(ctx);
    expect(response.ok).toBe(true);
  });

  it('executes a single policy and delegates to transport', async () => {
    const transport = vi.fn().mockResolvedValue({ ok: true, status: 200, data: 'result', headers: {} });
    const addHeader: Policy = async (ctx, next) =>
      next({ ...ctx, headers: { ...ctx.headers, 'x-custom': 'yes' } });

    const composed = compose(addHeader);
    const ctx: any = { url: 'https://api.example.com', method: 'GET', headers: {} };
    await composed(ctx, transport);

    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expect.objectContaining({ 'x-custom': 'yes' }) }),
    );
  });

  it('executes multiple policies in onion order (outer wraps inner)', async () => {
    const order: number[] = [];
    const transport = vi.fn().mockResolvedValue({ ok: true, status: 200, data: null, headers: {} });

    const p1: Policy = async (ctx, next) => {
      order.push(1);
      const res = await next(ctx);
      order.push(4);
      return res;
    };
    const p2: Policy = async (ctx, next) => {
      order.push(2);
      const res = await next(ctx);
      order.push(3);
      return res;
    };

    await compose(p1, p2)({ url: 'u', method: 'GET', headers: {} } as any, transport);

    expect(order).toEqual([1, 2, 3, 4]);
  });
});
