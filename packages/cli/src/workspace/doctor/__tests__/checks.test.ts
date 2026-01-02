/**
 * Tests for workspace doctor checks (kubectl-inspired model)
 * Following AAA pattern for unit tests
 *
 * Note: checkActiveProfile and checkBaseUrl are removed in kubectl model
 * - activeProfile is now in GlobalConfig, not WorkspaceConfig
 * - baseUrl is now required per-profile, not at workspace level
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WorkspaceConfig } from '../../config/types.js';
import {
  checkHasProfiles,
  checkOpenApiSource,
  checkProfileBaseUrls,
  checkProfileNames,
  checkSecretsBackend,
  checkVariableReferences,
  checkWorkspaceName,
} from '../checks.js';
import { runDoctor, runDoctorChecks } from '../runner.js';

/**
 * Create a minimal valid workspace config (version 2, kubectl model)
 */
function createMinimalConfig(overrides: Partial<WorkspaceConfig> = {}): WorkspaceConfig {
  return {
    version: 2,
    name: 'test-workspace',
    openapi: { cache: { enabled: false, ttlMs: 0 } },
    profiles: {},
    auth: { providers: {} },
    secrets: {},
    ...overrides,
  };
}

describe('Doctor Checks', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `unireq-doctor-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('checkWorkspaceName', () => {
    describe('when name is valid', () => {
      it('should pass', () => {
        // Arrange
        const config = createMinimalConfig({ name: 'my-api' });

        // Act
        const result = checkWorkspaceName(config);

        // Assert
        expect(result.passed).toBe(true);
        expect(result.message).toContain('my-api');
      });
    });

    describe('when name has invalid characters', () => {
      it('should warn', () => {
        // Arrange
        const config = createMinimalConfig({ name: 'my api with spaces' });

        // Act
        const result = checkWorkspaceName(config);

        // Assert
        expect(result.passed).toBe(false);
        expect(result.severity).toBe('warning');
        expect(result.message).toContain('invalid characters');
      });
    });

    describe('when name is missing', () => {
      it('should fail with error', () => {
        // Arrange - force undefined name
        const config = createMinimalConfig();
        (config as unknown as Record<string, unknown>)['name'] = undefined;

        // Act
        const result = checkWorkspaceName(config);

        // Assert
        expect(result.passed).toBe(false);
        expect(result.severity).toBe('error');
        expect(result.message).toContain('required');
      });
    });
  });

  describe('checkHasProfiles', () => {
    describe('when no profiles defined', () => {
      it('should pass with warning', () => {
        // Arrange
        const config = createMinimalConfig({ profiles: {} });

        // Act
        const result = checkHasProfiles(config);

        // Assert
        expect(result.passed).toBe(true);
        expect(result.severity).toBe('warning');
        expect(result.message).toContain('No profiles defined');
      });
    });

    describe('when profiles exist', () => {
      it('should pass with info', () => {
        // Arrange
        const config = createMinimalConfig({
          profiles: {
            dev: { baseUrl: 'https://dev.api.example.com' },
            prod: { baseUrl: 'https://api.example.com' },
          },
        });

        // Act
        const result = checkHasProfiles(config);

        // Assert
        expect(result.passed).toBe(true);
        expect(result.severity).toBe('info');
        expect(result.message).toContain('2 profile(s)');
      });
    });
  });

  describe('checkProfileNames', () => {
    describe('when all profile names are valid', () => {
      it('should pass', () => {
        // Arrange
        const config = createMinimalConfig({
          profiles: {
            dev: { baseUrl: 'https://dev.api.example.com' },
            prod: { baseUrl: 'https://api.example.com' },
            'staging-1': { baseUrl: 'https://staging.api.example.com' },
          },
        });

        // Act
        const results = checkProfileNames(config);

        // Assert
        expect(results).toHaveLength(1);
        expect(results[0]?.passed).toBe(true);
      });
    });

    describe('when profile name has invalid characters', () => {
      it('should warn', () => {
        // Arrange
        const config = createMinimalConfig({
          profiles: {
            'my profile': { baseUrl: 'https://api.example.com' },
            dev: { baseUrl: 'https://dev.api.example.com' },
          },
        });

        // Act
        const results = checkProfileNames(config);

        // Assert
        expect(results.some((r) => !r.passed)).toBe(true);
        expect(results.some((r) => r.message.includes('"my profile"'))).toBe(true);
      });
    });
  });

  describe('checkProfileBaseUrls', () => {
    describe('when all profile baseUrls are valid', () => {
      it('should pass', () => {
        // Arrange
        const config = createMinimalConfig({
          profiles: {
            dev: { baseUrl: 'https://dev.api.example.com' },
            prod: { baseUrl: 'https://api.example.com' },
          },
        });

        // Act
        const results = checkProfileBaseUrls(config);

        // Assert
        expect(results.every((r) => r.passed)).toBe(true);
      });
    });

    describe('when profile baseUrl is invalid', () => {
      it('should fail with error', () => {
        // Arrange
        const config = createMinimalConfig({
          profiles: {
            dev: { baseUrl: 'not-a-url' },
          },
        });

        // Act
        const results = checkProfileBaseUrls(config);

        // Assert
        expect(results.some((r) => !r.passed)).toBe(true);
        expect(results.some((r) => r.severity === 'error')).toBe(true);
      });
    });

    describe('when profile baseUrl contains variable', () => {
      it('should pass with info about runtime validation', () => {
        // Arrange
        const config = createMinimalConfig({
          profiles: {
            dev: { baseUrl: 'https://${var:host}/api' },
          },
        });

        // Act
        const results = checkProfileBaseUrls(config);

        // Assert
        expect(results.every((r) => r.passed)).toBe(true);
        expect(results.some((r) => r.message.includes('runtime'))).toBe(true);
      });
    });

    describe('when no profiles defined', () => {
      it('should pass with info', () => {
        // Arrange
        const config = createMinimalConfig({ profiles: {} });

        // Act
        const results = checkProfileBaseUrls(config);

        // Assert
        expect(results).toHaveLength(1);
        expect(results[0]?.passed).toBe(true);
        expect(results[0]?.message).toContain('No profiles defined');
      });
    });
  });

  describe('checkOpenApiSource', () => {
    describe('when no source configured', () => {
      it('should pass with info', () => {
        // Arrange
        const config = createMinimalConfig();

        // Act
        const result = checkOpenApiSource(config, testDir);

        // Assert
        expect(result.passed).toBe(true);
        expect(result.message).toContain('No OpenAPI source');
      });
    });

    describe('when source is a URL', () => {
      it('should pass', () => {
        // Arrange
        const config = createMinimalConfig({
          openapi: {
            source: 'https://api.example.com/openapi.yaml',
            cache: { enabled: false, ttlMs: 0 },
          },
        });

        // Act
        const result = checkOpenApiSource(config, testDir);

        // Assert
        expect(result.passed).toBe(true);
        expect(result.message).toContain('URL');
      });
    });

    describe('when source file exists', () => {
      it('should pass', () => {
        // Arrange
        const apiFile = join(testDir, 'openapi.yaml');
        writeFileSync(apiFile, 'openapi: 3.0.0');
        const config = createMinimalConfig({
          openapi: {
            source: 'openapi.yaml',
            cache: { enabled: false, ttlMs: 0 },
          },
        });

        // Act
        const result = checkOpenApiSource(config, join(testDir, '.unireq'));

        // Assert
        expect(result.passed).toBe(true);
        expect(result.message).toContain('exists');
      });
    });

    describe('when source file does not exist', () => {
      it('should warn', () => {
        // Arrange
        const config = createMinimalConfig({
          openapi: {
            source: 'missing.yaml',
            cache: { enabled: false, ttlMs: 0 },
          },
        });

        // Act
        const result = checkOpenApiSource(config, testDir);

        // Assert
        expect(result.passed).toBe(false);
        expect(result.severity).toBe('warning');
        expect(result.message).toContain('not found');
      });
    });
  });

  describe('checkVariableReferences', () => {
    describe('when no variables are referenced', () => {
      it('should pass', () => {
        // Arrange
        const config = createMinimalConfig({
          profiles: {
            dev: { baseUrl: 'https://api.example.com' },
          },
        });

        // Act
        const results = checkVariableReferences(config);

        // Assert
        expect(results).toHaveLength(1);
        expect(results[0]?.passed).toBe(true);
      });
    });

    describe('when variable is defined in profile and used', () => {
      it('should pass', () => {
        // Arrange
        const config = createMinimalConfig({
          profiles: {
            dev: {
              baseUrl: 'https://${var:host}/api',
              vars: { host: 'api.example.com' },
            },
          },
        });

        // Act
        const results = checkVariableReferences(config);

        // Assert
        expect(results.every((r) => r.passed)).toBe(true);
      });
    });

    describe('when variable is undefined', () => {
      it('should warn', () => {
        // Arrange
        const config = createMinimalConfig({
          profiles: {
            dev: {
              baseUrl: 'https://${var:undefined_host}/api',
            },
          },
        });

        // Act
        const results = checkVariableReferences(config);

        // Assert
        expect(results.some((r) => !r.passed)).toBe(true);
        expect(results.some((r) => r.message.includes('undefined_host'))).toBe(true);
      });
    });

    describe('when secret is defined at workspace level', () => {
      it('should pass when used in profile', () => {
        // Arrange
        const config = createMinimalConfig({
          secrets: { API_KEY: 'secret-value' },
          profiles: {
            dev: {
              baseUrl: 'https://api.example.com',
              headers: { 'X-API-Key': '${var:API_KEY}' },
            },
          },
        });

        // Act
        const results = checkVariableReferences(config);

        // Assert
        expect(results.every((r) => r.passed)).toBe(true);
      });
    });
  });

  describe('checkSecretsBackend', () => {
    describe('when backend is auto', () => {
      it('should pass', () => {
        // Arrange
        const config = createMinimalConfig({
          secretsBackend: { backend: 'auto' },
        });

        // Act
        const result = checkSecretsBackend(config);

        // Assert
        expect(result.passed).toBe(true);
      });
    });

    describe('when backend is keychain', () => {
      it('should pass', () => {
        // Arrange
        const config = createMinimalConfig({
          secretsBackend: { backend: 'keychain' },
        });

        // Act
        const result = checkSecretsBackend(config);

        // Assert
        expect(result.passed).toBe(true);
      });
    });

    describe('when backend is unknown', () => {
      it('should warn', () => {
        // Arrange
        const config = createMinimalConfig({
          secretsBackend: { backend: 'unknown' as 'auto' },
        });

        // Act
        const result = checkSecretsBackend(config);

        // Assert
        expect(result.passed).toBe(false);
        expect(result.severity).toBe('warning');
      });
    });

    describe('when no backend configured', () => {
      it('should pass with auto default', () => {
        // Arrange
        const config = createMinimalConfig();

        // Act
        const result = checkSecretsBackend(config);

        // Assert
        expect(result.passed).toBe(true);
        expect(result.message).toContain('auto');
      });
    });
  });
});

describe('Doctor Runner', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `unireq-doctor-runner-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('runDoctorChecks', () => {
    it('should return aggregated results for valid config', () => {
      // Arrange
      const config = createMinimalConfig({
        profiles: {
          dev: { baseUrl: 'https://dev.api.example.com' },
        },
      });

      // Act
      const result = runDoctorChecks(config, testDir);

      // Assert
      expect(result.success).toBe(true);
      expect(result.errors).toBe(0);
      expect(result.passed).toBeGreaterThan(0);
    });

    it('should count warnings correctly for empty profiles', () => {
      // Arrange
      const config = createMinimalConfig({ profiles: {} });

      // Act
      const result = runDoctorChecks(config, testDir);

      // Assert - no profiles is a warning, not an error
      expect(result.success).toBe(true);
      expect(result.warnings).toBeGreaterThan(0);
    });

    it('should count errors for invalid profile baseUrl', () => {
      // Arrange
      const config = createMinimalConfig({
        profiles: {
          dev: { baseUrl: 'not-a-valid-url' },
        },
      });

      // Act
      const result = runDoctorChecks(config, testDir);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errors).toBeGreaterThan(0);
    });
  });

  describe('runDoctor', () => {
    it('should return error for missing workspace', () => {
      // Arrange
      const missingPath = join(testDir, 'missing');

      // Act
      const result = runDoctor(missingPath);

      // Assert
      expect(result.success).toBe(false);
      expect('error' in result).toBe(true);
    });

    it('should run checks for valid workspace', () => {
      // Arrange
      const workspacePath = join(testDir, '.unireq');
      mkdirSync(workspacePath, { recursive: true });
      writeFileSync(
        join(workspacePath, 'workspace.yaml'),
        `
version: 2
name: test
profiles:
  dev:
    baseUrl: https://api.example.com
`,
        'utf-8',
      );

      // Act
      const result = runDoctor(workspacePath);

      // Assert
      expect(result.success).toBe(true);
      expect('checks' in result).toBe(true);
    });
  });
});
