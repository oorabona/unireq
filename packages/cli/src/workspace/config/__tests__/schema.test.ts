/**
 * Tests for workspace configuration schema (kubectl-inspired model)
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { CONFIG_DEFAULTS, versionCheckSchema, workspaceConfigSchema } from '../schema.js';

describe('workspaceConfigSchema', () => {
  describe('when validating minimal config', () => {
    it('should accept config with version: 2 and name', () => {
      // Arrange
      const input = { version: 2, name: 'my-workspace' };

      // Act
      const result = v.safeParse(workspaceConfigSchema, input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.version).toBe(2);
        expect(result.output.name).toBe('my-workspace');
        expect(result.output.openapi).toEqual({ cache: CONFIG_DEFAULTS.openapi.cache });
        expect(result.output.profiles).toEqual({});
        expect(result.output.secrets).toEqual({});
      }
    });
  });

  describe('when validating full config', () => {
    it('should accept complete config with all fields', () => {
      // Arrange
      const input = {
        version: 2,
        name: 'my-project',
        openapi: {
          source: './openapi.yaml',
          cache: {
            enabled: false,
            ttlMs: 3600000,
          },
        },
        profiles: {
          dev: {
            baseUrl: 'https://dev.api.example.com',
            headers: { 'X-Debug': 'true' },
            timeoutMs: 60000,
            verifyTls: false,
            vars: { env: 'development' },
            secrets: { DEV_KEY: 'dev-secret' },
          },
        },
        secrets: {
          SHARED_KEY: 'shared-secret',
        },
        auth: {
          active: 'main',
          providers: {
            main: {
              type: 'api_key',
              location: 'header',
              name: 'X-API-Key',
              value: '${secret:apiKey}',
            },
          },
        },
      };

      // Act
      const result = v.safeParse(workspaceConfigSchema, input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.version).toBe(2);
        expect(result.output.name).toBe('my-project');
        expect(result.output.openapi?.cache?.enabled).toBe(false);
        expect(result.output.profiles?.['dev']?.baseUrl).toBe('https://dev.api.example.com');
        expect(result.output.profiles?.['dev']?.timeoutMs).toBe(60000);
        expect(result.output.profiles?.['dev']?.vars?.['env']).toBe('development');
        expect(result.output.profiles?.['dev']?.secrets?.['DEV_KEY']).toBe('dev-secret');
        expect(result.output.secrets?.['SHARED_KEY']).toBe('shared-secret');
        expect(result.output.auth?.active).toBe('main');
      }
    });
  });

  describe('when validating version', () => {
    it('should reject version: 1 (legacy)', () => {
      // Arrange
      const input = { version: 1, name: 'test' };

      // Act
      const result = v.safeParse(workspaceConfigSchema, input);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should reject missing version', () => {
      // Arrange
      const input = { name: 'test' };

      // Act
      const result = v.safeParse(workspaceConfigSchema, input);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should reject version: "2" (string instead of number)', () => {
      // Arrange
      const input = { version: '2', name: 'test' };

      // Act
      const result = v.safeParse(workspaceConfigSchema, input);

      // Assert
      expect(result.success).toBe(false);
    });
  });

  describe('when validating name', () => {
    it('should reject missing name', () => {
      // Arrange
      const input = { version: 2 };

      // Act
      const result = v.safeParse(workspaceConfigSchema, input);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should reject empty string name', () => {
      // Arrange
      const input = { version: 2, name: '' };

      // Act
      const result = v.safeParse(workspaceConfigSchema, input);

      // Assert
      expect(result.success).toBe(false);
    });
  });

  describe('when validating profile baseUrl', () => {
    it('should accept valid profile baseUrl', () => {
      // Arrange
      const input = {
        version: 2,
        name: 'test',
        profiles: {
          dev: { baseUrl: 'https://api.example.com/v1' },
        },
      };

      // Act
      const result = v.safeParse(workspaceConfigSchema, input);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should reject invalid profile baseUrl', () => {
      // Arrange
      const input = {
        version: 2,
        name: 'test',
        profiles: {
          dev: { baseUrl: 'not-a-url' },
        },
      };

      // Act
      const result = v.safeParse(workspaceConfigSchema, input);

      // Assert
      expect(result.success).toBe(false);
    });
  });

  describe('when validating profile timeoutMs', () => {
    it('should reject non-positive timeout', () => {
      // Arrange
      const input = {
        version: 2,
        name: 'test',
        profiles: {
          dev: { baseUrl: 'https://api.example.com', timeoutMs: 0 },
        },
      };

      // Act
      const result = v.safeParse(workspaceConfigSchema, input);

      // Assert
      expect(result.success).toBe(false);
    });

    it('should reject negative timeout', () => {
      // Arrange
      const input = {
        version: 2,
        name: 'test',
        profiles: {
          dev: { baseUrl: 'https://api.example.com', timeoutMs: -1000 },
        },
      };

      // Act
      const result = v.safeParse(workspaceConfigSchema, input);

      // Assert
      expect(result.success).toBe(false);
    });
  });

  describe('when validating forward compatibility', () => {
    it('should preserve unknown fields at root level', () => {
      // Arrange
      const input = {
        version: 2,
        name: 'test',
        futureField: 'value',
        anotherFutureField: { nested: true },
      };

      // Act
      const result = v.safeParse(workspaceConfigSchema, input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.output as unknown as Record<string, unknown>)['futureField']).toBe('value');
      }
    });
  });

  describe('when validating profile with all fields', () => {
    it('should accept complete profile', () => {
      // Arrange
      const input = {
        version: 2,
        name: 'test',
        profiles: {
          dev: {
            baseUrl: 'https://dev.api.example.com',
            headers: { 'X-Env': 'dev' },
            timeoutMs: 60000,
            verifyTls: false,
            vars: { env: 'dev' },
            secrets: { API_KEY: 'key' },
          },
        },
      };

      // Act
      const result = v.safeParse(workspaceConfigSchema, input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        const profile = result.output.profiles?.['dev'];
        expect(profile?.baseUrl).toBe('https://dev.api.example.com');
        expect(profile?.headers).toEqual({ 'X-Env': 'dev' });
        expect(profile?.timeoutMs).toBe(60000);
        expect(profile?.verifyTls).toBe(false);
        expect(profile?.vars).toEqual({ env: 'dev' });
        expect(profile?.secrets).toEqual({ API_KEY: 'key' });
      }
    });
  });

  describe('when applying defaults', () => {
    it('should apply default cache settings', () => {
      // Arrange
      const input = { version: 2, name: 'test' };

      // Act
      const result = v.safeParse(workspaceConfigSchema, input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.openapi?.cache?.enabled).toBe(CONFIG_DEFAULTS.openapi.cache.enabled);
        expect(result.output.openapi?.cache?.ttlMs).toBe(CONFIG_DEFAULTS.openapi.cache.ttlMs);
      }
    });

    it('should allow profile with only baseUrl (other fields optional)', () => {
      // Arrange
      const input = {
        version: 2,
        name: 'test',
        profiles: {
          dev: { baseUrl: 'https://api.example.com' },
        },
      };

      // Act
      const result = v.safeParse(workspaceConfigSchema, input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        // Profile fields are undefined when not specified - resolved at runtime
        expect(result.output.profiles?.['dev']?.timeoutMs).toBeUndefined();
        expect(result.output.profiles?.['dev']?.verifyTls).toBeUndefined();
        expect(result.output.profiles?.['dev']?.headers).toBeUndefined();
      }
    });
  });
});

describe('versionCheckSchema', () => {
  it('should extract version number from config', () => {
    // Arrange
    const input = { version: 2, name: 'test' };

    // Act
    const result = v.safeParse(versionCheckSchema, input);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.version).toBe(2);
    }
  });
});

describe('CONFIG_DEFAULTS', () => {
  it('should have correct default values', () => {
    expect(CONFIG_DEFAULTS.openapi.cache.enabled).toBe(true);
    expect(CONFIG_DEFAULTS.openapi.cache.ttlMs).toBe(86400000);
    expect(CONFIG_DEFAULTS.profile.headers).toEqual({});
    expect(CONFIG_DEFAULTS.profile.timeoutMs).toBe(30000);
    expect(CONFIG_DEFAULTS.profile.verifyTls).toBe(true);
  });

  it('should have correct output redaction defaults', () => {
    expect(CONFIG_DEFAULTS.output.redaction.enabled).toBe(true);
    expect(CONFIG_DEFAULTS.output.redaction.additionalPatterns).toEqual([]);
  });
});

describe('output configuration schema', () => {
  describe('when validating output.redaction', () => {
    it('should apply default redaction settings when output is missing', () => {
      // Arrange
      const input = { version: 2, name: 'test' };

      // Act
      const result = v.safeParse(workspaceConfigSchema, input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.output?.redaction?.enabled).toBe(true);
        expect(result.output.output?.redaction?.additionalPatterns).toEqual([]);
      }
    });

    it('should accept output with redaction disabled', () => {
      // Arrange
      const input = {
        version: 2,
        name: 'test',
        output: {
          redaction: {
            enabled: false,
          },
        },
      };

      // Act
      const result = v.safeParse(workspaceConfigSchema, input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.output?.redaction?.enabled).toBe(false);
      }
    });

    it('should accept output with custom redaction patterns', () => {
      // Arrange
      const input = {
        version: 2,
        name: 'test',
        output: {
          redaction: {
            additionalPatterns: ['x-custom-secret', 'x-tenant-*'],
          },
        },
      };

      // Act
      const result = v.safeParse(workspaceConfigSchema, input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.output?.redaction?.additionalPatterns).toEqual(['x-custom-secret', 'x-tenant-*']);
      }
    });
  });
});
