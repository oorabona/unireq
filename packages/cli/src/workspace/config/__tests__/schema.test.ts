/**
 * Tests for workspace configuration schema
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { CONFIG_DEFAULTS, versionCheckSchema, workspaceConfigSchema } from '../schema.js';

describe('workspaceConfigSchema', () => {
  describe('when validating minimal config', () => {
    it('should accept config with only version: 1', () => {
      // Arrange
      const input = { version: 1 };

      // Act
      const result = v.safeParse(workspaceConfigSchema, input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.version).toBe(1);
        expect(result.output.openapi).toEqual({ cache: CONFIG_DEFAULTS.openapi.cache });
        expect(result.output.profiles).toEqual({});
        expect(result.output.auth).toEqual({ providers: {} });
        expect(result.output.vars).toEqual({});
      }
    });
  });

  describe('when validating full config', () => {
    it('should accept complete config with all fields', () => {
      // Arrange
      const input = {
        version: 1,
        name: 'my-project',
        baseUrl: 'https://api.example.com',
        openapi: {
          source: './openapi.yaml',
          cache: {
            enabled: false,
            ttlMs: 3600000,
          },
        },
        profiles: {
          dev: {
            headers: { 'X-Debug': 'true' },
            timeoutMs: 60000,
            verifyTls: false,
          },
        },
        auth: {
          active: 'api-key',
          providers: {
            'api-key': {
              type: 'api-key',
              headerName: 'X-API-Key',
            },
          },
        },
        vars: {
          userId: '123',
          env: 'development',
        },
      };

      // Act
      const result = v.safeParse(workspaceConfigSchema, input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.version).toBe(1);
        expect(result.output.name).toBe('my-project');
        expect(result.output.baseUrl).toBe('https://api.example.com');
        expect(result.output.openapi?.cache?.enabled).toBe(false);
        expect(result.output.profiles?.['dev']?.timeoutMs).toBe(60000);
        expect(result.output.auth?.active).toBe('api-key');
        expect(result.output.vars?.['userId']).toBe('123');
      }
    });
  });

  describe('when validating version', () => {
    it('should reject version: 2', () => {
      // Arrange
      const input = { version: 2 };

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

    it('should reject version: "1" (string instead of number)', () => {
      // Arrange
      const input = { version: '1' };

      // Act
      const result = v.safeParse(workspaceConfigSchema, input);

      // Assert
      expect(result.success).toBe(false);
    });
  });

  describe('when validating baseUrl', () => {
    it('should accept valid URL', () => {
      // Arrange
      const input = { version: 1, baseUrl: 'https://api.example.com/v1' };

      // Act
      const result = v.safeParse(workspaceConfigSchema, input);

      // Assert
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL', () => {
      // Arrange
      const input = { version: 1, baseUrl: 'not-a-url' };

      // Act
      const result = v.safeParse(workspaceConfigSchema, input);

      // Assert
      expect(result.success).toBe(false);
    });
  });

  describe('when validating name', () => {
    it('should reject empty string name', () => {
      // Arrange
      const input = { version: 1, name: '' };

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
        version: 1,
        profiles: {
          dev: { timeoutMs: 0 },
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
        version: 1,
        profiles: {
          dev: { timeoutMs: -1000 },
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
        version: 1,
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

  describe('when applying defaults', () => {
    it('should apply default cache settings', () => {
      // Arrange
      const input = { version: 1 };

      // Act
      const result = v.safeParse(workspaceConfigSchema, input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.openapi?.cache?.enabled).toBe(CONFIG_DEFAULTS.openapi.cache.enabled);
        expect(result.output.openapi?.cache?.ttlMs).toBe(CONFIG_DEFAULTS.openapi.cache.ttlMs);
      }
    });

    it('should apply default profile settings when profile specified', () => {
      // Arrange
      const input = {
        version: 1,
        profiles: {
          dev: {},
        },
      };

      // Act
      const result = v.safeParse(workspaceConfigSchema, input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.profiles?.['dev']?.timeoutMs).toBe(CONFIG_DEFAULTS.profile.timeoutMs);
        expect(result.output.profiles?.['dev']?.verifyTls).toBe(CONFIG_DEFAULTS.profile.verifyTls);
        expect(result.output.profiles?.['dev']?.headers).toEqual(CONFIG_DEFAULTS.profile.headers);
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
});
