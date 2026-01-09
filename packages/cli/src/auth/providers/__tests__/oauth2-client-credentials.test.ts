/**
 * Tests for OAuth2 Client Credentials provider
 * Following AAA pattern for unit tests
 */

import { MockAgent, setGlobalDispatcher } from 'undici';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tokenCache } from '../../cache/token-cache.js';
import type { OAuth2ClientCredentialsConfig } from '../../types.js';
import { OAuth2TokenError, resolveOAuth2ClientCredentialsProvider } from '../oauth2-client-credentials.js';

// Mock agent setup
let mockAgent: MockAgent;

beforeEach(() => {
  // Enable fresh mocks for each test
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
});

afterEach(async () => {
  // Clear token cache between tests to avoid interference
  tokenCache.clear();
  await mockAgent.close();
});

describe('resolveOAuth2ClientCredentialsProvider', () => {
  const baseConfig: OAuth2ClientCredentialsConfig = {
    type: 'oauth2_client_credentials',
    tokenUrl: 'https://auth.example.com/oauth/token',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    inject: {
      location: 'header',
      name: 'Authorization',
      format: 'Bearer ${token}',
    },
  };

  describe('when token request succeeds', () => {
    it('should resolve credential from successful token request', async () => {
      // Arrange
      const mockPool = mockAgent.get('https://auth.example.com');
      mockPool.intercept({ path: '/oauth/token', method: 'POST' }).reply(
        200,
        {
          access_token: 'oauth2-access-token-12345',
          token_type: 'Bearer',
          expires_in: 3600,
        },
        { headers: { 'content-type': 'application/json' } },
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
      let capturedContentType: string | undefined;

      const mockPool = mockAgent.get('https://auth.example.com');
      mockPool
        .intercept({
          path: '/oauth/token',
          method: 'POST',
          headers: (headers) => {
            capturedContentType = (headers as Record<string, string>)['content-type'];
            return true;
          },
          body: (body) => {
            capturedBody = body as string;
            return true;
          },
        })
        .reply(
          200,
          {
            access_token: 'token',
            token_type: 'Bearer',
          },
          { headers: { 'content-type': 'application/json' } },
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
      const mockPool = mockAgent.get('https://auth.example.com');
      mockPool
        .intercept({
          path: '/oauth/token',
          method: 'POST',
          body: (body) => {
            capturedBody = body as string;
            return true;
          },
        })
        .reply(
          200,
          {
            access_token: 'scoped-token',
            token_type: 'Bearer',
          },
          { headers: { 'content-type': 'application/json' } },
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
      const mockPool = mockAgent.get('https://auth.example.com');
      mockPool
        .intercept({
          path: '/oauth/token',
          method: 'POST',
          body: (body) => {
            capturedBody = body as string;
            return true;
          },
        })
        .reply(
          200,
          {
            access_token: 'audience-token',
            token_type: 'Bearer',
          },
          { headers: { 'content-type': 'application/json' } },
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
        clientId: '${var:client_id}',
      };

      let capturedBody: string | undefined;
      const mockPool = mockAgent.get('https://auth.example.com');
      mockPool
        .intercept({
          path: '/oauth/token',
          method: 'POST',
          body: (body) => {
            capturedBody = body as string;
            return true;
          },
        })
        .reply(
          200,
          {
            access_token: 'token',
            token_type: 'Bearer',
          },
          { headers: { 'content-type': 'application/json' } },
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
        clientSecret: '${var:client_secret}',
      };

      let capturedBody: string | undefined;
      const mockPool = mockAgent.get('https://auth.example.com');
      mockPool
        .intercept({
          path: '/oauth/token',
          method: 'POST',
          body: (body) => {
            capturedBody = body as string;
            return true;
          },
        })
        .reply(
          200,
          {
            access_token: 'token',
            token_type: 'Bearer',
          },
          { headers: { 'content-type': 'application/json' } },
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
        tokenUrl: 'https://${var:auth_host}/oauth/token',
      };

      const mockPool = mockAgent.get('https://custom-auth.example.com');
      mockPool.intercept({ path: '/oauth/token', method: 'POST' }).reply(
        200,
        {
          access_token: 'custom-token',
          token_type: 'Bearer',
        },
        { headers: { 'content-type': 'application/json' } },
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
        scope: '${var:scopes}',
      };

      let capturedBody: string | undefined;
      const mockPool = mockAgent.get('https://auth.example.com');
      mockPool
        .intercept({
          path: '/oauth/token',
          method: 'POST',
          body: (body) => {
            capturedBody = body as string;
            return true;
          },
        })
        .reply(
          200,
          {
            access_token: 'token',
            token_type: 'Bearer',
          },
          { headers: { 'content-type': 'application/json' } },
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
      const mockPool = mockAgent.get('https://auth.example.com');
      mockPool
        .intercept({ path: '/oauth/token', method: 'POST' })
        .reply(
          401,
          { error: 'invalid_client', error_description: 'Client authentication failed' },
          { headers: { 'content-type': 'application/json' } },
        );

      // Act & Assert
      await expect(resolveOAuth2ClientCredentialsProvider(baseConfig, { vars: {} })).rejects.toThrow(OAuth2TokenError);
    });

    it('should throw OAuth2TokenError on 400 with error details', async () => {
      // Arrange
      const mockPool = mockAgent.get('https://auth.example.com');
      mockPool
        .intercept({ path: '/oauth/token', method: 'POST' })
        .reply(
          400,
          { error: 'invalid_scope', error_description: 'The requested scope is invalid' },
          { headers: { 'content-type': 'application/json' } },
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
      const mockPool = mockAgent.get('https://auth.example.com');
      mockPool
        .intercept({ path: '/oauth/token', method: 'POST' })
        .reply(500, { error: 'server_error' }, { headers: { 'content-type': 'application/json' } });

      // Act & Assert
      await expect(resolveOAuth2ClientCredentialsProvider(baseConfig, { vars: {} })).rejects.toThrow(OAuth2TokenError);
    });

    it('should throw OAuth2TokenError when response has no access_token', async () => {
      // Arrange
      const mockPool = mockAgent.get('https://auth.example.com');
      mockPool.intercept({ path: '/oauth/token', method: 'POST' }).reply(
        200,
        {
          token_type: 'Bearer',
          // missing access_token
        },
        { headers: { 'content-type': 'application/json' } },
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
          format: '${token}',
        },
      };

      const mockPool = mockAgent.get('https://auth.example.com');
      mockPool.intercept({ path: '/oauth/token', method: 'POST' }).reply(
        200,
        {
          access_token: 'query-token',
          token_type: 'Bearer',
        },
        { headers: { 'content-type': 'application/json' } },
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
          format: '${token}',
        },
      };

      const mockPool = mockAgent.get('https://auth.example.com');
      mockPool.intercept({ path: '/oauth/token', method: 'POST' }).reply(
        200,
        {
          access_token: 'cookie-token',
          token_type: 'Bearer',
        },
        { headers: { 'content-type': 'application/json' } },
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
          format: 'Token ${token}',
        },
      };

      const mockPool = mockAgent.get('https://auth.example.com');
      mockPool.intercept({ path: '/oauth/token', method: 'POST' }).reply(
        200,
        {
          access_token: 'custom-format-token',
          token_type: 'Bearer',
        },
        { headers: { 'content-type': 'application/json' } },
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

describe('Token Caching', () => {
  const baseConfig: OAuth2ClientCredentialsConfig = {
    type: 'oauth2_client_credentials',
    tokenUrl: 'https://auth.example.com/oauth/token',
    clientId: 'cache-test-client',
    clientSecret: 'cache-test-secret',
    inject: {
      location: 'header',
      name: 'Authorization',
      format: 'Bearer ${token}',
    },
  };

  it('should cache token and not make second request', async () => {
    // Arrange
    let requestCount = 0;
    const mockPool = mockAgent.get('https://auth.example.com');
    mockPool
      .intercept({ path: '/oauth/token', method: 'POST' })
      .reply(() => {
        requestCount++;
        return {
          statusCode: 200,
          data: {
            access_token: 'cached-token-123',
            token_type: 'Bearer',
            expires_in: 3600,
          },
          responseOptions: { headers: { 'content-type': 'application/json' } },
        };
      })
      .persist();

    // Act - first call should hit the server
    const result1 = await resolveOAuth2ClientCredentialsProvider(baseConfig, { vars: {} });

    // Second call should use cache
    const result2 = await resolveOAuth2ClientCredentialsProvider(baseConfig, { vars: {} });

    // Assert
    expect(requestCount).toBe(1); // Only one request made
    expect(result1.value).toBe('Bearer cached-token-123');
    expect(result2.value).toBe('Bearer cached-token-123');
  });

  it('should make fresh request with skipCache option', async () => {
    // Arrange
    let requestCount = 0;
    const mockPool = mockAgent.get('https://auth.example.com');
    mockPool
      .intercept({ path: '/oauth/token', method: 'POST' })
      .reply(() => {
        requestCount++;
        return {
          statusCode: 200,
          data: {
            access_token: `token-request-${requestCount}`,
            token_type: 'Bearer',
            expires_in: 3600,
          },
          responseOptions: { headers: { 'content-type': 'application/json' } },
        };
      })
      .persist();

    // Act - first call
    const result1 = await resolveOAuth2ClientCredentialsProvider(baseConfig, { vars: {} });

    // Second call with skipCache
    const result2 = await resolveOAuth2ClientCredentialsProvider(baseConfig, { vars: {} }, { skipCache: true });

    // Assert
    expect(requestCount).toBe(2); // Two requests made
    expect(result1.value).toBe('Bearer token-request-1');
    expect(result2.value).toBe('Bearer token-request-2');
  });

  it('should use different cache keys for different scopes', async () => {
    // Arrange
    let requestCount = 0;
    const mockPool = mockAgent.get('https://auth.example.com');
    mockPool
      .intercept({ path: '/oauth/token', method: 'POST' })
      .reply(() => {
        requestCount++;
        return {
          statusCode: 200,
          data: {
            access_token: `scoped-token-${requestCount}`,
            token_type: 'Bearer',
            expires_in: 3600,
          },
          responseOptions: { headers: { 'content-type': 'application/json' } },
        };
      })
      .persist();

    const configWithScope1 = { ...baseConfig, scope: 'read' };
    const configWithScope2 = { ...baseConfig, scope: 'write' };

    // Act - different scopes should create separate cache entries
    const result1 = await resolveOAuth2ClientCredentialsProvider(configWithScope1, { vars: {} });
    const result2 = await resolveOAuth2ClientCredentialsProvider(configWithScope2, { vars: {} });

    // Same scope should use cache
    const result3 = await resolveOAuth2ClientCredentialsProvider(configWithScope1, { vars: {} });

    // Assert
    expect(requestCount).toBe(2); // Only two requests (one per scope)
    expect(result1.value).toBe('Bearer scoped-token-1');
    expect(result2.value).toBe('Bearer scoped-token-2');
    expect(result3.value).toBe('Bearer scoped-token-1'); // Cached from first request
  });
});
