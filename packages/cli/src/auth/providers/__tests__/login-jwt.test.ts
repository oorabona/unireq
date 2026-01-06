/**
 * Tests for login-jwt provider
 * Following AAA pattern for unit tests
 */

import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { LoginJwtProviderConfig } from '../../types.js';
import {
  clearAllLoginJwtTokenCache,
  extractJsonPath,
  formatTokenValue,
  LoginRequestError,
  resolveLoginJwtProvider,
  TokenExtractionError,
} from '../login-jwt.js';

// Mock server for HTTP requests
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  // Clear token cache between tests to avoid interference
  clearAllLoginJwtTokenCache();
});
afterAll(() => server.close());

describe('extractJsonPath', () => {
  describe('when extracting simple paths', () => {
    it('should extract top-level property', () => {
      // Arrange
      const obj = { token: 'abc123' };

      // Act
      const result = extractJsonPath(obj, '$.token');

      // Assert
      expect(result).toBe('abc123');
    });

    it('should extract nested property', () => {
      // Arrange
      const obj = { data: { access_token: 'xyz789' } };

      // Act
      const result = extractJsonPath(obj, '$.data.access_token');

      // Assert
      expect(result).toBe('xyz789');
    });

    it('should extract deeply nested property', () => {
      // Arrange
      const obj = { response: { auth: { jwt: 'deep-token' } } };

      // Act
      const result = extractJsonPath(obj, '$.response.auth.jwt');

      // Assert
      expect(result).toBe('deep-token');
    });
  });

  describe('when path not found', () => {
    it('should return undefined for missing property', () => {
      // Arrange
      const obj = { token: 'abc123' };

      // Act
      const result = extractJsonPath(obj, '$.missing');

      // Assert
      expect(result).toBeUndefined();
    });

    it('should return undefined for missing nested property', () => {
      // Arrange
      const obj = { data: { other: 'value' } };

      // Act
      const result = extractJsonPath(obj, '$.data.access_token');

      // Assert
      expect(result).toBeUndefined();
    });

    it('should return undefined when parent is not an object', () => {
      // Arrange
      const obj = { data: 'not-an-object' };

      // Act
      const result = extractJsonPath(obj, '$.data.token');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('when given invalid input', () => {
    it('should throw for invalid path format', () => {
      // Arrange
      const obj = { token: 'abc' };

      // Act & Assert
      expect(() => extractJsonPath(obj, 'token')).toThrow("Invalid JSONPath: must start with '$.'");
    });

    it('should return undefined for null input', () => {
      // Arrange & Act
      const result = extractJsonPath(null, '$.token');

      // Assert
      expect(result).toBeUndefined();
    });

    it('should return undefined for non-object input', () => {
      // Arrange & Act
      const result = extractJsonPath('string', '$.token');

      // Assert
      expect(result).toBeUndefined();
    });
  });
});

describe('formatTokenValue', () => {
  it('should format with Bearer prefix', () => {
    // Arrange
    const token = 'my-jwt-token';
    const format = 'Bearer ${token}';

    // Act
    const result = formatTokenValue(token, format);

    // Assert
    expect(result).toBe('Bearer my-jwt-token');
  });

  it('should format with custom prefix', () => {
    // Arrange
    const token = 'my-jwt-token';
    const format = 'JWT ${token}';

    // Act
    const result = formatTokenValue(token, format);

    // Assert
    expect(result).toBe('JWT my-jwt-token');
  });

  it('should format token only', () => {
    // Arrange
    const token = 'raw-token';
    const format = '${token}';

    // Act
    const result = formatTokenValue(token, format);

    // Assert
    expect(result).toBe('raw-token');
  });
});

describe('resolveLoginJwtProvider', () => {
  const baseConfig: LoginJwtProviderConfig = {
    type: 'login_jwt',
    login: {
      method: 'POST',
      url: 'https://api.example.com/auth/login',
      body: {
        username: 'testuser',
        password: 'testpass',
      },
    },
    extract: {
      token: '$.access_token',
    },
    inject: {
      location: 'header',
      name: 'Authorization',
      format: 'Bearer ${token}',
    },
  };

  describe('when login succeeds', () => {
    it('should resolve credential from successful login', async () => {
      // Arrange
      server.use(
        http.post('https://api.example.com/auth/login', () => {
          return HttpResponse.json({
            access_token: 'jwt-token-12345',
            expires_in: 3600,
          });
        }),
      );

      // Act
      const result = await resolveLoginJwtProvider(baseConfig, { vars: {} });

      // Assert
      expect(result).toEqual({
        location: 'header',
        name: 'Authorization',
        value: 'Bearer jwt-token-12345',
      });
    });

    it('should extract nested token', async () => {
      // Arrange
      const config: LoginJwtProviderConfig = {
        ...baseConfig,
        extract: {
          token: '$.data.token',
        },
      };

      server.use(
        http.post('https://api.example.com/auth/login', () => {
          return HttpResponse.json({
            data: {
              token: 'nested-token-xyz',
            },
          });
        }),
      );

      // Act
      const result = await resolveLoginJwtProvider(config, { vars: {} });

      // Assert
      expect(result.value).toBe('Bearer nested-token-xyz');
    });

    it('should interpolate variables in login body', async () => {
      // Arrange
      const config: LoginJwtProviderConfig = {
        ...baseConfig,
        login: {
          ...baseConfig.login,
          body: {
            username: '${var:user}',
            password: '${var:pass}',
          },
        },
      };

      let capturedBody: unknown;
      server.use(
        http.post('https://api.example.com/auth/login', async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({ access_token: 'token' });
        }),
      );

      const context = {
        vars: {
          user: 'interpolated-user',
          pass: 'interpolated-pass',
        },
      };

      // Act
      await resolveLoginJwtProvider(config, context);

      // Assert
      expect(capturedBody).toEqual({
        username: 'interpolated-user',
        password: 'interpolated-pass',
      });
    });

    it('should interpolate variables in login URL', async () => {
      // Arrange
      const config: LoginJwtProviderConfig = {
        ...baseConfig,
        login: {
          ...baseConfig.login,
          url: 'https://${var:host}/auth/login',
        },
      };

      server.use(
        http.post('https://custom.api.com/auth/login', () => {
          return HttpResponse.json({ access_token: 'token-from-custom' });
        }),
      );

      const context = {
        vars: { host: 'custom.api.com' },
      };

      // Act
      const result = await resolveLoginJwtProvider(config, context);

      // Assert
      expect(result.value).toBe('Bearer token-from-custom');
    });

    it('should send custom headers', async () => {
      // Arrange
      const config: LoginJwtProviderConfig = {
        ...baseConfig,
        login: {
          ...baseConfig.login,
          headers: {
            'X-Custom-Header': 'custom-value',
            'X-API-Version': '2',
          },
        },
      };

      let capturedHeaders: Headers | undefined;
      server.use(
        http.post('https://api.example.com/auth/login', ({ request }) => {
          capturedHeaders = request.headers;
          return HttpResponse.json({ access_token: 'token' });
        }),
      );

      // Act
      await resolveLoginJwtProvider(config, { vars: {} });

      // Assert
      expect(capturedHeaders?.get('X-Custom-Header')).toBe('custom-value');
      expect(capturedHeaders?.get('X-API-Version')).toBe('2');
    });
  });

  describe('when login fails', () => {
    it('should throw LoginRequestError on 401', async () => {
      // Arrange
      server.use(
        http.post('https://api.example.com/auth/login', () => {
          return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
        }),
      );

      // Act & Assert
      await expect(resolveLoginJwtProvider(baseConfig, { vars: {} })).rejects.toThrow(LoginRequestError);
    });

    it('should throw LoginRequestError on 500', async () => {
      // Arrange
      server.use(
        http.post('https://api.example.com/auth/login', () => {
          return HttpResponse.json({ error: 'Internal error' }, { status: 500, statusText: 'Internal Server Error' });
        }),
      );

      // Act & Assert
      await expect(resolveLoginJwtProvider(baseConfig, { vars: {} })).rejects.toThrow(LoginRequestError);
    });

    it('should include status in error', async () => {
      // Arrange
      server.use(
        http.post('https://api.example.com/auth/login', () => {
          return HttpResponse.json({}, { status: 403, statusText: 'Forbidden' });
        }),
      );

      // Act & Assert
      try {
        await resolveLoginJwtProvider(baseConfig, { vars: {} });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(LoginRequestError);
        expect((error as LoginRequestError).status).toBe(403);
        expect((error as LoginRequestError).statusText).toBe('Forbidden');
      }
    });
  });

  describe('when token extraction fails', () => {
    it('should throw TokenExtractionError when path not found', async () => {
      // Arrange
      server.use(
        http.post('https://api.example.com/auth/login', () => {
          return HttpResponse.json({ wrong_field: 'value' });
        }),
      );

      // Act & Assert
      await expect(resolveLoginJwtProvider(baseConfig, { vars: {} })).rejects.toThrow(TokenExtractionError);
    });

    it('should throw TokenExtractionError when token is not a string', async () => {
      // Arrange
      server.use(
        http.post('https://api.example.com/auth/login', () => {
          return HttpResponse.json({ access_token: 12345 });
        }),
      );

      // Act & Assert
      await expect(resolveLoginJwtProvider(baseConfig, { vars: {} })).rejects.toThrow(TokenExtractionError);
    });

    it('should include path in error', async () => {
      // Arrange
      const config: LoginJwtProviderConfig = {
        ...baseConfig,
        extract: { token: '$.custom.path' },
      };

      server.use(
        http.post('https://api.example.com/auth/login', () => {
          return HttpResponse.json({ access_token: 'token' });
        }),
      );

      // Act & Assert
      try {
        await resolveLoginJwtProvider(config, { vars: {} });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TokenExtractionError);
        expect((error as TokenExtractionError).path).toBe('$.custom.path');
      }
    });
  });

  describe('with different HTTP methods', () => {
    it('should support PUT method', async () => {
      // Arrange
      const config: LoginJwtProviderConfig = {
        ...baseConfig,
        login: {
          ...baseConfig.login,
          method: 'PUT',
        },
      };

      server.use(
        http.put('https://api.example.com/auth/login', () => {
          return HttpResponse.json({ access_token: 'put-token' });
        }),
      );

      // Act
      const result = await resolveLoginJwtProvider(config, { vars: {} });

      // Assert
      expect(result.value).toBe('Bearer put-token');
    });

    it('should support PATCH method', async () => {
      // Arrange
      const config: LoginJwtProviderConfig = {
        ...baseConfig,
        login: {
          ...baseConfig.login,
          method: 'PATCH',
        },
      };

      server.use(
        http.patch('https://api.example.com/auth/login', () => {
          return HttpResponse.json({ access_token: 'patch-token' });
        }),
      );

      // Act
      const result = await resolveLoginJwtProvider(config, { vars: {} });

      // Assert
      expect(result.value).toBe('Bearer patch-token');
    });

    it('should throw for unsupported method', async () => {
      // Arrange
      const config: LoginJwtProviderConfig = {
        ...baseConfig,
        login: {
          ...baseConfig.login,
          method: 'GET',
        },
      };

      // Act & Assert
      await expect(resolveLoginJwtProvider(config, { vars: {} })).rejects.toThrow('Unsupported login method: GET');
    });
  });

  describe('with different injection configs', () => {
    it('should support query injection', async () => {
      // Arrange
      const config: LoginJwtProviderConfig = {
        ...baseConfig,
        inject: {
          location: 'query',
          name: 'token',
          format: '${token}',
        },
      };

      server.use(
        http.post('https://api.example.com/auth/login', () => {
          return HttpResponse.json({ access_token: 'query-token' });
        }),
      );

      // Act
      const result = await resolveLoginJwtProvider(config, { vars: {} });

      // Assert
      expect(result).toEqual({
        location: 'query',
        name: 'token',
        value: 'query-token',
      });
    });

    it('should support cookie injection', async () => {
      // Arrange
      const config: LoginJwtProviderConfig = {
        ...baseConfig,
        inject: {
          location: 'cookie',
          name: 'auth_token',
          format: '${token}',
        },
      };

      server.use(
        http.post('https://api.example.com/auth/login', () => {
          return HttpResponse.json({ access_token: 'cookie-token' });
        }),
      );

      // Act
      const result = await resolveLoginJwtProvider(config, { vars: {} });

      // Assert
      expect(result).toEqual({
        location: 'cookie',
        name: 'auth_token',
        value: 'cookie-token',
      });
    });
  });
});

describe('Token Caching', () => {
  const baseConfig: LoginJwtProviderConfig = {
    type: 'login_jwt',
    login: {
      method: 'POST',
      url: 'https://api.example.com/auth/login',
      body: {
        username: 'cache-test-user',
        password: 'cache-test-pass',
      },
    },
    extract: {
      token: '$.access_token',
      expiresIn: '$.expires_in',
    },
    inject: {
      location: 'header',
      name: 'Authorization',
      format: 'Bearer ${token}',
    },
  };

  it('should cache token and not make second request', async () => {
    // Arrange
    let requestCount = 0;
    server.use(
      http.post('https://api.example.com/auth/login', () => {
        requestCount++;
        return HttpResponse.json({
          access_token: 'cached-jwt-token',
          expires_in: 3600,
        });
      }),
    );

    // Act - first call should hit the server
    const result1 = await resolveLoginJwtProvider(baseConfig, { vars: {} });

    // Second call should use cache
    const result2 = await resolveLoginJwtProvider(baseConfig, { vars: {} });

    // Assert
    expect(requestCount).toBe(1); // Only one request made
    expect(result1.value).toBe('Bearer cached-jwt-token');
    expect(result2.value).toBe('Bearer cached-jwt-token');
  });

  it('should make fresh request with skipCache option', async () => {
    // Arrange
    let requestCount = 0;
    server.use(
      http.post('https://api.example.com/auth/login', () => {
        requestCount++;
        return HttpResponse.json({
          access_token: `jwt-token-${requestCount}`,
          expires_in: 3600,
        });
      }),
    );

    // Act - first call
    const result1 = await resolveLoginJwtProvider(baseConfig, { vars: {} });

    // Second call with skipCache
    const result2 = await resolveLoginJwtProvider(baseConfig, { vars: {} }, { skipCache: true });

    // Assert
    expect(requestCount).toBe(2);
    expect(result1.value).toBe('Bearer jwt-token-1');
    expect(result2.value).toBe('Bearer jwt-token-2');
  });

  it('should use different cache keys for different credentials', async () => {
    // Arrange
    let requestCount = 0;
    server.use(
      http.post('https://api.example.com/auth/login', () => {
        requestCount++;
        return HttpResponse.json({
          access_token: `user-token-${requestCount}`,
          expires_in: 3600,
        });
      }),
    );

    const config1 = {
      ...baseConfig,
      login: { ...baseConfig.login, body: { username: 'user1', password: 'pass1' } },
    };
    const config2 = {
      ...baseConfig,
      login: { ...baseConfig.login, body: { username: 'user2', password: 'pass2' } },
    };

    // Act
    const result1 = await resolveLoginJwtProvider(config1, { vars: {} });
    const result2 = await resolveLoginJwtProvider(config2, { vars: {} });
    const result3 = await resolveLoginJwtProvider(config1, { vars: {} }); // Should use cache

    // Assert
    expect(requestCount).toBe(2); // Only two requests (one per user)
    expect(result1.value).toBe('Bearer user-token-1');
    expect(result2.value).toBe('Bearer user-token-2');
    expect(result3.value).toBe('Bearer user-token-1'); // Cached
  });
});

describe('Refresh Token Flow', () => {
  const configWithRefresh: LoginJwtProviderConfig = {
    type: 'login_jwt',
    login: {
      method: 'POST',
      url: 'https://api.example.com/auth/login',
      body: {
        username: 'refresh-user',
        password: 'refresh-pass',
      },
    },
    extract: {
      token: '$.access_token',
      refreshToken: '$.refresh_token',
      expiresIn: '$.expires_in',
    },
    inject: {
      location: 'header',
      name: 'Authorization',
      format: 'Bearer ${token}',
    },
    refresh: {
      method: 'POST',
      url: 'https://api.example.com/auth/refresh',
      body: {
        refresh_token: '${refreshToken}',
      },
    },
  };

  it('should extract and cache refresh token from login response', async () => {
    // Arrange
    server.use(
      http.post('https://api.example.com/auth/login', () => {
        return HttpResponse.json({
          access_token: 'initial-access-token',
          refresh_token: 'refresh-token-123',
          expires_in: 3600,
        });
      }),
    );

    // Act
    const result = await resolveLoginJwtProvider(configWithRefresh, { vars: {} });

    // Assert
    expect(result.value).toBe('Bearer initial-access-token');
  });

  it('should use refresh token when access token is expired', async () => {
    // Arrange
    let loginCount = 0;
    let refreshCount = 0;

    server.use(
      http.post('https://api.example.com/auth/login', () => {
        loginCount++;
        return HttpResponse.json({
          access_token: 'initial-access-token',
          refresh_token: 'refresh-token-xyz',
          expires_in: 1, // Expires almost immediately (1 second - 30 second buffer = already expired)
        });
      }),
      http.post('https://api.example.com/auth/refresh', async ({ request }) => {
        refreshCount++;
        const body = await request.json();
        // Verify refresh token was sent
        expect(body).toEqual({ refresh_token: 'refresh-token-xyz' });
        return HttpResponse.json({
          access_token: 'refreshed-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        });
      }),
    );

    // Act - First call does login
    const result1 = await resolveLoginJwtProvider(configWithRefresh, { vars: {} });
    expect(result1.value).toBe('Bearer initial-access-token');
    expect(loginCount).toBe(1);

    // Second call should use refresh (token already expired due to safety buffer)
    const result2 = await resolveLoginJwtProvider(configWithRefresh, { vars: {} });

    // Assert
    expect(result2.value).toBe('Bearer refreshed-access-token');
    expect(loginCount).toBe(1); // No additional login
    expect(refreshCount).toBe(1); // Refresh was called
  });

  it('should fall back to full login when refresh fails', async () => {
    // Arrange
    let loginCount = 0;
    let refreshCount = 0;

    server.use(
      http.post('https://api.example.com/auth/login', () => {
        loginCount++;
        return HttpResponse.json({
          access_token: `login-token-${loginCount}`,
          refresh_token: 'refresh-token-abc',
          expires_in: 1, // Expires almost immediately
        });
      }),
      http.post('https://api.example.com/auth/refresh', () => {
        refreshCount++;
        return HttpResponse.json(
          { error: 'invalid_grant', error_description: 'Refresh token expired' },
          { status: 401 },
        );
      }),
    );

    // Act - First call does login
    const result1 = await resolveLoginJwtProvider(configWithRefresh, { vars: {} });
    expect(loginCount).toBe(1);

    // Second call - refresh fails, should fall back to login
    const result2 = await resolveLoginJwtProvider(configWithRefresh, { vars: {} });

    // Assert
    expect(refreshCount).toBe(1); // Refresh was attempted
    expect(loginCount).toBe(2); // Full login after refresh failure
    expect(result1.value).toBe('Bearer login-token-1');
    expect(result2.value).toBe('Bearer login-token-2');
  });

  it('should update refresh token when new one is provided in refresh response', async () => {
    // Arrange
    let refreshCount = 0;
    const refreshTokens: string[] = [];

    server.use(
      http.post('https://api.example.com/auth/login', () => {
        return HttpResponse.json({
          access_token: 'initial-token',
          refresh_token: 'refresh-v1',
          expires_in: 1, // Expires immediately
        });
      }),
      http.post('https://api.example.com/auth/refresh', async ({ request }) => {
        refreshCount++;
        const body = (await request.json()) as { refresh_token: string };
        refreshTokens.push(body.refresh_token);

        // Return new refresh token each time
        return HttpResponse.json({
          access_token: `token-v${refreshCount + 1}`,
          refresh_token: `refresh-v${refreshCount + 1}`,
          expires_in: 1, // Keep expiring to test multiple refreshes
        });
      }),
    );

    // Act
    await resolveLoginJwtProvider(configWithRefresh, { vars: {} }); // Login
    await resolveLoginJwtProvider(configWithRefresh, { vars: {} }); // Refresh 1
    await resolveLoginJwtProvider(configWithRefresh, { vars: {} }); // Refresh 2

    // Assert
    expect(refreshCount).toBe(2);
    expect(refreshTokens).toEqual(['refresh-v1', 'refresh-v2']); // Each refresh uses the latest token
  });
});
