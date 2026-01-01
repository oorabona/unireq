/**
 * Tests for login-jwt provider
 * Following AAA pattern for unit tests
 */

import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { LoginJwtProviderConfig } from '../../types.js';
import {
  extractJsonPath,
  formatTokenValue,
  LoginRequestError,
  resolveLoginJwtProvider,
  TokenExtractionError,
} from '../login-jwt.js';

// Mock server for HTTP requests
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
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
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Test format pattern
    const format = 'Bearer ${token}';

    // Act
    const result = formatTokenValue(token, format);

    // Assert
    expect(result).toBe('Bearer my-jwt-token');
  });

  it('should format with custom prefix', () => {
    // Arrange
    const token = 'my-jwt-token';
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Test format pattern
    const format = 'JWT ${token}';

    // Act
    const result = formatTokenValue(token, format);

    // Assert
    expect(result).toBe('JWT my-jwt-token');
  });

  it('should format token only', () => {
    // Arrange
    const token = 'raw-token';
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Test format pattern
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
      // biome-ignore lint/suspicious/noTemplateCurlyInString: Config format pattern
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
            // biome-ignore lint/suspicious/noTemplateCurlyInString: Config format pattern
            username: '${var:user}',
            // biome-ignore lint/suspicious/noTemplateCurlyInString: Config format pattern
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
          // biome-ignore lint/suspicious/noTemplateCurlyInString: Config format pattern
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
          // biome-ignore lint/suspicious/noTemplateCurlyInString: Config format pattern
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
          // biome-ignore lint/suspicious/noTemplateCurlyInString: Config format pattern
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
