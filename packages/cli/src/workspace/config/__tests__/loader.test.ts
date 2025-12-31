/**
 * Tests for workspace configuration loader
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorkspaceConfigError } from '../errors.js';
import { CONFIG_FILE_NAME, hasWorkspaceConfig, loadWorkspaceConfig } from '../loader.js';

describe('loadWorkspaceConfig', () => {
  let testDir: string;

  beforeEach(() => {
    // Arrange: Create a unique temp directory for each test
    testDir = join(tmpdir(), `unireq-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('when config file does not exist', () => {
    it('should return null', () => {
      // Act
      const result = loadWorkspaceConfig(testDir);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('when config file exists with valid minimal config', () => {
    it('should parse and return config with defaults applied', () => {
      // Arrange
      writeFileSync(join(testDir, CONFIG_FILE_NAME), 'version: 1\n');

      // Act
      const result = loadWorkspaceConfig(testDir);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.version).toBe(1);
      expect(result?.openapi.cache.enabled).toBe(true);
      expect(result?.profiles).toEqual({});
    });
  });

  describe('when config file has full configuration', () => {
    it('should parse all fields correctly', () => {
      // Arrange
      const yaml = `
version: 1
name: test-project
baseUrl: https://api.example.com
openapi:
  source: ./openapi.yaml
  cache:
    enabled: false
    ttlMs: 3600000
profiles:
  dev:
    headers:
      X-Debug: "true"
    timeoutMs: 60000
    verifyTls: false
auth:
  active: api-key
  providers:
    api-key:
      type: api-key
vars:
  env: development
`;
      writeFileSync(join(testDir, CONFIG_FILE_NAME), yaml);

      // Act
      const result = loadWorkspaceConfig(testDir);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.name).toBe('test-project');
      expect(result?.baseUrl).toBe('https://api.example.com');
      expect(result?.openapi.source).toBe('./openapi.yaml');
      expect(result?.openapi.cache.enabled).toBe(false);
      expect(result?.profiles['dev']?.timeoutMs).toBe(60000);
      expect(result?.auth.active).toBe('api-key');
      expect(result?.vars['env']).toBe('development');
    });
  });

  describe('when config file is empty', () => {
    it('should throw WorkspaceConfigError with version field path', () => {
      // Arrange
      writeFileSync(join(testDir, CONFIG_FILE_NAME), '');

      // Act & Assert
      expect(() => loadWorkspaceConfig(testDir)).toThrow(WorkspaceConfigError);
      try {
        loadWorkspaceConfig(testDir);
      } catch (e) {
        expect(e).toBeInstanceOf(WorkspaceConfigError);
        expect((e as WorkspaceConfigError).fieldPath).toBe('version');
      }
    });
  });

  describe('when config file has only whitespace', () => {
    it('should throw WorkspaceConfigError', () => {
      // Arrange
      writeFileSync(join(testDir, CONFIG_FILE_NAME), '   \n\t\n   ');

      // Act & Assert
      expect(() => loadWorkspaceConfig(testDir)).toThrow(WorkspaceConfigError);
    });
  });

  describe('when config file has YAML with null document', () => {
    it('should throw WorkspaceConfigError for missing version', () => {
      // Arrange
      writeFileSync(join(testDir, CONFIG_FILE_NAME), '~\n'); // YAML null

      // Act & Assert
      expect(() => loadWorkspaceConfig(testDir)).toThrow(WorkspaceConfigError);
      try {
        loadWorkspaceConfig(testDir);
      } catch (e) {
        expect((e as WorkspaceConfigError).fieldPath).toBe('version');
      }
    });
  });

  describe('when config file has invalid YAML syntax', () => {
    it('should throw WorkspaceConfigError with line information', () => {
      // Arrange
      const invalidYaml = `
version: 1
name: test
  invalid-indent: here
`;
      writeFileSync(join(testDir, CONFIG_FILE_NAME), invalidYaml);

      // Act & Assert
      expect(() => loadWorkspaceConfig(testDir)).toThrow(WorkspaceConfigError);
      try {
        loadWorkspaceConfig(testDir);
      } catch (e) {
        expect(e).toBeInstanceOf(WorkspaceConfigError);
        expect((e as WorkspaceConfigError).line).toBeDefined();
      }
    });
  });

  describe('when config file has unsupported version', () => {
    it('should throw WorkspaceConfigError for version: 2', () => {
      // Arrange
      writeFileSync(join(testDir, CONFIG_FILE_NAME), 'version: 2\n');

      // Act & Assert
      expect(() => loadWorkspaceConfig(testDir)).toThrow(WorkspaceConfigError);
      try {
        loadWorkspaceConfig(testDir);
      } catch (e) {
        expect(e).toBeInstanceOf(WorkspaceConfigError);
        expect((e as WorkspaceConfigError).message).toContain('version: 2');
      }
    });

    it('should throw WorkspaceConfigError for version: 99', () => {
      // Arrange
      writeFileSync(join(testDir, CONFIG_FILE_NAME), 'version: 99\n');

      // Act & Assert
      expect(() => loadWorkspaceConfig(testDir)).toThrow(WorkspaceConfigError);
    });
  });

  describe('when config file has schema validation errors', () => {
    it('should throw WorkspaceConfigError for invalid baseUrl', () => {
      // Arrange
      const yaml = `
version: 1
baseUrl: not-a-valid-url
`;
      writeFileSync(join(testDir, CONFIG_FILE_NAME), yaml);

      // Act & Assert
      expect(() => loadWorkspaceConfig(testDir)).toThrow(WorkspaceConfigError);
      try {
        loadWorkspaceConfig(testDir);
      } catch (e) {
        expect(e).toBeInstanceOf(WorkspaceConfigError);
        expect((e as WorkspaceConfigError).message).toContain('Validation error');
      }
    });

    it('should throw WorkspaceConfigError for negative timeout', () => {
      // Arrange
      const yaml = `
version: 1
profiles:
  dev:
    timeoutMs: -1000
`;
      writeFileSync(join(testDir, CONFIG_FILE_NAME), yaml);

      // Act & Assert
      expect(() => loadWorkspaceConfig(testDir)).toThrow(WorkspaceConfigError);
    });
  });

  describe('when config file has unknown fields', () => {
    it('should preserve unknown fields for forward compatibility', () => {
      // Arrange
      const yaml = `
version: 1
futureField: some-value
anotherFuture:
  nested: true
`;
      writeFileSync(join(testDir, CONFIG_FILE_NAME), yaml);

      // Act
      const result = loadWorkspaceConfig(testDir);

      // Assert
      expect(result).not.toBeNull();
      expect((result as unknown as Record<string, unknown>)['futureField']).toBe('some-value');
    });
  });
});

describe('hasWorkspaceConfig', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `unireq-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should return false when config file does not exist', () => {
    // Act
    const result = hasWorkspaceConfig(testDir);

    // Assert
    expect(result).toBe(false);
  });

  it('should return true when config file exists', () => {
    // Arrange
    writeFileSync(join(testDir, CONFIG_FILE_NAME), 'version: 1\n');

    // Act
    const result = hasWorkspaceConfig(testDir);

    // Assert
    expect(result).toBe(true);
  });
});

describe('CONFIG_FILE_NAME', () => {
  it('should be workspace.yaml', () => {
    expect(CONFIG_FILE_NAME).toBe('workspace.yaml');
  });
});
