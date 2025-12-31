/**
 * Tests for API key provider resolver
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { VariableNotFoundError } from '../../../workspace/variables/errors.js';
import type { ApiKeyProviderConfig } from '../../types.js';
import { resolveApiKeyProvider } from '../api-key.js';

describe('resolveApiKeyProvider', () => {
  describe('direct value resolution', () => {
    it('should resolve config with direct value', () => {
      // Arrange
      const config: ApiKeyProviderConfig = {
        type: 'api_key',
        location: 'header',
        name: 'X-API-Key',
        value: 'my-api-key-123',
      };

      // Act
      const result = resolveApiKeyProvider(config);

      // Assert
      expect(result).toEqual({
        location: 'header',
        name: 'X-API-Key',
        value: 'my-api-key-123',
      });
    });

    it('should handle empty value', () => {
      // Arrange
      const config: ApiKeyProviderConfig = {
        type: 'api_key',
        location: 'header',
        name: 'X-API-Key',
        value: '',
      };

      // Act
      const result = resolveApiKeyProvider(config);

      // Assert
      expect(result.value).toBe('');
    });
  });

  describe('header location', () => {
    it('should preserve header location and name', () => {
      // Arrange
      const config: ApiKeyProviderConfig = {
        type: 'api_key',
        location: 'header',
        name: 'Authorization',
        value: 'key-value',
      };

      // Act
      const result = resolveApiKeyProvider(config);

      // Assert
      expect(result.location).toBe('header');
      expect(result.name).toBe('Authorization');
    });
  });

  describe('query location', () => {
    it('should preserve query location and name', () => {
      // Arrange
      const config: ApiKeyProviderConfig = {
        type: 'api_key',
        location: 'query',
        name: 'api_key',
        value: 'query-key-value',
      };

      // Act
      const result = resolveApiKeyProvider(config);

      // Assert
      expect(result.location).toBe('query');
      expect(result.name).toBe('api_key');
      expect(result.value).toBe('query-key-value');
    });
  });

  describe('variable interpolation', () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Test description for variable syntax
    it('should interpolate ${var:...} from context', () => {
      // Arrange
      const config: ApiKeyProviderConfig = {
        type: 'api_key',
        location: 'header',
        name: 'X-API-Key',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: Variable interpolation syntax
        value: '${var:apiKey}',
      };
      const context = { vars: { apiKey: 'resolved-key-123' } };

      // Act
      const result = resolveApiKeyProvider(config, context);

      // Assert
      expect(result.value).toBe('resolved-key-123');
    });

    it('should interpolate multiple variables', () => {
      // Arrange
      const config: ApiKeyProviderConfig = {
        type: 'api_key',
        location: 'header',
        name: 'X-API-Key',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: Variable interpolation syntax
        value: '${var:prefix}-${var:key}',
      };
      const context = { vars: { prefix: 'test', key: 'abc123' } };

      // Act
      const result = resolveApiKeyProvider(config, context);

      // Assert
      expect(result.value).toBe('test-abc123');
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

    // biome-ignore lint/suspicious/noTemplateCurlyInString: Test description for variable syntax
    it('should interpolate ${env:...} from process.env', () => {
      // Arrange
      process.env['TEST_API_KEY'] = 'env-api-key-456';
      const config: ApiKeyProviderConfig = {
        type: 'api_key',
        location: 'header',
        name: 'X-API-Key',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: Variable interpolation syntax
        value: '${env:TEST_API_KEY}',
      };

      // Act
      const result = resolveApiKeyProvider(config, { vars: {} });

      // Assert
      expect(result.value).toBe('env-api-key-456');
    });

    it('should throw VariableNotFoundError for missing env var', () => {
      // Arrange
      delete process.env['MISSING_API_KEY'];
      const config: ApiKeyProviderConfig = {
        type: 'api_key',
        location: 'header',
        name: 'X-API-Key',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: Variable interpolation syntax
        value: '${env:MISSING_API_KEY}',
      };

      // Act & Assert
      expect(() => resolveApiKeyProvider(config, { vars: {} })).toThrow(VariableNotFoundError);
    });
  });

  describe('secret placeholder', () => {
    it('should return placeholder when no secretResolver provided', () => {
      // Arrange
      const config: ApiKeyProviderConfig = {
        type: 'api_key',
        location: 'header',
        name: 'X-API-Key',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: Variable interpolation syntax
        value: '${secret:apiKey}',
      };

      // Act
      const result = resolveApiKeyProvider(config, { vars: {} });

      // Assert
      expect(result.value).toBe('<secret:apiKey>');
    });

    it('should use secretResolver when provided', () => {
      // Arrange
      const config: ApiKeyProviderConfig = {
        type: 'api_key',
        location: 'header',
        name: 'X-API-Key',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: Variable interpolation syntax
        value: '${secret:apiKey}',
      };
      const context = {
        vars: {},
        secretResolver: (name: string): string => {
          if (name === 'apiKey') return 'secret-value-789';
          throw new Error(`Unknown secret: ${name}`);
        },
      };

      // Act
      const result = resolveApiKeyProvider(config, context);

      // Assert
      expect(result.value).toBe('secret-value-789');
    });
  });

  describe('prompt placeholder', () => {
    it('should return placeholder when no promptResolver provided', () => {
      // Arrange
      const config: ApiKeyProviderConfig = {
        type: 'api_key',
        location: 'header',
        name: 'X-API-Key',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: Variable interpolation syntax
        value: '${prompt:apiKey}',
      };

      // Act
      const result = resolveApiKeyProvider(config, { vars: {} });

      // Assert
      expect(result.value).toBe('<prompt:apiKey>');
    });
  });

  describe('missing variable error', () => {
    it('should throw VariableNotFoundError for missing var', () => {
      // Arrange
      const config: ApiKeyProviderConfig = {
        type: 'api_key',
        location: 'header',
        name: 'X-API-Key',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: Variable interpolation syntax
        value: '${var:missing}',
      };

      // Act & Assert
      expect(() => resolveApiKeyProvider(config, { vars: {} })).toThrow(VariableNotFoundError);
      expect(() => resolveApiKeyProvider(config, { vars: {} })).toThrow(/missing/);
    });
  });

  describe('default context', () => {
    it('should work without explicit context', () => {
      // Arrange
      const config: ApiKeyProviderConfig = {
        type: 'api_key',
        location: 'header',
        name: 'X-API-Key',
        value: 'direct-value',
      };

      // Act - no context parameter
      const result = resolveApiKeyProvider(config);

      // Assert
      expect(result.value).toBe('direct-value');
    });
  });
});
