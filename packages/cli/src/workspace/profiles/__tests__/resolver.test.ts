/**
 * Tests for profile resolution logic
 * Following AAA pattern for unit tests
 */

import { describe, expect, it } from 'vitest';
import { CONFIG_DEFAULTS } from '../../config/schema.js';
import type { WorkspaceConfig } from '../../config/types.js';
import {
  createDefaultProfile,
  getActiveProfileName,
  listProfiles,
  profileExists,
  resolveProfile,
} from '../resolver.js';

/**
 * Helper to create a minimal WorkspaceConfig for testing
 */
function createConfig(overrides: Partial<WorkspaceConfig> = {}): WorkspaceConfig {
  return {
    version: 1,
    openapi: { cache: { enabled: true, ttlMs: 86400000 } },
    profiles: {},
    auth: { providers: {} },
    vars: {},
    ...overrides,
  };
}

describe('getActiveProfileName', () => {
  describe('when no profiles exist', () => {
    it('should return undefined', () => {
      // Arrange
      const config = createConfig({ profiles: {} });

      // Act
      const result = getActiveProfileName(config);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('when activeProfile is set', () => {
    it('should return activeProfile if it exists', () => {
      // Arrange
      const config = createConfig({
        activeProfile: 'staging',
        profiles: { dev: {}, staging: {}, prod: {} },
      });

      // Act
      const result = getActiveProfileName(config);

      // Assert
      expect(result).toBe('staging');
    });

    it('should fallback if activeProfile does not exist', () => {
      // Arrange
      const config = createConfig({
        activeProfile: 'nonexistent',
        profiles: { dev: {}, prod: {} },
      });

      // Act
      const result = getActiveProfileName(config);

      // Assert
      expect(result).toBe('dev'); // First profile
    });
  });

  describe('when activeProfile is not set', () => {
    it('should return "default" if it exists', () => {
      // Arrange
      const config = createConfig({
        profiles: { dev: {}, default: {}, prod: {} },
      });

      // Act
      const result = getActiveProfileName(config);

      // Assert
      expect(result).toBe('default');
    });

    it('should return first profile if "default" does not exist', () => {
      // Arrange
      const config = createConfig({
        profiles: { dev: {}, staging: {}, prod: {} },
      });

      // Act
      const result = getActiveProfileName(config);

      // Assert
      expect(result).toBe('dev');
    });
  });
});

describe('listProfiles', () => {
  it('should return empty array when no profiles', () => {
    // Arrange
    const config = createConfig({ profiles: {} });

    // Act
    const result = listProfiles(config);

    // Assert
    expect(result).toEqual([]);
  });

  it('should return all profile names', () => {
    // Arrange
    const config = createConfig({
      profiles: { dev: {}, staging: {}, prod: {} },
    });

    // Act
    const result = listProfiles(config);

    // Assert
    expect(result).toContain('dev');
    expect(result).toContain('staging');
    expect(result).toContain('prod');
    expect(result).toHaveLength(3);
  });
});

describe('profileExists', () => {
  it('should return true for existing profile', () => {
    // Arrange
    const config = createConfig({
      profiles: { dev: {}, prod: {} },
    });

    // Act & Assert
    expect(profileExists(config, 'dev')).toBe(true);
    expect(profileExists(config, 'prod')).toBe(true);
  });

  it('should return false for non-existing profile', () => {
    // Arrange
    const config = createConfig({
      profiles: { dev: {} },
    });

    // Act & Assert
    expect(profileExists(config, 'staging')).toBe(false);
  });
});

describe('resolveProfile', () => {
  describe('when profile does not exist', () => {
    it('should return undefined for nonexistent profile', () => {
      // Arrange
      const config = createConfig({
        profiles: { dev: {} },
      });

      // Act
      const result = resolveProfile(config, 'nonexistent');

      // Assert
      expect(result).toBeUndefined();
    });

    it('should return undefined when no profiles and no name specified', () => {
      // Arrange
      const config = createConfig({ profiles: {} });

      // Act
      const result = resolveProfile(config);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('when resolving baseUrl', () => {
    it('should use profile baseUrl when specified', () => {
      // Arrange
      const config = createConfig({
        baseUrl: 'https://api.example.com',
        profiles: { dev: { baseUrl: 'https://dev.api.example.com' } },
      });

      // Act
      const result = resolveProfile(config, 'dev');

      // Assert
      expect(result?.baseUrl).toBe('https://dev.api.example.com');
    });

    it('should fallback to workspace baseUrl when profile has none', () => {
      // Arrange
      const config = createConfig({
        baseUrl: 'https://api.example.com',
        profiles: { dev: {} },
      });

      // Act
      const result = resolveProfile(config, 'dev');

      // Assert
      expect(result?.baseUrl).toBe('https://api.example.com');
    });

    it('should be undefined when neither profile nor workspace has baseUrl', () => {
      // Arrange
      const config = createConfig({
        profiles: { dev: {} },
      });

      // Act
      const result = resolveProfile(config, 'dev');

      // Assert
      expect(result?.baseUrl).toBeUndefined();
    });
  });

  describe('when resolving headers', () => {
    it('should use profile headers', () => {
      // Arrange
      const config = createConfig({
        profiles: {
          dev: { headers: { 'X-Env': 'dev', 'X-Debug': 'true' } },
        },
      });

      // Act
      const result = resolveProfile(config, 'dev');

      // Assert
      expect(result?.headers).toEqual({ 'X-Env': 'dev', 'X-Debug': 'true' });
    });

    it('should use empty headers when profile has none', () => {
      // Arrange
      const config = createConfig({
        profiles: { dev: {} },
      });

      // Act
      const result = resolveProfile(config, 'dev');

      // Assert
      expect(result?.headers).toEqual({});
    });
  });

  describe('when resolving timeoutMs', () => {
    it('should use profile timeoutMs when specified', () => {
      // Arrange
      const config = createConfig({
        profiles: { dev: { timeoutMs: 60000 } },
      });

      // Act
      const result = resolveProfile(config, 'dev');

      // Assert
      expect(result?.timeoutMs).toBe(60000);
    });

    it('should fallback to default timeoutMs when profile has none', () => {
      // Arrange
      const config = createConfig({
        profiles: { dev: {} },
      });

      // Act
      const result = resolveProfile(config, 'dev');

      // Assert
      expect(result?.timeoutMs).toBe(CONFIG_DEFAULTS.profile.timeoutMs);
    });
  });

  describe('when resolving verifyTls', () => {
    it('should use profile verifyTls when specified', () => {
      // Arrange
      const config = createConfig({
        profiles: { dev: { verifyTls: false } },
      });

      // Act
      const result = resolveProfile(config, 'dev');

      // Assert
      expect(result?.verifyTls).toBe(false);
    });

    it('should fallback to default verifyTls when profile has none', () => {
      // Arrange
      const config = createConfig({
        profiles: { dev: {} },
      });

      // Act
      const result = resolveProfile(config, 'dev');

      // Assert
      expect(result?.verifyTls).toBe(CONFIG_DEFAULTS.profile.verifyTls);
    });
  });

  describe('when resolving vars', () => {
    it('should merge workspace and profile vars', () => {
      // Arrange
      const config = createConfig({
        vars: { tenantId: 'demo', env: 'prod' },
        profiles: {
          dev: { vars: { env: 'development', debug: 'true' } },
        },
      });

      // Act
      const result = resolveProfile(config, 'dev');

      // Assert
      expect(result?.vars).toEqual({
        tenantId: 'demo', // from workspace
        env: 'development', // from profile (overrides)
        debug: 'true', // from profile
      });
    });

    it('should use workspace vars when profile has none', () => {
      // Arrange
      const config = createConfig({
        vars: { tenantId: 'demo' },
        profiles: { dev: {} },
      });

      // Act
      const result = resolveProfile(config, 'dev');

      // Assert
      expect(result?.vars).toEqual({ tenantId: 'demo' });
    });
  });

  describe('when using default profile resolution', () => {
    it('should resolve active profile when no name specified', () => {
      // Arrange
      const config = createConfig({
        activeProfile: 'staging',
        profiles: {
          dev: { baseUrl: 'https://dev.api.example.com' },
          staging: { baseUrl: 'https://staging.api.example.com' },
        },
      });

      // Act
      const result = resolveProfile(config);

      // Assert
      expect(result?.name).toBe('staging');
      expect(result?.baseUrl).toBe('https://staging.api.example.com');
    });
  });
});

describe('createDefaultProfile', () => {
  it('should create profile with default values', () => {
    // Act
    const result = createDefaultProfile();

    // Assert
    expect(result.name).toBe('default');
    expect(result.baseUrl).toBeUndefined();
    expect(result.headers).toEqual(CONFIG_DEFAULTS.profile.headers);
    expect(result.timeoutMs).toBe(CONFIG_DEFAULTS.profile.timeoutMs);
    expect(result.verifyTls).toBe(CONFIG_DEFAULTS.profile.verifyTls);
    expect(result.vars).toEqual({});
  });
});
