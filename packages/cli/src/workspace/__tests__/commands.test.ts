/**
 * Tests for workspace management REPL commands
 * Following AAA pattern for unit tests
 */

import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { consola } from 'consola';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { parse as parseYaml } from 'yaml';
import type { ReplState } from '../../repl/state.js';
import { initWorkspace, workspaceHandler } from '../commands.js';
import { CONFIG_FILE_NAME } from '../config/loader.js';
import { WORKSPACE_DIR_NAME } from '../constants.js';

// Create mocks with vi.hoisted (hoisted before mocks)
const { isCancelMock } = vi.hoisted(() => ({
  isCancelMock: vi.fn(() => false),
}));

// Mock consola
vi.mock('consola', () => ({
  consola: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  text: vi.fn(),
  confirm: vi.fn(),
  cancel: vi.fn(),
  isCancel: isCancelMock,
}));

// Import mocked modules
import * as clack from '@clack/prompts';

/**
 * Create a temporary directory for tests
 */
function createTempDir(): string {
  const tempPath = join(tmpdir(), `unireq-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempPath, { recursive: true });
  return tempPath;
}

/**
 * Create minimal REPL state for testing
 */
function createState(): ReplState {
  return {
    currentPath: '/',
    running: true,
  };
}

describe('initWorkspace', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('when target directory is empty', () => {
    it('should create workspace directory', () => {
      // Act
      const result = initWorkspace({ targetDir: tempDir });

      // Assert
      expect(existsSync(result.workspacePath)).toBe(true);
      expect(result.workspacePath).toBe(join(tempDir, WORKSPACE_DIR_NAME));
    });

    it('should create workspace.yaml file', () => {
      // Act
      const result = initWorkspace({ targetDir: tempDir });

      // Assert
      expect(existsSync(result.configPath)).toBe(true);
      expect(result.configPath).toBe(join(tempDir, WORKSPACE_DIR_NAME, CONFIG_FILE_NAME));
    });

    it('should generate valid YAML with version 1', () => {
      // Act
      initWorkspace({ targetDir: tempDir });

      // Assert
      const configPath = join(tempDir, WORKSPACE_DIR_NAME, CONFIG_FILE_NAME);
      const content = readFileSync(configPath, 'utf-8');
      const config = parseYaml(content);

      expect(config.version).toBe(1);
    });

    it('should use directory name as default workspace name', () => {
      // Act
      initWorkspace({ targetDir: tempDir });

      // Assert
      const configPath = join(tempDir, WORKSPACE_DIR_NAME, CONFIG_FILE_NAME);
      const content = readFileSync(configPath, 'utf-8');
      const config = parseYaml(content);

      // tempDir name is dynamic, so just check it's a non-empty string
      expect(typeof config.name).toBe('string');
      expect(config.name.length).toBeGreaterThan(0);
    });

    it('should use custom name when provided', () => {
      // Arrange
      const customName = 'my-api-project';

      // Act
      initWorkspace({ targetDir: tempDir, name: customName });

      // Assert
      const configPath = join(tempDir, WORKSPACE_DIR_NAME, CONFIG_FILE_NAME);
      const content = readFileSync(configPath, 'utf-8');
      const config = parseYaml(content);

      expect(config.name).toBe(customName);
    });

    it('should include baseUrl when provided', () => {
      // Arrange
      const baseUrl = 'https://api.example.com';

      // Act
      initWorkspace({ targetDir: tempDir, baseUrl });

      // Assert
      const configPath = join(tempDir, WORKSPACE_DIR_NAME, CONFIG_FILE_NAME);
      const content = readFileSync(configPath, 'utf-8');
      const config = parseYaml(content);

      expect(config.baseUrl).toBe(baseUrl);
    });

    it('should not include baseUrl when not provided', () => {
      // Act
      initWorkspace({ targetDir: tempDir });

      // Assert
      const configPath = join(tempDir, WORKSPACE_DIR_NAME, CONFIG_FILE_NAME);
      const content = readFileSync(configPath, 'utf-8');
      const config = parseYaml(content);

      expect(config.baseUrl).toBeUndefined();
    });

    it('should create profiles when createProfiles is true', () => {
      // Act
      initWorkspace({ targetDir: tempDir, createProfiles: true });

      // Assert
      const configPath = join(tempDir, WORKSPACE_DIR_NAME, CONFIG_FILE_NAME);
      const content = readFileSync(configPath, 'utf-8');
      const config = parseYaml(content);

      expect(config.profiles).toBeDefined();
      expect(config.profiles.dev).toBeDefined();
      expect(config.profiles.prod).toBeDefined();
      expect(config.activeProfile).toBe('dev');
    });

    it('should not create profiles when createProfiles is false', () => {
      // Act
      initWorkspace({ targetDir: tempDir, createProfiles: false });

      // Assert
      const configPath = join(tempDir, WORKSPACE_DIR_NAME, CONFIG_FILE_NAME);
      const content = readFileSync(configPath, 'utf-8');
      const config = parseYaml(content);

      expect(config.profiles).toBeUndefined();
      expect(config.activeProfile).toBeUndefined();
    });
  });

  describe('when workspace already exists', () => {
    it('should throw error', () => {
      // Arrange
      const workspacePath = join(tempDir, WORKSPACE_DIR_NAME);
      mkdirSync(workspacePath, { recursive: true });

      // Act & Assert
      expect(() => initWorkspace({ targetDir: tempDir })).toThrow(`Workspace already exists at ${workspacePath}`);
    });
  });
});

describe('workspaceHandler', () => {
  let tempDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    isCancelMock.mockReturnValue(false);
    tempDir = createTempDir();
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('workspace init', () => {
    it('should warn when workspace already exists', async () => {
      // Arrange
      const workspacePath = join(tempDir, WORKSPACE_DIR_NAME);
      mkdirSync(workspacePath, { recursive: true });
      const state = createState();

      // Mock process.cwd to return tempDir
      const originalCwd = process.cwd;
      process.cwd = () => tempDir;

      try {
        // Act
        await workspaceHandler(['init'], state);

        // Assert
        expect(consola.warn).toHaveBeenCalledWith(expect.stringContaining('Workspace already exists'));
      } finally {
        process.cwd = originalCwd;
      }
    });

    it('should cancel when user cancels name prompt', async () => {
      // Arrange
      const state = createState();
      isCancelMock.mockReturnValue(true);

      // Mock process.cwd to return tempDir
      const originalCwd = process.cwd;
      process.cwd = () => tempDir;

      try {
        // Act
        await workspaceHandler(['init'], state);

        // Assert
        expect(clack.cancel).toHaveBeenCalledWith('Workspace initialization cancelled.');
      } finally {
        process.cwd = originalCwd;
      }
    });

    it('should create workspace with interactive prompts', async () => {
      // Arrange
      const state = createState();
      (clack.text as Mock).mockResolvedValueOnce('test-api'); // name
      (clack.text as Mock).mockResolvedValueOnce('https://api.test.com'); // baseUrl
      (clack.confirm as Mock).mockResolvedValue(true); // createProfiles

      // Mock process.cwd to return tempDir
      const originalCwd = process.cwd;
      process.cwd = () => tempDir;

      try {
        // Act
        await workspaceHandler(['init'], state);

        // Assert
        expect(consola.success).toHaveBeenCalledWith(expect.stringContaining('Created workspace'));
        expect(existsSync(join(tempDir, WORKSPACE_DIR_NAME))).toBe(true);
      } finally {
        process.cwd = originalCwd;
      }
    });

    it('should create workspace without baseUrl when empty', async () => {
      // Arrange
      const state = createState();
      (clack.text as Mock).mockResolvedValueOnce('test-api'); // name
      (clack.text as Mock).mockResolvedValueOnce(''); // empty baseUrl
      (clack.confirm as Mock).mockResolvedValue(false); // no profiles

      // Mock process.cwd to return tempDir
      const originalCwd = process.cwd;
      process.cwd = () => tempDir;

      try {
        // Act
        await workspaceHandler(['init'], state);

        // Assert
        const configPath = join(tempDir, WORKSPACE_DIR_NAME, CONFIG_FILE_NAME);
        const content = readFileSync(configPath, 'utf-8');
        const config = parseYaml(content);

        expect(config.baseUrl).toBeUndefined();
      } finally {
        process.cwd = originalCwd;
      }
    });
  });

  describe('unknown subcommand', () => {
    it('should show warning for unknown subcommand', async () => {
      // Arrange
      const state = createState();

      // Act
      await workspaceHandler(['unknown'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('Unknown subcommand: unknown');
      expect(consola.info).toHaveBeenCalledWith('Available: workspace init [dir]');
    });
  });
});
