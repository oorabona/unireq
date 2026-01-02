/**
 * Tests for Bearer token provider resolver
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VariableNotFoundError } from '../../../workspace/variables/errors.js';
import type { BearerProviderConfig } from '../../types.js';
import { resolveBearerProvider } from '../bearer.js';

describe('resolveBearerProvider', () => {
  describe('direct token resolution', () => {
    it('should resolve config with direct token value', () => {
      // Arrange
      const config: BearerProviderConfig = {
        type: 'bearer',
        token: 'my-jwt-token-123',
      };

      // Act
      const result = resolveBearerProvider(config);

      // Assert
      expect(result).toEqual({
        location: 'header',
        name: 'Authorization',
        value: 'Bearer my-jwt-token-123',
      });
    });

    it('should always use header location', () => {
      // Arrange
      const config: BearerProviderConfig = {
        type: 'bearer',
        token: 'token',
      };

      // Act
      const result = resolveBearerProvider(config);

      // Assert
      expect(result.location).toBe('header');
    });

    it('should always use Authorization header name', () => {
      // Arrange
      const config: BearerProviderConfig = {
        type: 'bearer',
        token: 'token',
      };

      // Act
      const result = resolveBearerProvider(config);

      // Assert
      expect(result.name).toBe('Authorization');
    });
  });

  describe('default prefix', () => {
    it('should use "Bearer" as default prefix', () => {
      // Arrange
      const config: BearerProviderConfig = {
        type: 'bearer',
        token: 'abc123',
      };

      // Act
      const result = resolveBearerProvider(config);

      // Assert
      expect(result.value).toBe('Bearer abc123');
    });
  });

  describe('custom prefix', () => {
    it('should use custom prefix when provided', () => {
      // Arrange
      const config: BearerProviderConfig = {
        type: 'bearer',
        token: 'my-token',
        prefix: 'Token',
      };

      // Act
      const result = resolveBearerProvider(config);

      // Assert
      expect(result.value).toBe('Token my-token');
    });

    it('should handle empty prefix', () => {
      // Arrange
      const config: BearerProviderConfig = {
        type: 'bearer',
        token: 'my-token',
        prefix: '',
      };

      // Act
      const result = resolveBearerProvider(config);

      // Assert
      expect(result.value).toBe(' my-token');
    });

    it('should handle JWT prefix', () => {
      // Arrange
      const config: BearerProviderConfig = {
        type: 'bearer',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        prefix: 'JWT',
      };

      // Act
      const result = resolveBearerProvider(config);

      // Assert
      expect(result.value).toBe('JWT eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });
  });

  describe('variable interpolation', () => {
    it('should interpolate ${var:...} in token', () => {
      // Arrange
      const config: BearerProviderConfig = {
        type: 'bearer',
        token: '${var:authToken}',
      };
      const context = { vars: { authToken: 'resolved-jwt-token' } };

      // Act
      const result = resolveBearerProvider(config, context);

      // Assert
      expect(result.value).toBe('Bearer resolved-jwt-token');
    });
  });

  describe('environment variable interpolation', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should interpolate ${env:...} in token', () => {
      // Arrange
      process.env['AUTH_TOKEN'] = 'env-token-value';
      const config: BearerProviderConfig = {
        type: 'bearer',
        token: '${env:AUTH_TOKEN}',
      };

      // Act
      const result = resolveBearerProvider(config, { vars: {} });

      // Assert
      expect(result.value).toBe('Bearer env-token-value');
    });

    it('should throw VariableNotFoundError for missing env var', () => {
      // Arrange
      delete process.env['MISSING_TOKEN'];
      const config: BearerProviderConfig = {
        type: 'bearer',
        token: '${env:MISSING_TOKEN}',
      };

      // Act & Assert
      expect(() => resolveBearerProvider(config, { vars: {} })).toThrow(VariableNotFoundError);
    });
  });

  describe('secret placeholder', () => {
    it('should return placeholder when no secretResolver provided', () => {
      // Arrange
      const config: BearerProviderConfig = {
        type: 'bearer',
        token: '${secret:jwtToken}',
      };

      // Act
      const result = resolveBearerProvider(config, { vars: {} });

      // Assert
      expect(result.value).toBe('Bearer <secret:jwtToken>');
    });

    it('should use secretResolver when provided', () => {
      // Arrange
      const config: BearerProviderConfig = {
        type: 'bearer',
        token: '${secret:jwtToken}',
      };
      const context = {
        vars: {},
        secretResolver: (name: string): string => {
          if (name === 'jwtToken') return 'super-secret-jwt';
          throw new Error(`Unknown secret: ${name}`);
        },
      };

      // Act
      const result = resolveBearerProvider(config, context);

      // Assert
      expect(result.value).toBe('Bearer super-secret-jwt');
    });
  });

  describe('missing variable error', () => {
    it('should throw VariableNotFoundError for missing var', () => {
      // Arrange
      const config: BearerProviderConfig = {
        type: 'bearer',
        token: '${var:missing}',
      };

      // Act & Assert
      expect(() => resolveBearerProvider(config, { vars: {} })).toThrow(VariableNotFoundError);
    });
  });

  describe('default context', () => {
    it('should work without explicit context', () => {
      // Arrange
      const config: BearerProviderConfig = {
        type: 'bearer',
        token: 'direct-token',
      };

      // Act - no context parameter
      const result = resolveBearerProvider(config);

      // Assert
      expect(result.value).toBe('Bearer direct-token');
    });
  });
});
