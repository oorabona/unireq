/**
 * Tests for OAuth2 Client Credentials provider
 * Following AAA pattern for unit tests
 */

import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { OAuth2ClientCredentialsConfig } from '../../types.js';
import { OAuth2TokenError, resolveOAuth2ClientCredentialsProvider } from '../oauth2-client-credentials.js';

// Mock server for HTTP requests
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('resolveOAuth2ClientCredentialsProvider', () => {
  const baseConfig: OAuth2ClientCredentialsConfig = {
    type: 'oauth2_client_credentials',
    tokenUrl: 'https://auth.example.com/oauth/token',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    inject: {
      location: 'header',
      name: 'Authorization',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: Config format pattern
      format: 'Bearer ${token}',
    },
  };

  describe('when token request succeeds', () => {
    it('should resolve credential from successful token request', async () => {
      // Arrange
      server.use(
        http.post('https://auth.example.com/oauth/token', () => {
          return HttpResponse.json({
            access_token: 'oauth2-access-token-12345',
            token_type: 'Bearer',
            expires_in: 3600,
          });
        }),
      );

      // Act
      const result = await resolveOAuth2ClientCredentialsProvider(baseConfig, { vars: {} });

      // Assert
      expect(result).toEqual({
        location: 'header',
        name: 'Authorization',
        value: 'Bearer oauth2-access-token-12345',
      });
    });

    it('should send correct form-encoded body', async () => {
      // Arrange
      let capturedBody: string | undefined;
      let capturedContentType: string | null | undefined;

      server.use(
        http.post('https://auth.example.com/oauth/token', async ({ request }) => {
          capturedContentType = request.headers.get('content-type');
          capturedBody = await request.text();
          return HttpResponse.json({
            access_token: 'token',
            token_type: 'Bearer',
          });
        }),
      );

      // Act
      await resolveOAuth2ClientCredentialsProvider(baseConfig, { vars: {} });

      // Assert
      expect(capturedContentType).toContain('application/x-www-form-urlencoded');
      expect(capturedBody).toContain('grant_type=client_credentials');
      expect(capturedBody).toContain('client_id=test-client-id');
      expect(capturedBody).toContain('client_secret=test-client-secret');
    });

    it('should include scope when provided', async () => {
      // Arrange
      const config: OAuth2ClientCredentialsConfig = {
        ...baseConfig,
        scope: 'read write admin',
      };

      let capturedBody: string | undefined;
      server.use(
        http.post('https://auth.example.com/oauth/token', async ({ request }) => {
          capturedBody = await request.text();
          return HttpResponse.json({
            access_token: 'scoped-token',
            token_type: 'Bearer',
          });
        }),
      );

      // Act
      await resolveOAuth2ClientCredentialsProvider(config, { vars: {} });

      // Assert
      expect(capturedBody).toContain('scope=read+write+admin');
    });

    it('should include audience when provided', async () => {
      // Arrange
      const config: OAuth2ClientCredentialsConfig = {
        ...baseConfig,
        audience: 'https://api.example.com',
      };

      let capturedBody: string | undefined;
      server.use(
        http.post('https://auth.example.com/oauth/token', async ({ request }) => {
          capturedBody = await request.text();
          return HttpResponse.json({
            access_token: 'audience-token',
            token_type: 'Bearer',
          });
        }),
      );

      // Act
      await resolveOAuth2ClientCredentialsProvider(config, { vars: {} });

      // Assert
      expect(capturedBody).toContain('audience=https%3A%2F%2Fapi.example.com');
    });

    it('should interpolate variables in clientId', async () => {
      // Arrange
      const config: OAuth2ClientCredentialsConfig = {
        ...baseConfig,
        // biome-ignore lint/suspicious/noTemplateCurlyInString: Config format pattern
        clientId: '${var:client_id}',
      };

      let capturedBody: string | undefined;
      server.use(
        http.post('https://auth.example.com/oauth/token', async ({ request }) => {
          capturedBody = await request.text();
          return HttpResponse.json({
            access_token: 'token',
            token_type: 'Bearer',
          });
        }),
      );

      const context = {
        vars: { client_id: 'interpolated-client' },
      };

      // Act
      await resolveOAuth2ClientCredentialsProvider(config, context);

      // Assert
      expect(capturedBody).toContain('client_id=interpolated-client');
    });

    it('should interpolate variables in clientSecret', async () => {
      // Arrange
      const config: OAuth2ClientCredentialsConfig = {
        ...baseConfig,
        // biome-ignore lint/suspicious/noTemplateCurlyInString: Config format pattern
        clientSecret: '${var:client_secret}',
      };

      let capturedBody: string | undefined;
      server.use(
        http.post('https://auth.example.com/oauth/token', async ({ request }) => {
          capturedBody = await request.text();
          return HttpResponse.json({
            access_token: 'token',
            token_type: 'Bearer',
          });
        }),
      );

      const context = {
        vars: { client_secret: 'secret-from-var' },
      };

      // Act
      await resolveOAuth2ClientCredentialsProvider(config, context);

      // Assert
      expect(capturedBody).toContain('client_secret=secret-from-var');
    });

    it('should interpolate variables in tokenUrl', async () => {
      // Arrange
      const config: OAuth2ClientCredentialsConfig = {
        ...baseConfig,
        // biome-ignore lint/suspicious/noTemplateCurlyInString: Config format pattern
        tokenUrl: 'https://${var:auth_host}/oauth/token',
      };

      server.use(
        http.post('https://custom-auth.example.com/oauth/token', () => {
          return HttpResponse.json({
            access_token: 'custom-token',
            token_type: 'Bearer',
          });
        }),
      );

      const context = {
        vars: { auth_host: 'custom-auth.example.com' },
      };

      // Act
      const result = await resolveOAuth2ClientCredentialsProvider(config, context);

      // Assert
      expect(result.value).toBe('Bearer custom-token');
    });

    it('should interpolate variables in scope', async () => {
      // Arrange
      const config: OAuth2ClientCredentialsConfig = {
        ...baseConfig,
        // biome-ignore lint/suspicious/noTemplateCurlyInString: Config format pattern
        scope: '${var:scopes}',
      };

      let capturedBody: string | undefined;
      server.use(
        http.post('https://auth.example.com/oauth/token', async ({ request }) => {
          capturedBody = await request.text();
          return HttpResponse.json({
            access_token: 'token',
            token_type: 'Bearer',
          });
        }),
      );

      const context = {
        vars: { scopes: 'api:read api:write' },
      };

      // Act
      await resolveOAuth2ClientCredentialsProvider(config, context);

      // Assert
      expect(capturedBody).toContain('scope=api%3Aread+api%3Awrite');
    });
  });

  describe('when token request fails', () => {
    it('should throw OAuth2TokenError on 401', async () => {
      // Arrange
      server.use(
        http.post('https://auth.example.com/oauth/token', () => {
          return HttpResponse.json(
            { error: 'invalid_client', error_description: 'Client authentication failed' },
            { status: 401, statusText: 'Unauthorized' },
          );
        }),
      );

      // Act & Assert
      await expect(resolveOAuth2ClientCredentialsProvider(baseConfig, { vars: {} })).rejects.toThrow(OAuth2TokenError);
    });

    it('should throw OAuth2TokenError on 400 with error details', async () => {
      // Arrange
      server.use(
        http.post('https://auth.example.com/oauth/token', () => {
          return HttpResponse.json(
            { error: 'invalid_scope', error_description: 'The requested scope is invalid' },
            { status: 400, statusText: 'Bad Request' },
          );
        }),
      );

      // Act & Assert
      try {
        await resolveOAuth2ClientCredentialsProvider(baseConfig, { vars: {} });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OAuth2TokenError);
        const oauth2Error = error as OAuth2TokenError;
        expect(oauth2Error.status).toBe(400);
        expect(oauth2Error.error).toBe('invalid_scope');
        expect(oauth2Error.errorDescription).toBe('The requested scope is invalid');
      }
    });

    it('should throw OAuth2TokenError on 500', async () => {
      // Arrange
      server.use(
        http.post('https://auth.example.com/oauth/token', () => {
          return HttpResponse.json({ error: 'server_error' }, { status: 500, statusText: 'Internal Server Error' });
        }),
      );

      // Act & Assert
      await expect(resolveOAuth2ClientCredentialsProvider(baseConfig, { vars: {} })).rejects.toThrow(OAuth2TokenError);
    });

    it('should throw OAuth2TokenError when response has no access_token', async () => {
      // Arrange
      server.use(
        http.post('https://auth.example.com/oauth/token', () => {
          return HttpResponse.json({
            token_type: 'Bearer',
            // missing access_token
          });
        }),
      );

      // Act & Assert
      try {
        await resolveOAuth2ClientCredentialsProvider(baseConfig, { vars: {} });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OAuth2TokenError);
        const oauth2Error = error as OAuth2TokenError;
        expect(oauth2Error.error).toBe('invalid_response');
        expect(oauth2Error.errorDescription).toBe('Response did not contain access_token');
      }
    });
  });

  describe('with different injection configs', () => {
    it('should support query injection', async () => {
      // Arrange
      const config: OAuth2ClientCredentialsConfig = {
        ...baseConfig,
        inject: {
          location: 'query',
          name: 'access_token',
          // biome-ignore lint/suspicious/noTemplateCurlyInString: Config format pattern
          format: '${token}',
        },
      };

      server.use(
        http.post('https://auth.example.com/oauth/token', () => {
          return HttpResponse.json({
            access_token: 'query-token',
            token_type: 'Bearer',
          });
        }),
      );

      // Act
      const result = await resolveOAuth2ClientCredentialsProvider(config, { vars: {} });

      // Assert
      expect(result).toEqual({
        location: 'query',
        name: 'access_token',
        value: 'query-token',
      });
    });

    it('should support cookie injection', async () => {
      // Arrange
      const config: OAuth2ClientCredentialsConfig = {
        ...baseConfig,
        inject: {
          location: 'cookie',
          name: 'auth_token',
          // biome-ignore lint/suspicious/noTemplateCurlyInString: Config format pattern
          format: '${token}',
        },
      };

      server.use(
        http.post('https://auth.example.com/oauth/token', () => {
          return HttpResponse.json({
            access_token: 'cookie-token',
            token_type: 'Bearer',
          });
        }),
      );

      // Act
      const result = await resolveOAuth2ClientCredentialsProvider(config, { vars: {} });

      // Assert
      expect(result).toEqual({
        location: 'cookie',
        name: 'auth_token',
        value: 'cookie-token',
      });
    });

    it('should support custom format', async () => {
      // Arrange
      const config: OAuth2ClientCredentialsConfig = {
        ...baseConfig,
        inject: {
          location: 'header',
          name: 'X-Access-Token',
          // biome-ignore lint/suspicious/noTemplateCurlyInString: Config format pattern
          format: 'Token ${token}',
        },
      };

      server.use(
        http.post('https://auth.example.com/oauth/token', () => {
          return HttpResponse.json({
            access_token: 'custom-format-token',
            token_type: 'Bearer',
          });
        }),
      );

      // Act
      const result = await resolveOAuth2ClientCredentialsProvider(config, { vars: {} });

      // Assert
      expect(result).toEqual({
        location: 'header',
        name: 'X-Access-Token',
        value: 'Token custom-format-token',
      });
    });
  });
});

describe('OAuth2TokenError', () => {
  it('should include error and description in message when provided', () => {
    // Arrange & Act
    const error = new OAuth2TokenError(400, 'Bad Request', 'invalid_grant', 'The grant is invalid');

    // Assert
    expect(error.message).toBe('OAuth2 token request failed: invalid_grant - The grant is invalid');
    expect(error.status).toBe(400);
    expect(error.statusText).toBe('Bad Request');
    expect(error.error).toBe('invalid_grant');
    expect(error.errorDescription).toBe('The grant is invalid');
  });

  it('should use status in message when no error details', () => {
    // Arrange & Act
    const error = new OAuth2TokenError(500, 'Internal Server Error');

    // Assert
    expect(error.message).toBe('OAuth2 token request failed: 500 Internal Server Error');
    expect(error.error).toBeUndefined();
    expect(error.errorDescription).toBeUndefined();
  });

  it('should have correct name', () => {
    // Arrange & Act
    const error = new OAuth2TokenError(401, 'Unauthorized');

    // Assert
    expect(error.name).toBe('OAuth2TokenError');
  });
});
