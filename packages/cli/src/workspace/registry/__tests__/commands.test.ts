/**
 * Tests for workspace registry commands (list, register, unregister, use)
 * Following AAA pattern for unit tests
 *
 * Note: In kubectl model:
 * - activeWorkspace/activeProfile are now in GlobalConfig, not Registry
 * - addWorkspace requires location parameter
 * - listWorkspaces is now listAllWorkspaces in commands.ts
 */

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { consola } from 'consola';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { ReplState } from '../../../repl/state.js';
import { listAllWorkspaces, workspaceHandler } from '../../commands.js';
import * as globalConfig from '../../global-config.js';
import { UNIREQ_HOME_ENV } from '../../paths.js';
import { addWorkspace, loadRegistry } from '../loader.js';

// Create mocks with vi.hoisted
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

// Mock detection to prevent local workspace detection
vi.mock('../../detection.js', () => ({
  findWorkspace: vi.fn(() => undefined),
}));

// Mock config loader to return valid config for test workspaces
vi.mock('../../config/loader.js', () => ({
  loadWorkspaceConfig: vi.fn((_path: string) => {
    // Return a minimal valid config for any path
    return { version: 2, name: 'test-workspace' };
  }),
  CONFIG_FILE_NAME: 'workspace.yaml',
}));

// Import mocked modules
import * as clack from '@clack/prompts';

/**
 * Create minimal REPL state for testing
 */
function createState(): ReplState {
  return {
    currentPath: '/',
    running: true,
    isReplMode: true,
  };
}

describe('Registry Commands', () => {
  let testDir: string;
  let originalUnireqHome: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    isCancelMock.mockReturnValue(false);

    // Save original UNIREQ_HOME value
    originalUnireqHome = process.env[UNIREQ_HOME_ENV];

    // Create temp directory and set UNIREQ_HOME to isolate tests
    testDir = join(tmpdir(), `unireq-registry-cmd-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    process.env[UNIREQ_HOME_ENV] = testDir;

    // Mock GlobalConfig functions
    vi.spyOn(globalConfig, 'getActiveWorkspace').mockReturnValue(undefined);
    vi.spyOn(globalConfig, 'getActiveProfile').mockReturnValue(undefined);
    vi.spyOn(globalConfig, 'getActiveContext').mockReturnValue({ workspace: undefined, profile: undefined });
    vi.spyOn(globalConfig, 'setActiveWorkspace').mockImplementation(() => {});
    vi.spyOn(globalConfig, 'setActiveContext').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original UNIREQ_HOME value
    if (originalUnireqHome === undefined) {
      delete process.env[UNIREQ_HOME_ENV];
    } else {
      process.env[UNIREQ_HOME_ENV] = originalUnireqHome;
    }

    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('listAllWorkspaces', () => {
    describe('when no workspaces exist', () => {
      it('should return empty array', () => {
        // Act
        const result = listAllWorkspaces();

        // Assert
        expect(result).toEqual([]);
      });
    });

    describe('when only registry workspaces exist', () => {
      it('should return registered workspaces', () => {
        // Arrange
        const wsPath = join(testDir, 'my-api');
        mkdirSync(wsPath, { recursive: true });
        addWorkspace('my-api', wsPath, 'local', 'My API');

        // Act
        const result = listAllWorkspaces();

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          name: 'my-api',
          path: wsPath,
          description: 'My API',
          location: 'local',
          exists: true,
        });
      });

      it('should mark missing paths', () => {
        // Arrange
        addWorkspace('missing', '/non/existent/path', 'local');

        // Act
        const result = listAllWorkspaces();

        // Assert
        expect(result[0]?.exists).toBe(false);
      });

      it('should mark active workspace', () => {
        // Arrange
        const wsPath = join(testDir, 'active-ws');
        mkdirSync(wsPath, { recursive: true });
        addWorkspace('active-ws', wsPath, 'local');
        vi.spyOn(globalConfig, 'getActiveWorkspace').mockReturnValue('active-ws');

        // Act
        const result = listAllWorkspaces();

        // Assert
        expect(result[0]?.isActive).toBe(true);
      });
    });

    describe('when multiple workspaces exist', () => {
      it('should return all workspaces', () => {
        // Arrange
        const ws1 = join(testDir, 'ws1');
        const ws2 = join(testDir, 'ws2');
        mkdirSync(ws1, { recursive: true });
        mkdirSync(ws2, { recursive: true });
        addWorkspace('ws1', ws1, 'local', 'Workspace 1');
        addWorkspace('ws2', ws2, 'global', 'Workspace 2');
        vi.spyOn(globalConfig, 'getActiveWorkspace').mockReturnValue('ws1');

        // Act
        const result = listAllWorkspaces();

        // Assert
        expect(result).toHaveLength(2);
        const activeWs = result.find((w) => w.name === 'ws1');
        const inactiveWs = result.find((w) => w.name === 'ws2');
        expect(activeWs?.isActive).toBe(true);
        expect(inactiveWs?.isActive).toBe(false);
      });
    });
  });

  describe('workspace list', () => {
    it('should show message when no workspaces', async () => {
      // Arrange
      const state = createState();

      // Act
      await workspaceHandler(['list'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('No workspaces found.');
    });

    it('should list registered workspaces', async () => {
      // Arrange
      const wsPath = join(testDir, 'my-api');
      mkdirSync(wsPath, { recursive: true });
      addWorkspace('my-api', wsPath, 'local', 'My API');
      const state = createState();

      // Act
      await workspaceHandler(['list'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('Workspaces:');
      expect(consola.info).toHaveBeenCalledWith(expect.stringContaining('my-api'));
    });

    it('should mark active workspace with asterisk', async () => {
      // Arrange
      const wsPath = join(testDir, 'active');
      mkdirSync(wsPath, { recursive: true });
      addWorkspace('active', wsPath, 'local');
      vi.spyOn(globalConfig, 'getActiveWorkspace').mockReturnValue('active');
      const state = createState();

      // Act
      await workspaceHandler(['list'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith(expect.stringMatching(/^\* active/));
    });

    it('should mark missing paths', async () => {
      // Arrange
      addWorkspace('missing', '/does/not/exist', 'local');
      const state = createState();

      // Act
      await workspaceHandler(['list'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith(expect.stringContaining('[missing]'));
    });

    it('should work with "ls" alias', async () => {
      // Arrange
      const state = createState();

      // Act
      await workspaceHandler(['ls'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('No workspaces found.');
    });

    it('should show current context when no subcommand provided', async () => {
      // Arrange
      const state = createState();

      // Act
      await workspaceHandler([], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('No workspace loaded.');
    });
  });

  describe('workspace register', () => {
    it('should register workspace with provided args', async () => {
      // Arrange
      const wsPath = join(testDir, 'new-api');
      mkdirSync(wsPath, { recursive: true });
      (clack.text as Mock).mockResolvedValueOnce(''); // empty description
      const state = createState();

      // Act
      await workspaceHandler(['register', 'new-api', wsPath], state);

      // Assert
      expect(consola.success).toHaveBeenCalledWith(expect.stringContaining('Registered workspace "new-api"'));
      const registry = loadRegistry();
      expect(registry.workspaces['new-api']).toBeDefined();
    });

    it('should warn when path does not exist', async () => {
      // Arrange
      (clack.text as Mock).mockResolvedValueOnce(''); // description
      (clack.confirm as Mock).mockResolvedValue(true); // add anyway
      const state = createState();

      // Act
      await workspaceHandler(['register', 'missing', '/does/not/exist'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith(expect.stringContaining('Path does not exist'));
    });
  });

  describe('workspace use', () => {
    it('should switch to specified workspace', async () => {
      // Arrange
      const wsPath = join(testDir, 'target');
      mkdirSync(wsPath, { recursive: true });
      addWorkspace('target', wsPath, 'local');
      const state = createState();

      // Act
      await workspaceHandler(['use', 'target'], state);

      // Assert
      expect(consola.success).toHaveBeenCalledWith('Switched to workspace "target"');
      expect(globalConfig.setActiveWorkspace).toHaveBeenCalledWith('target');
    });

    it('should error for unknown workspace', async () => {
      // Arrange
      const state = createState();

      // Act
      await workspaceHandler(['use', 'unknown'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('No workspaces found.');
    });

    it('should work with "switch" alias', async () => {
      // Arrange
      const wsPath = join(testDir, 'alias-test');
      mkdirSync(wsPath, { recursive: true });
      addWorkspace('alias-test', wsPath, 'local');
      const state = createState();

      // Act
      await workspaceHandler(['switch', 'alias-test'], state);

      // Assert
      expect(consola.success).toHaveBeenCalledWith('Switched to workspace "alias-test"');
    });

    it('should error when name not provided in REPL mode', async () => {
      // Arrange
      const wsPath = join(testDir, 'prompted');
      mkdirSync(wsPath, { recursive: true });
      addWorkspace('prompted', wsPath, 'local');
      const state = createState();

      // Act
      await workspaceHandler(['use'], state);

      // Assert
      expect(consola.error).toHaveBeenCalledWith('Usage: workspace use <name>');
    });
  });

  describe('workspace unregister', () => {
    it('should remove specified workspace', async () => {
      // Arrange
      const wsPath = join(testDir, 'to-remove');
      mkdirSync(wsPath, { recursive: true });
      addWorkspace('to-remove', wsPath, 'local');
      const state = createState();

      // Act
      await workspaceHandler(['unregister', 'to-remove'], state);

      // Assert
      expect(consola.success).toHaveBeenCalledWith('Unregistered workspace "to-remove"');
      const registry = loadRegistry();
      expect(registry.workspaces['to-remove']).toBeUndefined();
    });

    it('should work with "rm" alias', async () => {
      // Arrange
      addWorkspace('alias-rm', '/path', 'local');
      const state = createState();

      // Act
      await workspaceHandler(['rm', 'alias-rm'], state);

      // Assert
      expect(consola.success).toHaveBeenCalledWith('Unregistered workspace "alias-rm"');
    });

    it('should clear active when removing active workspace', async () => {
      // Arrange
      addWorkspace('active-one', '/path', 'local');
      vi.spyOn(globalConfig, 'getActiveWorkspace').mockReturnValue('active-one');
      const state = createState();

      // Act
      await workspaceHandler(['unregister', 'active-one'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('Active workspace cleared.');
      expect(globalConfig.setActiveContext).toHaveBeenCalledWith(undefined, undefined);
    });

    it('should warn when no workspaces registered', async () => {
      // Arrange
      const state = createState();

      // Act
      await workspaceHandler(['unregister', 'nothing'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('No workspaces registered.');
    });
  });

  describe('unknown subcommand', () => {
    it('should show help for unknown subcommand', async () => {
      // Arrange
      const state = createState();

      // Act
      await workspaceHandler(['unknown'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('Unknown subcommand: unknown');
      expect(consola.info).toHaveBeenCalledWith(
        'Available: workspace [list|register|unregister|use|current|doctor|init]',
      );
    });
  });
});
