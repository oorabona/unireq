import type { RequestContext, Response } from '@unireq/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { proxy } from '../proxy.js';

describe('proxy', () => {
  const createMockNext = () => {
    return vi.fn().mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: {},
      ok: true,
    } as Response);
  };

  const createMockContext = (url = 'https://api.example.com/users'): RequestContext => ({
    url,
    method: 'GET',
    headers: {},
  });

  describe('proxy(url)', () => {
    it('adds proxy configuration to context', async () => {
      const policy = proxy('http://proxy.corp.com:8080');
      const next = createMockNext();

      await policy(createMockContext(), next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: {
            host: 'proxy.corp.com',
            port: 8080,
            protocol: 'http',
            auth: undefined,
          },
        }),
      );
    });

    it('extracts auth from proxy URL', async () => {
      const policy = proxy('http://user:pass@proxy.corp.com:8080');
      const next = createMockNext();

      await policy(createMockContext(), next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: expect.objectContaining({
            auth: {
              username: 'user',
              password: 'pass',
            },
          }),
        }),
      );
    });

    it('uses default port 8080 for HTTP proxy', async () => {
      const policy = proxy('http://proxy.corp.com');
      const next = createMockNext();

      await policy(createMockContext(), next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: expect.objectContaining({
            port: 8080,
          }),
        }),
      );
    });

    it('uses default port 443 for HTTPS proxy', async () => {
      const policy = proxy('https://proxy.corp.com');
      const next = createMockNext();

      await policy(createMockContext(), next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: expect.objectContaining({
            port: 443,
          }),
        }),
      );
    });
  });

  describe('proxy(config)', () => {
    it('accepts configuration object', async () => {
      const policy = proxy({
        url: 'http://proxy.corp.com:8080',
        auth: { username: 'admin', password: 'secret' },
      });
      const next = createMockNext();

      await policy(createMockContext(), next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'proxy-authorization': expect.stringMatching(/^Basic /),
          }),
          proxy: expect.objectContaining({
            auth: {
              username: 'admin',
              password: 'secret',
            },
          }),
        }),
      );
    });

    it('config auth overrides URL auth', async () => {
      const policy = proxy({
        url: 'http://user:pass@proxy.corp.com:8080',
        auth: { username: 'admin', password: 'secret' },
      });
      const next = createMockNext();

      await policy(createMockContext(), next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: expect.objectContaining({
            auth: {
              username: 'admin',
              password: 'secret',
            },
          }),
        }),
      );
    });
  });

  describe('noProxy', () => {
    it('bypasses proxy for exact host match', async () => {
      const policy = proxy({
        url: 'http://proxy.corp.com:8080',
        noProxy: ['api.example.com'],
      });
      const next = createMockNext();

      await policy(createMockContext('https://api.example.com/users'), next);

      expect(next).toHaveBeenCalledWith(
        expect.not.objectContaining({
          proxy: expect.anything(),
        }),
      );
    });

    it('bypasses proxy for wildcard prefix match', async () => {
      const policy = proxy({
        url: 'http://proxy.corp.com:8080',
        noProxy: ['*.example.com'],
      });
      const next = createMockNext();

      await policy(createMockContext('https://api.example.com/users'), next);

      expect(next).not.toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: expect.anything(),
        }),
      );
    });

    it('bypasses proxy for wildcard prefix exact match (*.example.com matches example.com)', async () => {
      const policy = proxy({
        url: 'http://proxy.corp.com:8080',
        noProxy: ['*.example.com'],
      });
      const next = createMockNext();

      await policy(createMockContext('https://example.com/users'), next);

      expect(next).not.toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: expect.anything(),
        }),
      );
    });

    it('bypasses proxy for suffix match', async () => {
      const policy = proxy({
        url: 'http://proxy.corp.com:8080',
        noProxy: ['.example.com'],
      });
      const next = createMockNext();

      await policy(createMockContext('https://api.example.com/users'), next);

      expect(next).not.toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: expect.anything(),
        }),
      );
    });

    it('bypasses proxy for suffix exact match (.example.com matches example.com)', async () => {
      const policy = proxy({
        url: 'http://proxy.corp.com:8080',
        noProxy: ['.example.com'],
      });
      const next = createMockNext();

      await policy(createMockContext('https://example.com/users'), next);

      expect(next).not.toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: expect.anything(),
        }),
      );
    });

    it('bypasses proxy for IP range prefix match', async () => {
      const policy = proxy({
        url: 'http://proxy.corp.com:8080',
        noProxy: ['10.*'],
      });
      const next = createMockNext();

      await policy(createMockContext('http://10.0.0.1/api'), next);

      expect(next).not.toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: expect.anything(),
        }),
      );
    });

    it('bypasses proxy for wildcard all', async () => {
      const policy = proxy({
        url: 'http://proxy.corp.com:8080',
        noProxy: ['*'],
      });
      const next = createMockNext();

      await policy(createMockContext(), next);

      expect(next).not.toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: expect.anything(),
        }),
      );
    });

    it('does not bypass proxy for non-matching hosts', async () => {
      const policy = proxy({
        url: 'http://proxy.corp.com:8080',
        noProxy: ['localhost', 'internal.corp.com'],
      });
      const next = createMockNext();

      await policy(createMockContext('https://api.example.com/users'), next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: expect.objectContaining({
            host: 'proxy.corp.com',
          }),
        }),
      );
    });

    it('ignores empty patterns in noProxy list', async () => {
      const policy = proxy({
        url: 'http://proxy.corp.com:8080',
        noProxy: ['', '   ', 'api.example.com'],
      });
      const next = createMockNext();

      // api.example.com should still bypass despite empty patterns in the list
      await policy(createMockContext('https://api.example.com/users'), next);

      expect(next).not.toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: expect.anything(),
        }),
      );
    });
  });

  describe('proxy.fromEnv', () => {
    beforeEach(() => {
      vi.stubEnv('HTTP_PROXY', undefined);
      vi.stubEnv('HTTPS_PROXY', undefined);
      vi.stubEnv('NO_PROXY', undefined);
      vi.stubEnv('http_proxy', undefined);
      vi.stubEnv('https_proxy', undefined);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('uses HTTP_PROXY for HTTP requests', async () => {
      vi.stubEnv('HTTP_PROXY', 'http://proxy.corp.com:8080');
      const policy = proxy.fromEnv();
      const next = createMockNext();

      await policy(createMockContext('http://api.example.com/users'), next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: expect.objectContaining({
            host: 'proxy.corp.com',
            port: 8080,
          }),
        }),
      );
    });

    it('uses HTTPS_PROXY for HTTPS requests', async () => {
      vi.stubEnv('HTTPS_PROXY', 'http://secure-proxy.corp.com:8443');
      const policy = proxy.fromEnv();
      const next = createMockNext();

      await policy(createMockContext('https://api.example.com/users'), next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: expect.objectContaining({
            host: 'secure-proxy.corp.com',
            port: 8443,
          }),
        }),
      );
    });

    it('respects NO_PROXY environment variable', async () => {
      vi.stubEnv('HTTPS_PROXY', 'http://proxy.corp.com:8080');
      vi.stubEnv('NO_PROXY', 'localhost,api.example.com,.internal.com');
      const policy = proxy.fromEnv();
      const next = createMockNext();

      await policy(createMockContext('https://api.example.com/users'), next);

      expect(next).not.toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: expect.anything(),
        }),
      );
    });

    it('handles lowercase env vars', async () => {
      vi.stubEnv('http_proxy', 'http://proxy.corp.com:8080');
      const policy = proxy.fromEnv();
      const next = createMockNext();

      await policy(createMockContext('http://api.example.com/users'), next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          proxy: expect.objectContaining({
            host: 'proxy.corp.com',
          }),
        }),
      );
    });

    it('passes through when no proxy env vars set', async () => {
      // All env vars are already stubbed as undefined in beforeEach
      const policy = proxy.fromEnv();
      const next = createMockNext();

      await policy(createMockContext(), next);

      expect(next).toHaveBeenCalledWith(
        expect.not.objectContaining({
          proxy: expect.anything(),
        }),
      );
    });
  });

  describe('error handling', () => {
    it('throws on invalid proxy URL', () => {
      expect(() => proxy('not-a-valid-url')).toThrow('Invalid proxy URL');
    });
  });
});
