/**
 * Tests for workspace doctor checks
 * Following AAA pattern for unit tests
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WorkspaceConfig } from '../../config/types.js';
import {
  checkActiveProfile,
  checkBaseUrl,
  checkOpenApiSource,
  checkProfileNames,
  checkSecretsBackend,
  checkVariableReferences,
} from '../checks.js';
import { runDoctor, runDoctorChecks } from '../runner.js';

/**
 * Create a minimal valid workspace config
 */
function createMinimalConfig(overrides: Partial<WorkspaceConfig> = {}): WorkspaceConfig {
  return {
    version: 1,
    openapi: { cache: { enabled: false, ttlMs: 0 } },
    profiles: {},
    auth: { providers: {} },
    vars: {},
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

  describe('checkActiveProfile', () => {
    describe('when no active profile set', () => {
      it('should pass with info message', () => {
        // Arrange
        const config = createMinimalConfig();

        // Act
        const result = checkActiveProfile(config);

        // Assert
        expect(result.passed).toBe(true);
        expect(result.severity).toBe('info');
        expect(result.message).toContain('No active profile set');
      });
    });

    describe('when active profile exists', () => {
      it('should pass', () => {
        // Arrange
        const config = createMinimalConfig({
          activeProfile: 'dev',
          profiles: { dev: {} },
        });

        // Act
        const result = checkActiveProfile(config);

        // Assert
        expect(result.passed).toBe(true);
        expect(result.message).toContain('"dev" exists');
      });
    });

    describe('when active profile does not exist', () => {
      it('should fail with error', () => {
        // Arrange
        const config = createMinimalConfig({
          activeProfile: 'missing',
          profiles: { dev: {}, prod: {} },
        });

        // Act
        const result = checkActiveProfile(config);

        // Assert
        expect(result.passed).toBe(false);
        expect(result.severity).toBe('error');
        expect(result.message).toContain('"missing" not found');
        expect(result.details).toContain('dev, prod');
      });
    });
  });

  describe('checkProfileNames', () => {
    describe('when all profile names are valid', () => {
      it('should pass', () => {
        // Arrange
        const config = createMinimalConfig({
          profiles: { dev: {}, prod: {}, 'staging-1': {} },
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
          profiles: { 'my profile': {}, dev: {} },
        });

        // Act
        const results = checkProfileNames(config);

        // Assert
        expect(results.some((r) => !r.passed)).toBe(true);
        expect(results.some((r) => r.message.includes('"my profile"'))).toBe(true);
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
          baseUrl: 'https://api.example.com',
        });

        // Act
        const results = checkVariableReferences(config);

        // Assert
        expect(results).toHaveLength(1);
        expect(results[0]?.passed).toBe(true);
      });
    });

    describe('when variable is defined and used', () => {
      it('should pass', () => {
        // Arrange
        const config = createMinimalConfig({
          // biome-ignore lint/suspicious/noTemplateCurlyInString: testing variable syntax
          baseUrl: 'https://${var:host}/api',
          vars: { host: 'api.example.com' },
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
          // biome-ignore lint/suspicious/noTemplateCurlyInString: testing variable syntax
          baseUrl: 'https://${var:undefined_host}/api',
          vars: {},
        });

        // Act
        const results = checkVariableReferences(config);

        // Assert
        expect(results.some((r) => !r.passed)).toBe(true);
        expect(results.some((r) => r.message.includes('undefined_host'))).toBe(true);
      });
    });
  });

  describe('checkBaseUrl', () => {
    describe('when no base URL configured', () => {
      it('should pass', () => {
        // Arrange
        const config = createMinimalConfig();

        // Act
        const result = checkBaseUrl(config);

        // Assert
        expect(result.passed).toBe(true);
      });
    });

    describe('when base URL is valid', () => {
      it('should pass', () => {
        // Arrange
        const config = createMinimalConfig({
          baseUrl: 'https://api.example.com',
        });

        // Act
        const result = checkBaseUrl(config);

        // Assert
        expect(result.passed).toBe(true);
      });
    });

    describe('when base URL contains variable', () => {
      it('should pass with info about runtime validation', () => {
        // Arrange
        const config = createMinimalConfig({
          // biome-ignore lint/suspicious/noTemplateCurlyInString: testing variable syntax
          baseUrl: 'https://${var:host}',
        });

        // Act
        const result = checkBaseUrl(config);

        // Assert
        expect(result.passed).toBe(true);
        expect(result.message).toContain('runtime');
      });
    });

    describe('when base URL is invalid', () => {
      it('should warn', () => {
        // Arrange
        const config = createMinimalConfig({
          baseUrl: 'not-a-valid-url',
        });

        // Act
        const result = checkBaseUrl(config);

        // Assert
        expect(result.passed).toBe(false);
        expect(result.severity).toBe('warning');
      });
    });
  });

  describe('checkSecretsBackend', () => {
    describe('when backend is auto', () => {
      it('should pass', () => {
        // Arrange
        const config = createMinimalConfig({
          secrets: { backend: 'auto' },
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
          secrets: { backend: 'keychain' },
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
          secrets: { backend: 'unknown' as 'auto' },
        });

        // Act
        const result = checkSecretsBackend(config);

        // Assert
        expect(result.passed).toBe(false);
        expect(result.severity).toBe('warning');
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
        profiles: { dev: {} },
        activeProfile: 'dev',
      });

      // Act
      const result = runDoctorChecks(config, testDir);

      // Assert
      expect(result.success).toBe(true);
      expect(result.errors).toBe(0);
      expect(result.passed).toBeGreaterThan(0);
    });

    it('should count errors correctly', () => {
      // Arrange
      const config = createMinimalConfig({
        activeProfile: 'missing', // Error: profile doesn't exist
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
version: 1
name: test
profiles:
  dev: {}
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
