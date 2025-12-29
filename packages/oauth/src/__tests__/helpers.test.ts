import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  jwksFromIssuer,
  jwksFromKey,
  jwksFromUrl,
  tokenFromClientCredentials,
  tokenFromEnv,
  tokenFromRefresh,
  tokenFromStatic,
  tokenWithCache,
} from '../helpers.js';

describe('JWKS helpers', () => {
  describe('jwksFromUrl', () => {
    it('should create a URL-based JWKS source', () => {
      const jwks = jwksFromUrl('https://auth.example.com/.well-known/jwks.json');
      expect(jwks).toEqual({
        type: 'url',
        url: 'https://auth.example.com/.well-known/jwks.json',
      });
    });
  });

  describe('jwksFromKey', () => {
    it('should create a key-based JWKS source', () => {
      const pemKey = '-----BEGIN PUBLIC KEY-----\nMIIB...\n-----END PUBLIC KEY-----';
      const jwks = jwksFromKey(pemKey);
      expect(jwks).toEqual({
        type: 'key',
        key: pemKey,
      });
    });
  });

  describe('jwksFromIssuer', () => {
    it('should derive JWKS URL from issuer', () => {
      const jwks = jwksFromIssuer('https://auth.example.com');
      expect(jwks).toEqual({
        type: 'url',
        url: 'https://auth.example.com/.well-known/jwks.json',
      });
    });

    it('should handle trailing slash in issuer', () => {
      const jwks = jwksFromIssuer('https://auth.example.com/');
      expect(jwks).toEqual({
        type: 'url',
        url: 'https://auth.example.com/.well-known/jwks.json',
      });
    });

    it('should work with Auth0-style issuers', () => {
      const jwks = jwksFromIssuer('https://my-tenant.auth0.com/');
      expect(jwks.type === 'url' && jwks.url).toBe('https://my-tenant.auth0.com/.well-known/jwks.json');
    });
  });
});

describe('Token supplier helpers', () => {
  describe('tokenFromEnv', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('should return token from environment variable', () => {
      vi.stubEnv('TEST_TOKEN', 'my-test-token');
      const supplier = tokenFromEnv('TEST_TOKEN');
      expect(supplier()).toBe('my-test-token');
    });

    it('should throw if environment variable is not set', () => {
      vi.stubEnv('MISSING_TOKEN', undefined);
      const supplier = tokenFromEnv('MISSING_TOKEN');
      expect(() => supplier()).toThrow('Environment variable MISSING_TOKEN is not set');
    });
  });

  describe('tokenFromStatic', () => {
    it('should return the static token', () => {
      const supplier = tokenFromStatic('static-token-123');
      expect(supplier()).toBe('static-token-123');
    });

    it('should return same token on multiple calls', () => {
      const supplier = tokenFromStatic('consistent-token');
      expect(supplier()).toBe('consistent-token');
      expect(supplier()).toBe('consistent-token');
      expect(supplier()).toBe('consistent-token');
    });
  });

  describe('tokenWithCache', () => {
    it('should cache token for TTL duration', async () => {
      vi.useFakeTimers();
      let callCount = 0;
      const supplier = async () => {
        callCount++;
        return `token-${callCount}`;
      };

      const cached = tokenWithCache(supplier, 1000);

      // First call - should invoke supplier
      const token1 = await cached();
      expect(token1).toBe('token-1');
      expect(callCount).toBe(1);

      // Second call within TTL - should return cached
      vi.advanceTimersByTime(500);
      const token2 = await cached();
      expect(token2).toBe('token-1');
      expect(callCount).toBe(1);

      // Third call after TTL - should invoke supplier again
      vi.advanceTimersByTime(501);
      const token3 = await cached();
      expect(token3).toBe('token-2');
      expect(callCount).toBe(2);

      vi.useRealTimers();
    });

    it('should use default 5 minute TTL', async () => {
      vi.useFakeTimers();
      let callCount = 0;
      const supplier = async () => {
        callCount++;
        return `token-${callCount}`;
      };

      const cached = tokenWithCache(supplier); // Default TTL

      await cached();
      expect(callCount).toBe(1);

      // Still cached after 4 minutes
      vi.advanceTimersByTime(4 * 60 * 1000);
      await cached();
      expect(callCount).toBe(1);

      // Expired after 5 minutes
      vi.advanceTimersByTime(1 * 60 * 1000 + 1);
      await cached();
      expect(callCount).toBe(2);

      vi.useRealTimers();
    });
  });
});

describe('tokenFromRefresh', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch access token using refresh token', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'new-access-token' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const supplier = tokenFromRefresh({
      tokenEndpoint: 'https://auth.example.com/token',
      clientId: 'my-client',
      refreshToken: 'my-refresh-token',
    });

    const token = await supplier();

    expect(token).toBe('new-access-token');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://auth.example.com/token',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }),
    );

    const bodyStr = (mockFetch.mock.calls[0]?.[1] as { body: string }).body;
    expect(bodyStr).toContain('grant_type=refresh_token');
    expect(bodyStr).toContain('client_id=my-client');
    expect(bodyStr).toContain('refresh_token=my-refresh-token');
  });

  it('should include client_secret when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'access-token' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const supplier = tokenFromRefresh({
      tokenEndpoint: 'https://auth.example.com/token',
      clientId: 'my-client',
      clientSecret: 'my-secret',
      refreshToken: 'my-refresh-token',
    });

    await supplier();

    const bodyStr = (mockFetch.mock.calls[0]?.[1] as { body: string }).body;
    expect(bodyStr).toContain('client_secret=my-secret');
  });

  it('should support dynamic refresh token supplier', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'access-token' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const dynamicRefresh = vi.fn().mockResolvedValue('dynamic-refresh-token');

    const supplier = tokenFromRefresh({
      tokenEndpoint: 'https://auth.example.com/token',
      clientId: 'my-client',
      refreshToken: dynamicRefresh,
    });

    await supplier();

    expect(dynamicRefresh).toHaveBeenCalled();
    const bodyStr = (mockFetch.mock.calls[0]?.[1] as { body: string }).body;
    expect(bodyStr).toContain('refresh_token=dynamic-refresh-token');
  });

  it('should call onTokens callback with response', async () => {
    const tokenResponse = {
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 3600,
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(tokenResponse),
    });
    vi.stubGlobal('fetch', mockFetch);

    const onTokens = vi.fn();
    const supplier = tokenFromRefresh({
      tokenEndpoint: 'https://auth.example.com/token',
      clientId: 'my-client',
      refreshToken: 'my-refresh-token',
      onTokens,
    });

    await supplier();

    expect(onTokens).toHaveBeenCalledWith(tokenResponse);
  });

  it('should include additional params', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'access-token' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const supplier = tokenFromRefresh({
      tokenEndpoint: 'https://auth.example.com/token',
      clientId: 'my-client',
      refreshToken: 'my-refresh-token',
      additionalParams: { scope: 'read write', audience: 'https://api.example.com' },
    });

    await supplier();

    const bodyStr = (mockFetch.mock.calls[0]?.[1] as { body: string }).body;
    expect(bodyStr).toContain('scope=read+write');
    expect(bodyStr).toContain('audience=https%3A%2F%2Fapi.example.com');
  });

  it('should throw on failed refresh request', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('invalid_grant'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const supplier = tokenFromRefresh({
      tokenEndpoint: 'https://auth.example.com/token',
      clientId: 'my-client',
      refreshToken: 'expired-refresh-token',
    });

    await expect(supplier()).rejects.toThrow('Token refresh failed: 401 - invalid_grant');
  });

  it('should handle text() error on failed request', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.reject(new Error('Network error')),
    });
    vi.stubGlobal('fetch', mockFetch);

    const supplier = tokenFromRefresh({
      tokenEndpoint: 'https://auth.example.com/token',
      clientId: 'my-client',
      refreshToken: 'my-refresh-token',
    });

    await expect(supplier()).rejects.toThrow('Token refresh failed: 500 - Unknown error');
  });
});

describe('tokenFromClientCredentials', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch access token using client credentials', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'client-token' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const supplier = tokenFromClientCredentials({
      tokenEndpoint: 'https://auth.example.com/token',
      clientId: 'service-client',
      clientSecret: 'service-secret',
    });

    const token = await supplier();

    expect(token).toBe('client-token');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://auth.example.com/token',
      expect.objectContaining({
        method: 'POST',
      }),
    );

    const bodyStr = (mockFetch.mock.calls[0]?.[1] as { body: string }).body;
    expect(bodyStr).toContain('grant_type=client_credentials');
    expect(bodyStr).toContain('client_id=service-client');
    expect(bodyStr).toContain('client_secret=service-secret');
  });

  it('should include scope when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'client-token' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const supplier = tokenFromClientCredentials({
      tokenEndpoint: 'https://auth.example.com/token',
      clientId: 'service-client',
      clientSecret: 'service-secret',
      scope: 'read:api write:api',
    });

    await supplier();

    const bodyStr = (mockFetch.mock.calls[0]?.[1] as { body: string }).body;
    expect(bodyStr).toContain('scope=read%3Aapi+write%3Aapi');
  });

  it('should include additional params', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: 'client-token' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const supplier = tokenFromClientCredentials({
      tokenEndpoint: 'https://auth.example.com/token',
      clientId: 'service-client',
      clientSecret: 'service-secret',
      additionalParams: { audience: 'https://api.example.com' },
    });

    await supplier();

    const bodyStr = (mockFetch.mock.calls[0]?.[1] as { body: string }).body;
    expect(bodyStr).toContain('audience=https%3A%2F%2Fapi.example.com');
  });

  it('should throw on failed client credentials request', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('unauthorized_client'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const supplier = tokenFromClientCredentials({
      tokenEndpoint: 'https://auth.example.com/token',
      clientId: 'bad-client',
      clientSecret: 'bad-secret',
    });

    await expect(supplier()).rejects.toThrow('Client credentials grant failed: 401 - unauthorized_client');
  });

  it('should handle text() error on failed request', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.reject(new Error('Network error')),
    });
    vi.stubGlobal('fetch', mockFetch);

    const supplier = tokenFromClientCredentials({
      tokenEndpoint: 'https://auth.example.com/token',
      clientId: 'service-client',
      clientSecret: 'service-secret',
    });

    await expect(supplier()).rejects.toThrow('Client credentials grant failed: 500 - Unknown error');
  });
});
