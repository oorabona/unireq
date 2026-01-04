/**
 * Tests for workspace configuration loader (kubectl-inspired model)
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceConfigError } from '../errors.js';
import { CONFIG_FILE_NAME, hasWorkspaceConfig, loadWorkspaceConfig } from '../loader.js';

// Mock consola for warning tests
vi.mock('consola', () => ({
  consola: {
    warn: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { consola } from 'consola';

describe('loadWorkspaceConfig', () => {
  let testDir: string;

  beforeEach(() => {
    // Arrange: Create a unique temp directory for each test
    testDir = join(tmpdir(), `unireq-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    // Clear mocks
    vi.clearAllMocks();
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
      writeFileSync(join(testDir, CONFIG_FILE_NAME), 'version: 2\nname: test-workspace\n');

      // Act
      const result = loadWorkspaceConfig(testDir);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.version).toBe(2);
      expect(result?.name).toBe('test-workspace');
      expect(result?.openapi?.cache?.enabled).toBe(true);
      expect(result?.profiles).toEqual({});
    });
  });

  describe('when config file has full configuration', () => {
    it('should parse all fields correctly', () => {
      // Arrange
      const yaml = `
version: 2
name: test-project
openapi:
  source: ./openapi.yaml
  cache:
    enabled: false
    ttlMs: 3600000
profiles:
  dev:
    baseUrl: https://dev.api.example.com
    headers:
      X-Debug: "true"
    timeoutMs: 60000
    verifyTls: false
    vars:
      env: development
    secrets:
      DEV_KEY: dev-secret
secrets:
  SHARED_KEY: shared-secret
auth:
  active: main
  providers:
    main:
      type: api_key
      location: header
      name: X-API-Key
      value: '\${secret:apiKey}'
`;
      writeFileSync(join(testDir, CONFIG_FILE_NAME), yaml);

      // Act
      const result = loadWorkspaceConfig(testDir);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.name).toBe('test-project');
      expect(result?.openapi?.source).toBe('./openapi.yaml');
      expect(result?.openapi?.cache?.enabled).toBe(false);
      expect(result?.profiles?.['dev']?.baseUrl).toBe('https://dev.api.example.com');
      expect(result?.profiles?.['dev']?.timeoutMs).toBe(60000);
      expect(result?.profiles?.['dev']?.vars?.['env']).toBe('development');
      expect(result?.profiles?.['dev']?.secrets?.['DEV_KEY']).toBe('dev-secret');
      expect(result?.secrets?.['SHARED_KEY']).toBe('shared-secret');
      expect(result?.auth?.active).toBe('main');
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
version: 2
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
    it('should throw WorkspaceConfigError for version: 1 (old version)', () => {
      // Arrange
      writeFileSync(join(testDir, CONFIG_FILE_NAME), 'version: 1\n');

      // Act & Assert
      expect(() => loadWorkspaceConfig(testDir)).toThrow(WorkspaceConfigError);
      try {
        loadWorkspaceConfig(testDir);
      } catch (e) {
        expect(e).toBeInstanceOf(WorkspaceConfigError);
        expect((e as WorkspaceConfigError).message).toContain('version: 1');
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
    it('should throw WorkspaceConfigError for missing required name', () => {
      // Arrange
      const yaml = `
version: 2
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
version: 2
name: test-workspace
profiles:
  dev:
    baseUrl: https://api.example.com
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
version: 2
name: test-workspace
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

  describe('S-6: Unknown defaults field warning', () => {
    it('should warn about unknown field in workspace defaults', () => {
      // Given workspace.yaml contains defaults with unknown field
      const yaml = `
version: 2
name: test-workspace
defaults:
  includeHeaders: true
  futureOption: true
`;
      writeFileSync(join(testDir, CONFIG_FILE_NAME), yaml);

      // When loadWorkspaceConfig() is called
      const result = loadWorkspaceConfig(testDir);

      // Then it succeeds
      expect(result).not.toBeNull();
      expect(result?.defaults?.includeHeaders).toBe(true);

      // And a warning is logged about unknown field
      expect(consola.warn).toHaveBeenCalledWith("Unknown field 'futureOption' in defaults will be ignored");
    });

    it('should warn about unknown field in method-specific defaults', () => {
      // Given workspace.yaml contains defaults.get with unknown field
      const yaml = `
version: 2
name: test-workspace
defaults:
  get:
    includeHeaders: true
    futureOption: true
`;
      writeFileSync(join(testDir, CONFIG_FILE_NAME), yaml);

      // When loadWorkspaceConfig() is called
      const result = loadWorkspaceConfig(testDir);

      // Then it succeeds and warns
      expect(result).not.toBeNull();
      expect(consola.warn).toHaveBeenCalledWith("Unknown field 'futureOption' in defaults.get will be ignored");
    });

    it('should warn about unknown field in profile defaults', () => {
      // Given workspace.yaml contains profile defaults with unknown field
      const yaml = `
version: 2
name: test-workspace
profiles:
  dev:
    baseUrl: https://api.example.com
    defaults:
      trace: true
      unknownSetting: value
`;
      writeFileSync(join(testDir, CONFIG_FILE_NAME), yaml);

      // When loadWorkspaceConfig() is called
      const result = loadWorkspaceConfig(testDir);

      // Then it succeeds and warns
      expect(result).not.toBeNull();
      expect(consola.warn).toHaveBeenCalledWith(
        "Unknown field 'unknownSetting' in profiles.dev.defaults will be ignored",
      );
    });

    it('should warn about unknown field in profile method-specific defaults', () => {
      // Given profile.dev.defaults.post has unknown field
      const yaml = `
version: 2
name: test-workspace
profiles:
  prod:
    baseUrl: https://api.example.com
    defaults:
      post:
        trace: true
        weirdOption: 123
`;
      writeFileSync(join(testDir, CONFIG_FILE_NAME), yaml);

      // When loadWorkspaceConfig() is called
      const result = loadWorkspaceConfig(testDir);

      // Then it succeeds and warns
      expect(result).not.toBeNull();
      expect(consola.warn).toHaveBeenCalledWith(
        "Unknown field 'weirdOption' in profiles.prod.defaults.post will be ignored",
      );
    });

    it('should warn about multiple unknown fields', () => {
      // Given defaults has multiple unknown fields
      const yaml = `
version: 2
name: test-workspace
defaults:
  includeHeaders: true
  futureA: true
  futureB: false
`;
      writeFileSync(join(testDir, CONFIG_FILE_NAME), yaml);

      // When loadWorkspaceConfig() is called
      loadWorkspaceConfig(testDir);

      // Then warnings are logged for each
      expect(consola.warn).toHaveBeenCalledTimes(2);
      expect(consola.warn).toHaveBeenCalledWith("Unknown field 'futureA' in defaults will be ignored");
      expect(consola.warn).toHaveBeenCalledWith("Unknown field 'futureB' in defaults will be ignored");
    });

    it('should NOT warn for known defaults keys', () => {
      // Given defaults has only known fields
      const yaml = `
version: 2
name: test-workspace
defaults:
  includeHeaders: true
  outputMode: json
  showSummary: true
  trace: false
  showSecrets: false
  hideBody: true
  get:
    includeHeaders: false
  post:
    trace: true
`;
      writeFileSync(join(testDir, CONFIG_FILE_NAME), yaml);

      // When loadWorkspaceConfig() is called
      const result = loadWorkspaceConfig(testDir);

      // Then no warnings are logged
      expect(result).not.toBeNull();
      expect(consola.warn).not.toHaveBeenCalled();
    });

    it('should NOT warn when no defaults section exists', () => {
      // Given minimal config without defaults
      const yaml = `
version: 2
name: test-workspace
`;
      writeFileSync(join(testDir, CONFIG_FILE_NAME), yaml);

      // When loadWorkspaceConfig() is called
      loadWorkspaceConfig(testDir);

      // Then no warnings are logged
      expect(consola.warn).not.toHaveBeenCalled();
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
    writeFileSync(join(testDir, CONFIG_FILE_NAME), 'version: 2\nname: test\n');

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
