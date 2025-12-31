/**
 * Tests for auth provider schemas
 * Following AAA pattern for unit tests
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  AUTH_PROVIDER_TYPES,
  apiKeyProviderSchema,
  authConfigSchema,
  authProviderConfigSchema,
  bearerProviderSchema,
  loginJwtProviderSchema,
  oauth2ClientCredentialsSchema,
} from '../schema.js';

describe('apiKeyProviderSchema', () => {
  describe('when config is valid', () => {
    it('should validate api_key with header location', () => {
      // Arrange
      const config = {
        type: 'api_key',
        location: 'header',
        name: 'X-API-Key',
        value: 'my-secret-key',
      };

      // Act
      const result = v.safeParse(apiKeyProviderSchema, config);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.type).toBe('api_key');
        expect(result.output.location).toBe('header');
        expect(result.output.name).toBe('X-API-Key');
      }
    });

    it('should validate api_key with query location', () => {
      // Arrange
      const config = {
        type: 'api_key',
        location: 'query',
        name: 'api_key',
        value: '${secret:apiKey}',
      };

      // Act
      const result = v.safeParse(apiKeyProviderSchema, config);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.location).toBe('query');
      }
    });
  });

  describe('when config is invalid', () => {
    it('should reject missing location', () => {
      // Arrange
      const config = {
        type: 'api_key',
        name: 'X-API-Key',
        value: 'key',
      };

      // Act
      const result = v.safeParse(apiKeyProviderSchema, config);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should reject missing name', () => {
      // Arrange
      const config = {
        type: 'api_key',
        location: 'header',
        value: 'key',
      };

      // Act
      const result = v.safeParse(apiKeyProviderSchema, config);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should reject invalid location', () => {
      // Arrange
      const config = {
        type: 'api_key',
        location: 'cookie',
        name: 'X-API-Key',
        value: 'key',
      };

      // Act
      const result = v.safeParse(apiKeyProviderSchema, config);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      // Arrange
      const config = {
        type: 'api_key',
        location: 'header',
        name: '',
        value: 'key',
      };

      // Act
      const result = v.safeParse(apiKeyProviderSchema, config);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});

describe('bearerProviderSchema', () => {
  describe('when config is valid', () => {
    it('should validate bearer with token only', () => {
      // Arrange
      const config = {
        type: 'bearer',
        token: 'my-token',
      };

      // Act
      const result = v.safeParse(bearerProviderSchema, config);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.type).toBe('bearer');
        expect(result.output.token).toBe('my-token');
        expect(result.output.prefix).toBe('Bearer');
      }
    });

    it('should validate bearer with custom prefix', () => {
      // Arrange
      const config = {
        type: 'bearer',
        token: '${secret:token}',
        prefix: 'Token',
      };

      // Act
      const result = v.safeParse(bearerProviderSchema, config);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.prefix).toBe('Token');
      }
    });
  });

  describe('when config is invalid', () => {
    it('should reject missing token', () => {
      // Arrange
      const config = {
        type: 'bearer',
      };

      // Act
      const result = v.safeParse(bearerProviderSchema, config);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});

describe('loginJwtProviderSchema', () => {
  describe('when config is valid', () => {
    it('should validate complete login_jwt config', () => {
      // Arrange
      const config = {
        type: 'login_jwt',
        login: {
          method: 'POST',
          url: '/auth/login',
          body: {
            username: '${prompt:username}',
            password: '${secret:password}',
          },
        },
        extract: {
          token: '$.token',
        },
        inject: {
          location: 'header',
          name: 'Authorization',
          format: 'Bearer ${token}',
        },
      };

      // Act
      const result = v.safeParse(loginJwtProviderSchema, config);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.type).toBe('login_jwt');
        expect(result.output.login.method).toBe('POST');
        expect(result.output.extract.token).toBe('$.token');
      }
    });

    it('should validate with optional refreshToken', () => {
      // Arrange
      const config = {
        type: 'login_jwt',
        login: {
          method: 'POST',
          url: '/auth/login',
          body: { username: 'user', password: 'pass' },
        },
        extract: {
          token: '$.accessToken',
          refreshToken: '$.refreshToken',
        },
        inject: {},
      };

      // Act
      const result = v.safeParse(loginJwtProviderSchema, config);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.extract.refreshToken).toBe('$.refreshToken');
      }
    });

    it('should apply default inject values', () => {
      // Arrange
      const config = {
        type: 'login_jwt',
        login: {
          method: 'POST',
          url: '/login',
          body: {},
        },
        extract: {
          token: '$.token',
        },
        inject: {},
      };

      // Act
      const result = v.safeParse(loginJwtProviderSchema, config);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.inject.location).toBe('header');
        expect(result.output.inject.name).toBe('Authorization');
        expect(result.output.inject.format).toBe('Bearer ${token}');
      }
    });
  });

  describe('when config is invalid', () => {
    it('should reject missing login', () => {
      // Arrange
      const config = {
        type: 'login_jwt',
        extract: { token: '$.token' },
        inject: {},
      };

      // Act
      const result = v.safeParse(loginJwtProviderSchema, config);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should reject missing extract', () => {
      // Arrange
      const config = {
        type: 'login_jwt',
        login: { method: 'POST', url: '/login', body: {} },
        inject: {},
      };

      // Act
      const result = v.safeParse(loginJwtProviderSchema, config);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should reject empty token path', () => {
      // Arrange
      const config = {
        type: 'login_jwt',
        login: { method: 'POST', url: '/login', body: {} },
        extract: { token: '' },
        inject: {},
      };

      // Act
      const result = v.safeParse(loginJwtProviderSchema, config);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});

describe('oauth2ClientCredentialsSchema', () => {
  describe('when config is valid', () => {
    it('should validate complete oauth2_client_credentials config', () => {
      // Arrange
      const config = {
        type: 'oauth2_client_credentials',
        tokenUrl: 'https://auth.example.com/oauth/token',
        clientId: 'my-client-id',
        clientSecret: '${secret:clientSecret}',
        scope: 'api.read api.write',
        inject: {
          location: 'header',
          format: 'Bearer ${token}',
        },
      };

      // Act
      const result = v.safeParse(oauth2ClientCredentialsSchema, config);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.type).toBe('oauth2_client_credentials');
        expect(result.output.tokenUrl).toBe('https://auth.example.com/oauth/token');
        expect(result.output.scope).toBe('api.read api.write');
      }
    });

    it('should validate with optional audience', () => {
      // Arrange
      const config = {
        type: 'oauth2_client_credentials',
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'client',
        clientSecret: 'secret',
        audience: 'https://api.example.com',
        inject: {},
      };

      // Act
      const result = v.safeParse(oauth2ClientCredentialsSchema, config);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.audience).toBe('https://api.example.com');
      }
    });

    it('should validate without optional fields', () => {
      // Arrange
      const config = {
        type: 'oauth2_client_credentials',
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'client',
        clientSecret: 'secret',
        inject: {},
      };

      // Act
      const result = v.safeParse(oauth2ClientCredentialsSchema, config);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.scope).toBeUndefined();
        expect(result.output.audience).toBeUndefined();
      }
    });
  });

  describe('when config is invalid', () => {
    it('should reject invalid tokenUrl', () => {
      // Arrange
      const config = {
        type: 'oauth2_client_credentials',
        tokenUrl: 'not-a-url',
        clientId: 'client',
        clientSecret: 'secret',
        inject: {},
      };

      // Act
      const result = v.safeParse(oauth2ClientCredentialsSchema, config);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should reject missing clientId', () => {
      // Arrange
      const config = {
        type: 'oauth2_client_credentials',
        tokenUrl: 'https://auth.example.com/token',
        clientSecret: 'secret',
        inject: {},
      };

      // Act
      const result = v.safeParse(oauth2ClientCredentialsSchema, config);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should reject missing clientSecret', () => {
      // Arrange
      const config = {
        type: 'oauth2_client_credentials',
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'client',
        inject: {},
      };

      // Act
      const result = v.safeParse(oauth2ClientCredentialsSchema, config);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});

describe('authProviderConfigSchema (discriminated union)', () => {
  describe('when discriminating by type', () => {
    it('should parse api_key provider', () => {
      // Arrange
      const config = {
        type: 'api_key',
        location: 'header',
        name: 'X-API-Key',
        value: 'key',
      };

      // Act
      const result = v.safeParse(authProviderConfigSchema, config);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.type).toBe('api_key');
      }
    });

    it('should parse bearer provider', () => {
      // Arrange
      const config = {
        type: 'bearer',
        token: 'token',
      };

      // Act
      const result = v.safeParse(authProviderConfigSchema, config);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.type).toBe('bearer');
      }
    });

    it('should parse login_jwt provider', () => {
      // Arrange
      const config = {
        type: 'login_jwt',
        login: { method: 'POST', url: '/login', body: {} },
        extract: { token: '$.token' },
        inject: {},
      };

      // Act
      const result = v.safeParse(authProviderConfigSchema, config);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.type).toBe('login_jwt');
      }
    });

    it('should parse oauth2_client_credentials provider', () => {
      // Arrange
      const config = {
        type: 'oauth2_client_credentials',
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'client',
        clientSecret: 'secret',
        inject: {},
      };

      // Act
      const result = v.safeParse(authProviderConfigSchema, config);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.type).toBe('oauth2_client_credentials');
      }
    });

    it('should reject unknown provider type', () => {
      // Arrange
      const config = {
        type: 'magic_auth',
        value: 'something',
      };

      // Act
      const result = v.safeParse(authProviderConfigSchema, config);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});

describe('authConfigSchema', () => {
  describe('when config is valid', () => {
    it('should validate empty providers', () => {
      // Arrange
      const config = {
        providers: {},
      };

      // Act
      const result = v.safeParse(authConfigSchema, config);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.providers).toEqual({});
      }
    });

    it('should validate with active provider', () => {
      // Arrange
      const config = {
        active: 'main',
        providers: {
          main: {
            type: 'bearer',
            token: 'token',
          },
        },
      };

      // Act
      const result = v.safeParse(authConfigSchema, config);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.active).toBe('main');
      }
    });

    it('should validate multiple providers', () => {
      // Arrange
      const config = {
        active: 'dev',
        providers: {
          dev: {
            type: 'bearer',
            token: 'dev-token',
          },
          prod: {
            type: 'api_key',
            location: 'header',
            name: 'X-API-Key',
            value: 'prod-key',
          },
        },
      };

      // Act
      const result = v.safeParse(authConfigSchema, config);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(Object.keys(result.output.providers)).toHaveLength(2);
      }
    });

    it('should default providers to empty object', () => {
      // Arrange
      const config = {};

      // Act
      const result = v.safeParse(authConfigSchema, config);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.providers).toEqual({});
      }
    });
  });

  describe('when config is invalid', () => {
    it('should reject invalid provider in providers map', () => {
      // Arrange
      const config = {
        providers: {
          bad: {
            type: 'api_key',
            // missing required fields
          },
        },
      };

      // Act
      const result = v.safeParse(authConfigSchema, config);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});

describe('AUTH_PROVIDER_TYPES', () => {
  it('should contain all V1 provider types', () => {
    // Assert
    expect(AUTH_PROVIDER_TYPES).toContain('api_key');
    expect(AUTH_PROVIDER_TYPES).toContain('bearer');
    expect(AUTH_PROVIDER_TYPES).toContain('login_jwt');
    expect(AUTH_PROVIDER_TYPES).toContain('oauth2_client_credentials');
    expect(AUTH_PROVIDER_TYPES).toHaveLength(4);
  });
});
