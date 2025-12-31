/**
 * Tests for auth provider registry
 * Following AAA pattern for unit tests
 */

import { describe, expect, it } from 'vitest';
import { getActiveProvider, getActiveProviderName, getProvider, listProviders, providerExists } from '../registry.js';
import type { AuthConfig, AuthProviderConfig } from '../types.js';

/**
 * Helper to create a test auth config
 */
function createAuthConfig(overrides: Partial<AuthConfig> = {}): AuthConfig {
  return {
    providers: {},
    ...overrides,
  };
}

/**
 * Helper to create a bearer provider
 */
function createBearerProvider(token: string): AuthProviderConfig {
  return {
    type: 'bearer',
    token,
  };
}

/**
 * Helper to create an API key provider
 */
function createApiKeyProvider(name: string, value: string): AuthProviderConfig {
  return {
    type: 'api_key',
    location: 'header',
    name,
    value,
  };
}

describe('listProviders', () => {
  describe('when providers exist', () => {
    it('should return all provider names', () => {
      // Arrange
      const config = createAuthConfig({
        providers: {
          dev: createBearerProvider('dev-token'),
          staging: createBearerProvider('staging-token'),
          prod: createBearerProvider('prod-token'),
        },
      });

      // Act
      const result = listProviders(config);

      // Assert
      expect(result).toHaveLength(3);
      expect(result).toContain('dev');
      expect(result).toContain('staging');
      expect(result).toContain('prod');
    });

    it('should return single provider', () => {
      // Arrange
      const config = createAuthConfig({
        providers: {
          main: createBearerProvider('token'),
        },
      });

      // Act
      const result = listProviders(config);

      // Assert
      expect(result).toEqual(['main']);
    });
  });

  describe('when no providers', () => {
    it('should return empty array', () => {
      // Arrange
      const config = createAuthConfig({ providers: {} });

      // Act
      const result = listProviders(config);

      // Assert
      expect(result).toEqual([]);
    });
  });
});

describe('getProvider', () => {
  describe('when provider exists', () => {
    it('should return the provider config', () => {
      // Arrange
      const devProvider = createBearerProvider('dev-token');
      const config = createAuthConfig({
        providers: {
          dev: devProvider,
          prod: createBearerProvider('prod-token'),
        },
      });

      // Act
      const result = getProvider(config, 'dev');

      // Assert
      expect(result).toBe(devProvider);
      expect(result?.type).toBe('bearer');
    });

    it('should return correct provider type', () => {
      // Arrange
      const config = createAuthConfig({
        providers: {
          apiKey: createApiKeyProvider('X-API-Key', 'secret'),
          bearer: createBearerProvider('token'),
        },
      });

      // Act
      const apiKeyResult = getProvider(config, 'apiKey');
      const bearerResult = getProvider(config, 'bearer');

      // Assert
      expect(apiKeyResult?.type).toBe('api_key');
      expect(bearerResult?.type).toBe('bearer');
    });
  });

  describe('when provider does not exist', () => {
    it('should return undefined', () => {
      // Arrange
      const config = createAuthConfig({
        providers: {
          dev: createBearerProvider('token'),
        },
      });

      // Act
      const result = getProvider(config, 'unknown');

      // Assert
      expect(result).toBeUndefined();
    });

    it('should return undefined for empty providers', () => {
      // Arrange
      const config = createAuthConfig({ providers: {} });

      // Act
      const result = getProvider(config, 'any');

      // Assert
      expect(result).toBeUndefined();
    });
  });
});

describe('providerExists', () => {
  it('should return true when provider exists', () => {
    // Arrange
    const config = createAuthConfig({
      providers: {
        main: createBearerProvider('token'),
      },
    });

    // Act & Assert
    expect(providerExists(config, 'main')).toBe(true);
  });

  it('should return false when provider does not exist', () => {
    // Arrange
    const config = createAuthConfig({
      providers: {
        main: createBearerProvider('token'),
      },
    });

    // Act & Assert
    expect(providerExists(config, 'other')).toBe(false);
  });

  it('should return false for empty providers', () => {
    // Arrange
    const config = createAuthConfig({ providers: {} });

    // Act & Assert
    expect(providerExists(config, 'any')).toBe(false);
  });
});

describe('getActiveProviderName', () => {
  describe('when active is explicitly set', () => {
    it('should return the active provider name', () => {
      // Arrange
      const config = createAuthConfig({
        active: 'staging',
        providers: {
          dev: createBearerProvider('dev-token'),
          staging: createBearerProvider('staging-token'),
          prod: createBearerProvider('prod-token'),
        },
      });

      // Act
      const result = getActiveProviderName(config);

      // Assert
      expect(result).toBe('staging');
    });

    it('should ignore active if provider does not exist', () => {
      // Arrange
      const config = createAuthConfig({
        active: 'nonexistent',
        providers: {
          dev: createBearerProvider('dev-token'),
          prod: createBearerProvider('prod-token'),
        },
      });

      // Act
      const result = getActiveProviderName(config);

      // Assert
      expect(result).toBe('dev'); // Falls back to first
    });
  });

  describe('when active is not set', () => {
    it('should return first provider', () => {
      // Arrange
      const config = createAuthConfig({
        providers: {
          first: createBearerProvider('first-token'),
          second: createBearerProvider('second-token'),
        },
      });

      // Act
      const result = getActiveProviderName(config);

      // Assert
      expect(result).toBe('first');
    });
  });

  describe('when no providers', () => {
    it('should return undefined', () => {
      // Arrange
      const config = createAuthConfig({ providers: {} });

      // Act
      const result = getActiveProviderName(config);

      // Assert
      expect(result).toBeUndefined();
    });

    it('should return undefined even with active set', () => {
      // Arrange
      const config = createAuthConfig({
        active: 'ghost',
        providers: {},
      });

      // Act
      const result = getActiveProviderName(config);

      // Assert
      expect(result).toBeUndefined();
    });
  });
});

describe('getActiveProvider', () => {
  describe('when active provider exists', () => {
    it('should return the active provider config', () => {
      // Arrange
      const stagingProvider = createBearerProvider('staging-token');
      const config = createAuthConfig({
        active: 'staging',
        providers: {
          dev: createBearerProvider('dev-token'),
          staging: stagingProvider,
        },
      });

      // Act
      const result = getActiveProvider(config);

      // Assert
      expect(result).toBe(stagingProvider);
    });

    it('should return first provider when no active set', () => {
      // Arrange
      const firstProvider = createApiKeyProvider('X-API-Key', 'secret');
      const config = createAuthConfig({
        providers: {
          first: firstProvider,
          second: createBearerProvider('token'),
        },
      });

      // Act
      const result = getActiveProvider(config);

      // Assert
      expect(result).toBe(firstProvider);
    });
  });

  describe('when no providers', () => {
    it('should return undefined', () => {
      // Arrange
      const config = createAuthConfig({ providers: {} });

      // Act
      const result = getActiveProvider(config);

      // Assert
      expect(result).toBeUndefined();
    });
  });
});
