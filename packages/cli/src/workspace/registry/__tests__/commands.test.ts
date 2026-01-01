/**
 * Tests for workspace registry commands (list, add, use, remove)
 * Following AAA pattern for unit tests
 */

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { consola } from 'consola';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { ReplState } from '../../../repl/state.js';
import { listWorkspaces, workspaceHandler } from '../../commands.js';
import * as paths from '../../paths.js';
import { addWorkspace, loadRegistry, setActiveWorkspace } from '../loader.js';

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

// Import mocked modules
import * as clack from '@clack/prompts';

/**
 * Create minimal REPL state for testing
 */
function createState(): ReplState {
  return {
    currentPath: '/',
    running: true,
  };
}

describe('Registry Commands', () => {
  let testDir: string;
  let registryDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    isCancelMock.mockReturnValue(false);

    // Create temp directories
    testDir = join(tmpdir(), `unireq-registry-cmd-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    registryDir = join(testDir, 'registry');
    mkdirSync(registryDir, { recursive: true });

    // Mock getGlobalWorkspacePath to use test directory
    vi.spyOn(paths, 'getGlobalWorkspacePath').mockReturnValue(registryDir);
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('listWorkspaces', () => {
    describe('when no workspaces exist', () => {
      it('should return empty array', () => {
        // Act
        const result = listWorkspaces();

        // Assert
        expect(result).toEqual([]);
      });
    });

    describe('when only registry workspaces exist', () => {
      it('should return registered workspaces', () => {
        // Arrange
        const wsPath = join(testDir, 'my-api');
        mkdirSync(wsPath, { recursive: true });
        addWorkspace('my-api', wsPath, 'My API');

        // Act
        const result = listWorkspaces();

        // Assert
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
          name: 'my-api',
          path: wsPath,
          description: 'My API',
          source: 'registry',
          exists: true,
        });
      });

      it('should mark missing paths', () => {
        // Arrange
        addWorkspace('missing', '/non/existent/path');

        // Act
        const result = listWorkspaces();

        // Assert
        expect(result[0]?.exists).toBe(false);
      });

      it('should mark active workspace', () => {
        // Arrange
        const wsPath = join(testDir, 'active-ws');
        mkdirSync(wsPath, { recursive: true });
        addWorkspace('active-ws', wsPath);
        setActiveWorkspace('active-ws');

        // Act
        const result = listWorkspaces();

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
        addWorkspace('ws1', ws1, 'Workspace 1');
        addWorkspace('ws2', ws2, 'Workspace 2');
        setActiveWorkspace('ws1');

        // Act
        const result = listWorkspaces();

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
      addWorkspace('my-api', wsPath, 'My API');
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
      addWorkspace('active', wsPath);
      setActiveWorkspace('active');
      const state = createState();

      // Act
      await workspaceHandler(['list'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith(expect.stringMatching(/^\* active:/));
    });

    it('should mark missing paths', async () => {
      // Arrange
      addWorkspace('missing', '/does/not/exist');
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

    it('should show list when no subcommand provided', async () => {
      // Arrange
      const state = createState();

      // Act
      await workspaceHandler([], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('No workspaces found.');
    });
  });

  describe('workspace add', () => {
    it('should add workspace with provided args', async () => {
      // Arrange
      const wsPath = join(testDir, 'new-api');
      mkdirSync(wsPath, { recursive: true });
      (clack.text as Mock).mockResolvedValueOnce(''); // empty description
      const state = createState();

      // Act
      await workspaceHandler(['add', 'new-api', wsPath], state);

      // Assert
      expect(consola.success).toHaveBeenCalledWith(expect.stringContaining('Added workspace "new-api"'));
      const registry = loadRegistry();
      expect(registry.workspaces['new-api']).toBeDefined();
    });

    it('should add workspace with description', async () => {
      // Arrange
      const wsPath = join(testDir, 'my-api');
      mkdirSync(wsPath, { recursive: true });
      (clack.text as Mock).mockResolvedValueOnce('My API project');
      const state = createState();

      // Act
      await workspaceHandler(['add', 'my-api', wsPath], state);

      // Assert
      const registry = loadRegistry();
      expect(registry.workspaces['my-api']?.description).toBe('My API project');
    });

    it('should warn when path does not exist', async () => {
      // Arrange
      (clack.text as Mock).mockResolvedValueOnce(''); // description
      (clack.confirm as Mock).mockResolvedValue(true); // add anyway
      const state = createState();

      // Act
      await workspaceHandler(['add', 'missing', '/does/not/exist'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith(expect.stringContaining('Path does not exist'));
    });

    it('should cancel when user declines adding non-existent path', async () => {
      // Arrange
      (clack.confirm as Mock).mockResolvedValue(false);
      const state = createState();

      // Act
      await workspaceHandler(['add', 'missing', '/does/not/exist'], state);

      // Assert
      expect(clack.cancel).toHaveBeenCalledWith('Cancelled.');
    });

    it('should prompt for name when not provided', async () => {
      // Arrange
      const wsPath = join(testDir, 'prompt-api');
      mkdirSync(wsPath, { recursive: true });
      (clack.text as Mock)
        .mockResolvedValueOnce('prompted-name') // name
        .mockResolvedValueOnce(wsPath) // path
        .mockResolvedValueOnce(''); // description
      const state = createState();

      // Act
      await workspaceHandler(['add'], state);

      // Assert
      expect(clack.text).toHaveBeenCalledWith(expect.objectContaining({ message: 'Workspace name:' }));
    });

    it('should confirm before replacing existing workspace', async () => {
      // Arrange
      const wsPath = join(testDir, 'existing');
      mkdirSync(wsPath, { recursive: true });
      addWorkspace('existing', '/old/path');

      (clack.confirm as Mock).mockResolvedValue(true); // replace
      (clack.text as Mock).mockResolvedValueOnce('Updated description');
      const state = createState();

      // Act
      await workspaceHandler(['add', 'existing', wsPath], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith(expect.stringContaining('already exists'));
      expect(clack.confirm).toHaveBeenCalledWith(expect.objectContaining({ message: 'Replace?' }));
    });
  });

  describe('workspace use', () => {
    it('should switch to specified workspace', async () => {
      // Arrange
      const wsPath = join(testDir, 'target');
      mkdirSync(wsPath, { recursive: true });
      addWorkspace('target', wsPath);
      const state = createState();

      // Act
      await workspaceHandler(['use', 'target'], state);

      // Assert
      expect(consola.success).toHaveBeenCalledWith('Switched to workspace "target"');
      const registry = loadRegistry();
      expect(registry.active).toBe('target');
    });

    it('should error for unknown workspace', async () => {
      // Arrange
      const state = createState();

      // Act
      await workspaceHandler(['use', 'unknown'], state);

      // Assert
      expect(consola.warn).toHaveBeenCalledWith('No workspaces registered.');
    });

    it('should work with "switch" alias', async () => {
      // Arrange
      const wsPath = join(testDir, 'alias-test');
      mkdirSync(wsPath, { recursive: true });
      addWorkspace('alias-test', wsPath);
      const state = createState();

      // Act
      await workspaceHandler(['switch', 'alias-test'], state);

      // Assert
      expect(consola.success).toHaveBeenCalledWith('Switched to workspace "alias-test"');
    });

    it('should prompt when name not provided', async () => {
      // Arrange
      const wsPath = join(testDir, 'prompted');
      mkdirSync(wsPath, { recursive: true });
      addWorkspace('prompted', wsPath);
      (clack.text as Mock).mockResolvedValueOnce('prompted');
      const state = createState();

      // Act
      await workspaceHandler(['use'], state);

      // Assert
      expect(clack.text).toHaveBeenCalledWith(expect.objectContaining({ message: 'Switch to workspace:' }));
    });
  });

  describe('workspace remove', () => {
    it('should remove specified workspace', async () => {
      // Arrange
      const wsPath = join(testDir, 'to-remove');
      mkdirSync(wsPath, { recursive: true });
      addWorkspace('to-remove', wsPath);
      (clack.confirm as Mock).mockResolvedValue(true);
      const state = createState();

      // Act
      await workspaceHandler(['remove', 'to-remove'], state);

      // Assert
      expect(consola.success).toHaveBeenCalledWith('Removed workspace "to-remove"');
      const registry = loadRegistry();
      expect(registry.workspaces['to-remove']).toBeUndefined();
    });

    it('should cancel when user declines confirmation', async () => {
      // Arrange
      addWorkspace('keep-me', '/path');
      (clack.confirm as Mock).mockResolvedValue(false);
      const state = createState();

      // Act
      await workspaceHandler(['remove', 'keep-me'], state);

      // Assert
      expect(clack.cancel).toHaveBeenCalledWith('Cancelled.');
      const registry = loadRegistry();
      expect(registry.workspaces['keep-me']).toBeDefined();
    });

    it('should work with "rm" alias', async () => {
      // Arrange
      addWorkspace('alias-rm', '/path');
      (clack.confirm as Mock).mockResolvedValue(true);
      const state = createState();

      // Act
      await workspaceHandler(['rm', 'alias-rm'], state);

      // Assert
      expect(consola.success).toHaveBeenCalledWith('Removed workspace "alias-rm"');
    });

    it('should clear active when removing active workspace', async () => {
      // Arrange
      addWorkspace('active-one', '/path');
      setActiveWorkspace('active-one');
      (clack.confirm as Mock).mockResolvedValue(true);
      const state = createState();

      // Act
      await workspaceHandler(['remove', 'active-one'], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('Active workspace cleared.');
    });

    it('should warn when no workspaces registered', async () => {
      // Arrange
      const state = createState();

      // Act
      await workspaceHandler(['remove', 'nothing'], state);

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
      expect(consola.info).toHaveBeenCalledWith('Available: workspace [list|add|use|remove|doctor|init]');
    });
  });
});
