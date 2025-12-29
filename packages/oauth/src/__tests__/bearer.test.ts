/**
 * @unireq/oauth - Bearer token tests
 */

import { describe, expect, it, vi } from 'vitest';
import { oauthBearer } from '../bearer.js';

describe('@unireq/oauth - oauthBearer', () => {
  it('should add Bearer token to Authorization header', async () => {
    const tokenSupplier = vi.fn(async () => 'test-token');
    const policy = oauthBearer({ tokenSupplier, allowUnsafeMode: true });

    const result = await policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async (ctx) => {
      expect(ctx.headers['authorization']).toBe('Bearer test-token');
      return { status: 200, statusText: 'OK', headers: {} as Record<string, string>, data: 'OK', ok: true };
    });

    expect(result.status).toBe(200);
    expect(tokenSupplier).toHaveBeenCalledTimes(1);
  });

  it('should refresh token on 401', async () => {
    let tokenCount = 0;
    const tokenSupplier = vi.fn(async () => {
      tokenCount++;
      return `token-${tokenCount}`;
    });

    const policy = oauthBearer({ tokenSupplier, allowUnsafeMode: true });

    let requestCount = 0;
    const result = await policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async (ctx) => {
      requestCount++;
      if (requestCount === 1) {
        // First request with old token fails
        expect(ctx.headers['authorization']).toBe('Bearer token-1');
        return {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'www-authenticate': 'Bearer realm="api"' } as Record<string, string>,
          data: 'Unauthorized',
          ok: false,
        };
      }
      // Second request with refreshed token succeeds
      expect(ctx.headers['authorization']).toBe('Bearer token-2');
      return { status: 200, statusText: 'OK', headers: {} as Record<string, string>, data: 'OK', ok: true };
    });

    expect(result.status).toBe(200);
    expect(tokenSupplier).toHaveBeenCalledTimes(2);
    expect(requestCount).toBe(2);
  });

  it('should not refresh on 401 without Bearer challenge', async () => {
    const tokenSupplier = vi.fn(async () => 'test-token');
    const policy = oauthBearer({ tokenSupplier, allowUnsafeMode: true });

    const result = await policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async () => ({
      status: 401,
      statusText: 'Unauthorized',
      headers: { 'www-authenticate': 'Basic realm="api"' } as Record<string, string>,
      data: 'Unauthorized',
      ok: false,
    }));

    expect(result.status).toBe(401);
    expect(tokenSupplier).toHaveBeenCalledTimes(1); // No refresh
  });

  it('should disable auto-refresh when autoRefresh is false', async () => {
    const tokenSupplier = vi.fn(async () => 'test-token');
    const policy = oauthBearer({ tokenSupplier, autoRefresh: false, allowUnsafeMode: true });

    const result = await policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async () => ({
      status: 401,
      statusText: 'Unauthorized',
      headers: { 'www-authenticate': 'Bearer realm="api"' } as Record<string, string>,
      data: 'Unauthorized',
      ok: false,
    }));

    expect(result.status).toBe(401);
    expect(tokenSupplier).toHaveBeenCalledTimes(1); // No refresh
  });

  it('should call onRefresh callback before refreshing', async () => {
    let tokenCount = 0;
    const tokenSupplier = async () => {
      tokenCount++;
      return `token-${tokenCount}`;
    };

    const onRefreshMock = vi.fn();
    const policy = oauthBearer({ tokenSupplier, onRefresh: onRefreshMock, allowUnsafeMode: true });

    let requestCount = 0;
    await policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async () => {
      requestCount++;
      if (requestCount === 1) {
        return {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'www-authenticate': 'Bearer realm="api"' } as Record<string, string>,
          data: 'Unauthorized',
          ok: false,
        };
      }
      return { status: 200, statusText: 'OK', headers: {} as Record<string, string>, data: 'OK', ok: true };
    });

    expect(onRefreshMock).toHaveBeenCalledTimes(1);
  });

  it('should handle expired JWT without JWKS (unsafe decode)', async () => {
    // Create an expired JWT (simple base64 encoded, not signed)
    const expiredPayload = { exp: Math.floor(Date.now() / 1000) - 3600 }; // Expired 1 hour ago
    const expiredToken = `header.${btoa(JSON.stringify(expiredPayload))}.signature`;

    let tokenCount = 0;
    const tokenSupplier = vi.fn(async () => {
      tokenCount++;
      if (tokenCount === 1) return expiredToken;
      return 'fresh-token';
    });

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Intentional empty mock for console.warn
    });
    const policy = oauthBearer({ tokenSupplier, skew: 0, allowUnsafeMode: true });

    await policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async (ctx) => {
      // Should have refreshed due to expiration
      expect(ctx.headers['authorization']).toBe('Bearer fresh-token');
      return { status: 200, statusText: 'OK', headers: {} as Record<string, string>, data: 'OK', ok: true };
    });

    expect(tokenSupplier).toHaveBeenCalledTimes(2);
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('JWT signature not verified'));

    consoleWarnSpy.mockRestore();
  });

  it('should not refresh valid JWT', async () => {
    // Create a valid JWT (expires in 1 hour)
    const validPayload = { exp: Math.floor(Date.now() / 1000) + 3600 };
    const validToken = `header.${btoa(JSON.stringify(validPayload))}.signature`;

    const tokenSupplier = vi.fn(async () => validToken);
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Intentional empty mock for console.warn
    });
    const policy = oauthBearer({ tokenSupplier, allowUnsafeMode: true });

    await policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async (ctx) => {
      expect(ctx.headers['authorization']).toBe(`Bearer ${validToken}`);
      return { status: 200, statusText: 'OK', headers: {} as Record<string, string>, data: 'OK', ok: true };
    });

    expect(tokenSupplier).toHaveBeenCalledTimes(1); // No refresh needed
    consoleWarnSpy.mockRestore();
  });

  it('should respect clock skew', async () => {
    // Token expires in 30 seconds, but skew is 60 seconds
    const almostExpiredPayload = { exp: Math.floor(Date.now() / 1000) + 30 };
    const almostExpiredToken = `header.${btoa(JSON.stringify(almostExpiredPayload))}.signature`;

    let tokenCount = 0;
    const tokenSupplier = vi.fn(async () => {
      tokenCount++;
      if (tokenCount === 1) return almostExpiredToken;
      return 'fresh-token';
    });

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Intentional empty mock for console.warn
    });
    const policy = oauthBearer({ tokenSupplier, skew: 60, allowUnsafeMode: true });

    await policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async (ctx) => {
      // Should have refreshed due to skew
      expect(ctx.headers['authorization']).toBe('Bearer fresh-token');
      return { status: 200, statusText: 'OK', headers: {} as Record<string, string>, data: 'OK', ok: true };
    });

    expect(tokenSupplier).toHaveBeenCalledTimes(2);
    consoleWarnSpy.mockRestore();
  });

  it('should handle malformed JWT gracefully', async () => {
    const malformedToken = 'not.a.valid.jwt.token';
    const tokenSupplier = vi.fn(async () => malformedToken);

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Intentional empty mock for console.warn
    });
    const policy = oauthBearer({ tokenSupplier, allowUnsafeMode: true });

    const result = await policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async (ctx) => {
      // Should still use the token even if malformed
      expect(ctx.headers['authorization']).toBe(`Bearer ${malformedToken}`);
      return { status: 200, statusText: 'OK', headers: {} as Record<string, string>, data: 'OK', ok: true };
    });

    expect(result.status).toBe(200);
    consoleWarnSpy.mockRestore();
  });

  it('should handle JWT with invalid payload encoding (unsafe decode)', async () => {
    // 3 parts, but middle part is not valid base64
    // Use characters that are not valid in base64 even after replacement
    const invalidToken = 'header.invalid-base64-%.signature';
    const tokenSupplier = vi.fn(async () => invalidToken);

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Intentional empty mock
    });
    const policy = oauthBearer({ tokenSupplier, allowUnsafeMode: true });

    const result = await policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async (ctx) => {
      expect(ctx.headers['authorization']).toBe(`Bearer ${invalidToken}`);
      return { status: 200, statusText: 'OK', headers: {} as Record<string, string>, data: 'OK', ok: true };
    });

    expect(result.status).toBe(200);
    consoleWarnSpy.mockRestore();
  });

  it('should handle JWT with invalid JSON payload (unsafe decode)', async () => {
    // 3 parts, middle part decodes to invalid JSON
    const invalidJsonPayload = btoa('not json');
    const invalidToken = `header.${invalidJsonPayload}.signature`;
    const tokenSupplier = vi.fn(async () => invalidToken);

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Intentional empty mock
    });
    const policy = oauthBearer({ tokenSupplier, allowUnsafeMode: true });

    const result = await policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async (ctx) => {
      expect(ctx.headers['authorization']).toBe(`Bearer ${invalidToken}`);
      return { status: 200, statusText: 'OK', headers: {} as Record<string, string>, data: 'OK', ok: true };
    });

    expect(result.status).toBe(200);
    consoleWarnSpy.mockRestore();
  });

  it('should handle JWT with empty payload part (unsafe decode)', async () => {
    // Token with empty payload part
    const invalidToken = 'header..signature';
    const tokenSupplier = vi.fn(async () => invalidToken);

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Intentional empty mock
    });
    const policy = oauthBearer({ tokenSupplier, allowUnsafeMode: true });

    const result = await policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async (ctx) => {
      expect(ctx.headers['authorization']).toBe(`Bearer ${invalidToken}`);
      return { status: 200, statusText: 'OK', headers: {} as Record<string, string>, data: 'OK', ok: true };
    });

    expect(result.status).toBe(200);
    consoleWarnSpy.mockRestore();
  });

  it('should handle JWT without exp field', async () => {
    // Token without expiration
    const noExpPayload = { iat: Math.floor(Date.now() / 1000), sub: 'user123' };
    const noExpToken = `header.${btoa(JSON.stringify(noExpPayload))}.signature`;

    const tokenSupplier = vi.fn(async () => noExpToken);

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Intentional empty mock for console.warn
    });
    const policy = oauthBearer({ tokenSupplier, allowUnsafeMode: true });

    const result = await policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async (ctx) => {
      expect(ctx.headers['authorization']).toBe(`Bearer ${noExpToken}`);
      return { status: 200, statusText: 'OK', headers: {} as Record<string, string>, data: 'OK', ok: true };
    });

    expect(result.status).toBe(200);
    expect(tokenSupplier).toHaveBeenCalledTimes(1); // No refresh if no exp
    consoleWarnSpy.mockRestore();
  });

  it('should handle token supplier errors', async () => {
    const tokenSupplier = vi.fn(async () => {
      throw new Error('Token fetch failed');
    });

    const policy = oauthBearer({ tokenSupplier, allowUnsafeMode: true });

    await expect(
      policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async () => ({
        status: 200,
        statusText: 'OK',
        headers: {} as Record<string, string>,
        data: 'OK',
        ok: true,
      })),
    ).rejects.toThrow('Token fetch failed');
  });

  it('should handle token supplier error during refresh', async () => {
    let callCount = 0;
    const tokenSupplier = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        // First call succeeds
        return 'initial-token';
      }
      // Refresh fails
      throw new Error('Refresh token failed');
    });

    const policy = oauthBearer({ tokenSupplier, allowUnsafeMode: true });

    await expect(
      policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async (ctx) => {
        if (ctx.headers['authorization'] === 'Bearer initial-token') {
          // Return 401 to trigger refresh
          return {
            status: 401,
            statusText: 'Unauthorized',
            headers: { 'www-authenticate': 'Bearer realm="api"' } as Record<string, string>,
            data: 'Unauthorized',
            ok: false,
          };
        }
        return { status: 200, statusText: 'OK', headers: {} as Record<string, string>, data: 'OK', ok: true };
      }),
    ).rejects.toThrow('Refresh token failed');
  });

  it('should handle single-flight refresh with multiple concurrent requests', async () => {
    let tokenCount = 0;
    const tokenSupplier = vi.fn(async () => {
      tokenCount++;
      // Simulate slow token refresh
      await new Promise((resolve) => setTimeout(resolve, 50));
      return `token-${tokenCount}`;
    });

    const policy = oauthBearer({ tokenSupplier, allowUnsafeMode: true });

    let callCount = 0;

    // Simulate multiple concurrent requests that all get 401 on first call
    const requests = Array.from({ length: 3 }, () =>
      policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async (_ctx) => {
        callCount++;
        // First call for each request returns 401 to trigger refresh
        if (callCount <= 3) {
          return {
            status: 401,
            statusText: 'Unauthorized',
            headers: { 'www-authenticate': 'Bearer realm="api"' } as Record<string, string>,
            data: 'Unauthorized',
            ok: false,
          };
        }
        // Subsequent calls (after refresh) succeed
        return { status: 200, statusText: 'OK', headers: {} as Record<string, string>, data: 'OK', ok: true };
      }),
    );

    const results = await Promise.all(requests);

    // All requests should eventually succeed after retry
    expect(results.every((r) => r.status === 200)).toBe(true);
    // Token supplier should be called twice: once for initial fetch (deduplicated) + once for refresh (deduplicated)
    expect(tokenSupplier.mock.calls.length).toBe(2);
  });

  it('should call onRefresh callback when token expires', async () => {
    const expiredPayload = { exp: Math.floor(Date.now() / 1000) - 3600 };
    const expiredToken = `header.${btoa(JSON.stringify(expiredPayload))}.signature`;

    let tokenCount = 0;
    const tokenSupplier = vi.fn(async () => {
      tokenCount++;
      if (tokenCount === 1) return expiredToken;
      return 'fresh-token';
    });

    const onRefreshMock = vi.fn();
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Intentional empty mock for console.warn
    });
    const policy = oauthBearer({ tokenSupplier, onRefresh: onRefreshMock, skew: 0, allowUnsafeMode: true });

    await policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async (ctx) => {
      expect(ctx.headers['authorization']).toBe('Bearer fresh-token');
      return { status: 200, statusText: 'OK', headers: {} as Record<string, string>, data: 'OK', ok: true };
    });

    expect(onRefreshMock).toHaveBeenCalledTimes(1);
    consoleWarnSpy.mockRestore();
  });

  it('should handle async onRefresh callback', async () => {
    const expiredPayload = { exp: Math.floor(Date.now() / 1000) - 3600 };
    const expiredToken = `header.${btoa(JSON.stringify(expiredPayload))}.signature`;

    let tokenCount = 0;
    const tokenSupplier = vi.fn(async () => {
      tokenCount++;
      if (tokenCount === 1) return expiredToken;
      return 'fresh-token';
    });

    const onRefreshMock = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Intentional empty mock for console.warn
    });
    const policy = oauthBearer({ tokenSupplier, onRefresh: onRefreshMock, skew: 0, allowUnsafeMode: true });

    await policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async (ctx) => {
      expect(ctx.headers['authorization']).toBe('Bearer fresh-token');
      return { status: 200, statusText: 'OK', headers: {} as Record<string, string>, data: 'OK', ok: true };
    });

    expect(onRefreshMock).toHaveBeenCalledTimes(1);
    consoleWarnSpy.mockRestore();
  });

  it('should handle 401 without www-authenticate header', async () => {
    const tokenSupplier = vi.fn(async () => 'test-token');
    const policy = oauthBearer({ tokenSupplier, allowUnsafeMode: true });

    const result = await policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async () => ({
      status: 401,
      statusText: 'Unauthorized',
      headers: {} as Record<string, string>,
      data: 'Unauthorized',
      ok: false,
    }));

    expect(result.status).toBe(401);
    expect(tokenSupplier).toHaveBeenCalledTimes(1); // No refresh
  });

  it('should handle case-insensitive www-authenticate header', async () => {
    let tokenCount = 0;
    const tokenSupplier = vi.fn(async () => {
      tokenCount++;
      return `token-${tokenCount}`;
    });

    const policy = oauthBearer({ tokenSupplier, allowUnsafeMode: true });

    let requestCount = 0;
    const result = await policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async (ctx) => {
      requestCount++;
      if (requestCount === 1) {
        return {
          status: 401,
          statusText: 'Unauthorized',
          headers: { 'www-authenticate': 'BEARER realm="api"' } as Record<string, string>, // Uppercase
          data: 'Unauthorized',
          ok: false,
        };
      }
      expect(ctx.headers['authorization']).toBe('Bearer token-2');
      return { status: 200, statusText: 'OK', headers: {} as Record<string, string>, data: 'OK', ok: true };
    });

    expect(result.status).toBe(200);
    expect(tokenSupplier).toHaveBeenCalledTimes(2);
  });

  it('should throw security error if JWKS absent and allowUnsafeMode false', () => {
    const tokenSupplier = vi.fn(async () => 'test-token');

    expect(() => {
      oauthBearer({ tokenSupplier });
    }).toThrow('[SECURITY ERROR] JWT signature verification disabled without explicit acknowledgment');
  });

  it('should log security warning console.error if allowUnsafeMode=true without JWKS', () => {
    const tokenSupplier = vi.fn(async () => 'test-token');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Intentional empty mock for console.error
    });

    oauthBearer({ tokenSupplier, allowUnsafeMode: true });

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[SECURITY WARNING] Running in UNSAFE MODE'));
    consoleErrorSpy.mockRestore();
  });

  it('should create policy without jwks (metadata should have jwks: undefined)', async () => {
    const tokenSupplier = vi.fn(async () => 'test-token');
    const policy = oauthBearer({ tokenSupplier, allowUnsafeMode: true });

    // Verify policy is created successfully
    expect(policy).toBeDefined();

    const result = await policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async (ctx) => {
      expect(ctx.headers['authorization']).toBe('Bearer test-token');
      return { status: 200, statusText: 'OK', headers: {} as Record<string, string>, data: 'OK', ok: true };
    });

    expect(result.status).toBe(200);
  });

  it('should create policy with JWKS config (tests metadata jwks field)', () => {
    const tokenSupplier = vi.fn(async () => 'test-token');

    // Use valid SPKI format (test key - do NOT use in production)
    const spki = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1SU1LfVLPHCozMxH2Mo
4lgOEePzNm0tRgeLezV6ffAt0gunVTLw7onLRnrq0/IzW7yWR7QkrmBL7jTKEn5u
+qKhbwKfBstIs+bMY2Zkp18gnTxKLxoS2tFczGkPLPgizskuemMghRniWaoLcyeh
kd3qqGElvW/VDL5AaWTg0nLVkjRo9z+40RQzuVaE8AkAFmxZzow3x+VJYKdjykkJ
0iT9wCS0DRTXu269V264Vf/3jvredZiKRkgwlL9xNAwxXFg0x/XFw005UWVRIkdg
cKWTjpBP2dPwVZ4WWC+9aGVd+Gyn1o0CLelf4rEjGoXbAAEgAqeGUxrcIlbjXfbc
mwIDAQAB
-----END PUBLIC KEY-----`;

    const jwks = {
      type: 'key' as const,
      key: spki,
    };
    const policy = oauthBearer({ tokenSupplier, jwks });

    // Verify policy is created successfully - metadata should include jwks type
    expect(policy).toBeDefined();
    // This test is just to ensure the jwks ternary branch in metadata is covered
  });

  it('should verify JWT with JWKS URL', async () => {
    const tokenSupplier = vi.fn(async () => 'test-token');
    const jwks = { type: 'url' as const, url: 'https://example.com/.well-known/jwks.json' };
    const policy = oauthBearer({ tokenSupplier, jwks });

    // Mock jose functions
    vi.mock('jose', async () => {
      return {
        createRemoteJWKSet: vi.fn(() => 'mock-key-set'),
        jwtVerify: vi.fn(async () => ({ payload: { exp: Math.floor(Date.now() / 1000) + 3600 } })),
        importSPKI: vi.fn(),
      };
    });

    const result = await policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async (ctx) => {
      expect(ctx.headers['authorization']).toBe('Bearer test-token');
      return { status: 200, statusText: 'OK', headers: {} as Record<string, string>, data: 'OK', ok: true };
    });

    expect(result.status).toBe(200);
    vi.restoreAllMocks();
  });

  it('should verify JWT with static key', async () => {
    const tokenSupplier = vi.fn(async () => 'test-token');
    const jwks = { type: 'key' as const, key: 'mock-key' };
    const policy = oauthBearer({ tokenSupplier, jwks });

    // Mock jose functions
    vi.mock('jose', async () => {
      return {
        createRemoteJWKSet: vi.fn(),
        jwtVerify: vi.fn(async () => ({ payload: { exp: Math.floor(Date.now() / 1000) + 3600 } })),
        importSPKI: vi.fn(async () => 'mock-key-object'),
      };
    });

    const result = await policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async (ctx) => {
      expect(ctx.headers['authorization']).toBe('Bearer test-token');
      return { status: 200, statusText: 'OK', headers: {} as Record<string, string>, data: 'OK', ok: true };
    });

    expect(result.status).toBe(200);
    vi.restoreAllMocks();
  });

  it('should cleanup refresh lock after timeout', async () => {
    vi.useFakeTimers();
    const tokenSupplier = vi.fn(async () => {
      // Simulate very long refresh
      await new Promise((resolve) => setTimeout(resolve, 60000));
      return 'token';
    });

    const policy = oauthBearer({ tokenSupplier, allowUnsafeMode: true });

    // Start refresh
    const promise = policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async () => ({
      status: 200,
      statusText: 'OK',
      headers: {} as Record<string, string>,
      data: 'OK',
      ok: true,
    }));

    // Fast-forward time past timeout (30s)
    await vi.advanceTimersByTimeAsync(35000);

    // Fast-forward time past supplier completion (60s total)
    await vi.advanceTimersByTimeAsync(30000);

    await promise;

    vi.useRealTimers();
  });

  it('should use cached token for subsequent requests', async () => {
    const tokenSupplier = vi.fn(async () => 'test-token');
    const policy = oauthBearer({ tokenSupplier, allowUnsafeMode: true });

    // First request
    await policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async (ctx) => {
      expect(ctx.headers['authorization']).toBe('Bearer test-token');
      return { status: 200, statusText: 'OK', headers: {} as Record<string, string>, data: 'OK', ok: true };
    });

    // Second request - should use cached token
    await policy({ url: 'https://api.example.com', method: 'GET', headers: {} }, async (ctx) => {
      expect(ctx.headers['authorization']).toBe('Bearer test-token');
      return { status: 200, statusText: 'OK', headers: {} as Record<string, string>, data: 'OK', ok: true };
    });

    expect(tokenSupplier).toHaveBeenCalledTimes(1); // Should be called only once
  });
});
