/**
 * Tests for profile resolution logic (kubectl-inspired model)
 * Following AAA pattern for unit tests
 */

import { describe, expect, it } from 'vitest';
import { CONFIG_DEFAULTS } from '../../config/schema.js';
import type { WorkspaceConfig } from '../../config/types.js';
import {
  createDefaultProfile,
  getDefaultProfileName,
  listProfiles,
  profileExists,
  resolveActiveProfile,
  resolveProfile,
} from '../resolver.js';

/**
 * Helper to create a minimal WorkspaceConfig for testing
 */
function createConfig(overrides: Partial<WorkspaceConfig> = {}): WorkspaceConfig {
  return {
    version: 2,
    name: 'test-workspace',
    openapi: { cache: { enabled: true, ttlMs: 86400000 } },
    profiles: {},
    auth: { providers: {} },
    secrets: {},
    ...overrides,
  };
}

describe('getDefaultProfileName', () => {
  describe('when no profiles exist', () => {
    it('should return undefined', () => {
      // Arrange
      const config = createConfig({ profiles: {} });

      // Act
      const result = getDefaultProfileName(config);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('when profiles exist', () => {
    it('should return "default" if it exists', () => {
      // Arrange
      const config = createConfig({
        profiles: {
          dev: { baseUrl: 'https://dev.api.example.com' },
          default: { baseUrl: 'https://api.example.com' },
          prod: { baseUrl: 'https://prod.api.example.com' },
        },
      });

      // Act
      const result = getDefaultProfileName(config);

      // Assert
      expect(result).toBe('default');
    });

    it('should return first profile (sorted) if "default" does not exist', () => {
      // Arrange
      const config = createConfig({
        profiles: {
          staging: { baseUrl: 'https://staging.api.example.com' },
          dev: { baseUrl: 'https://dev.api.example.com' },
          prod: { baseUrl: 'https://prod.api.example.com' },
        },
      });

      // Act
      const result = getDefaultProfileName(config);

      // Assert
      expect(result).toBe('dev'); // First alphabetically
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

  it('should return all profile names sorted', () => {
    // Arrange
    const config = createConfig({
      profiles: {
        prod: { baseUrl: 'https://prod.api.example.com' },
        dev: { baseUrl: 'https://dev.api.example.com' },
        staging: { baseUrl: 'https://staging.api.example.com' },
      },
    });

    // Act
    const result = listProfiles(config);

    // Assert
    expect(result).toEqual(['dev', 'prod', 'staging']);
  });
});

describe('profileExists', () => {
  it('should return true for existing profile', () => {
    // Arrange
    const config = createConfig({
      profiles: {
        dev: { baseUrl: 'https://dev.api.example.com' },
        prod: { baseUrl: 'https://prod.api.example.com' },
      },
    });

    // Act & Assert
    expect(profileExists(config, 'dev')).toBe(true);
    expect(profileExists(config, 'prod')).toBe(true);
  });

  it('should return false for non-existing profile', () => {
    // Arrange
    const config = createConfig({
      profiles: { dev: { baseUrl: 'https://dev.api.example.com' } },
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
        profiles: { dev: { baseUrl: 'https://dev.api.example.com' } },
      });

      // Act
      const result = resolveProfile(config, 'nonexistent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('when resolving baseUrl', () => {
    it('should use profile baseUrl', () => {
      // Arrange
      const config = createConfig({
        profiles: { dev: { baseUrl: 'https://dev.api.example.com' } },
      });

      // Act
      const result = resolveProfile(config, 'dev');

      // Assert
      expect(result?.baseUrl).toBe('https://dev.api.example.com');
    });
  });

  describe('when resolving headers', () => {
    it('should use profile headers', () => {
      // Arrange
      const config = createConfig({
        profiles: {
          dev: {
            baseUrl: 'https://dev.api.example.com',
            headers: { 'X-Env': 'dev', 'X-Debug': 'true' },
          },
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
        profiles: { dev: { baseUrl: 'https://dev.api.example.com' } },
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
        profiles: { dev: { baseUrl: 'https://dev.api.example.com', timeoutMs: 60000 } },
      });

      // Act
      const result = resolveProfile(config, 'dev');

      // Assert
      expect(result?.timeoutMs).toBe(60000);
    });

    it('should fallback to default timeoutMs when profile has none', () => {
      // Arrange
      const config = createConfig({
        profiles: { dev: { baseUrl: 'https://dev.api.example.com' } },
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
        profiles: { dev: { baseUrl: 'https://dev.api.example.com', verifyTls: false } },
      });

      // Act
      const result = resolveProfile(config, 'dev');

      // Assert
      expect(result?.verifyTls).toBe(false);
    });

    it('should fallback to default verifyTls when profile has none', () => {
      // Arrange
      const config = createConfig({
        profiles: { dev: { baseUrl: 'https://dev.api.example.com' } },
      });

      // Act
      const result = resolveProfile(config, 'dev');

      // Assert
      expect(result?.verifyTls).toBe(CONFIG_DEFAULTS.profile.verifyTls);
    });
  });

  describe('when resolving vars', () => {
    it('should use profile vars', () => {
      // Arrange
      const config = createConfig({
        profiles: {
          dev: {
            baseUrl: 'https://dev.api.example.com',
            vars: { env: 'development', debug: 'true' },
          },
        },
      });

      // Act
      const result = resolveProfile(config, 'dev');

      // Assert
      expect(result?.vars).toEqual({
        env: 'development',
        debug: 'true',
      });
    });

    it('should use empty vars when profile has none', () => {
      // Arrange
      const config = createConfig({
        profiles: { dev: { baseUrl: 'https://dev.api.example.com' } },
      });

      // Act
      const result = resolveProfile(config, 'dev');

      // Assert
      expect(result?.vars).toEqual({});
    });
  });

  describe('when resolving secrets', () => {
    it('should merge workspace and profile secrets', () => {
      // Arrange
      const config = createConfig({
        secrets: { API_KEY: 'workspace-key', SHARED_SECRET: 'shared' },
        profiles: {
          dev: {
            baseUrl: 'https://dev.api.example.com',
            secrets: { API_KEY: 'dev-key', DEV_TOKEN: 'dev-token' },
          },
        },
      });

      // Act
      const result = resolveProfile(config, 'dev');

      // Assert
      expect(result?.secrets).toEqual({
        API_KEY: 'dev-key', // Profile overrides workspace
        SHARED_SECRET: 'shared', // From workspace
        DEV_TOKEN: 'dev-token', // From profile
      });
    });

    it('should use workspace secrets when profile has none', () => {
      // Arrange
      const config = createConfig({
        secrets: { API_KEY: 'workspace-key' },
        profiles: { dev: { baseUrl: 'https://dev.api.example.com' } },
      });

      // Act
      const result = resolveProfile(config, 'dev');

      // Assert
      expect(result?.secrets).toEqual({ API_KEY: 'workspace-key' });
    });
  });
});

describe('resolveActiveProfile', () => {
  it('should resolve specified active profile', () => {
    // Arrange
    const config = createConfig({
      profiles: {
        dev: { baseUrl: 'https://dev.api.example.com' },
        staging: { baseUrl: 'https://staging.api.example.com' },
      },
    });

    // Act
    const result = resolveActiveProfile(config, 'staging');

    // Assert
    expect(result?.name).toBe('staging');
    expect(result?.baseUrl).toBe('https://staging.api.example.com');
  });

  it('should fallback to default when active profile does not exist', () => {
    // Arrange
    const config = createConfig({
      profiles: {
        dev: { baseUrl: 'https://dev.api.example.com' },
        default: { baseUrl: 'https://api.example.com' },
      },
    });

    // Act
    const result = resolveActiveProfile(config, 'nonexistent');

    // Assert
    expect(result?.name).toBe('default');
    expect(result?.baseUrl).toBe('https://api.example.com');
  });

  it('should fallback to default when no active profile specified', () => {
    // Arrange
    const config = createConfig({
      profiles: {
        dev: { baseUrl: 'https://dev.api.example.com' },
        default: { baseUrl: 'https://api.example.com' },
      },
    });

    // Act
    const result = resolveActiveProfile(config, undefined);

    // Assert
    expect(result?.name).toBe('default');
  });

  it('should return undefined when no profiles exist', () => {
    // Arrange
    const config = createConfig({ profiles: {} });

    // Act
    const result = resolveActiveProfile(config, undefined);

    // Assert
    expect(result).toBeUndefined();
  });
});

describe('createDefaultProfile', () => {
  it('should create profile with default values', () => {
    // Act
    const result = createDefaultProfile();

    // Assert
    expect(result.name).toBe('default');
    expect(result.baseUrl).toBe(''); // Empty string in kubectl model
    expect(result.headers).toEqual(CONFIG_DEFAULTS.profile.headers);
    expect(result.timeoutMs).toBe(CONFIG_DEFAULTS.profile.timeoutMs);
    expect(result.verifyTls).toBe(CONFIG_DEFAULTS.profile.verifyTls);
    expect(result.vars).toEqual({});
    expect(result.secrets).toEqual({});
  });
});
