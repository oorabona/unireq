/**
 * Tests for workspace registry loader (kubectl-inspired model)
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as paths from '../../paths.js';
import {
  addWorkspace,
  createEmptyRegistry,
  getRegistryPath,
  getWorkspace,
  hasWorkspace,
  listWorkspaces,
  loadRegistry,
  REGISTRY_FILE_NAME,
  RegistryError,
  removeWorkspace,
  saveRegistry,
} from '../loader.js';

describe('Registry Loader', () => {
  let testDir: string;

  beforeEach(() => {
    // Create temp directory for tests
    testDir = join(tmpdir(), `unireq-registry-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });

    // Mock getGlobalWorkspacePath to use test directory
    // Registry is stored in parent of workspaces dir
    vi.spyOn(paths, 'getGlobalWorkspacePath').mockReturnValue(join(testDir, 'workspaces'));
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('getRegistryPath', () => {
    it('should return path to registry.yaml', () => {
      const path = getRegistryPath();
      expect(path).toBe(join(testDir, REGISTRY_FILE_NAME));
    });

    it('should return null if global path unavailable', () => {
      vi.spyOn(paths, 'getGlobalWorkspacePath').mockReturnValue(null);
      expect(getRegistryPath()).toBeNull();
    });
  });

  describe('createEmptyRegistry', () => {
    it('should create empty registry with version 1', () => {
      const registry = createEmptyRegistry();
      expect(registry).toEqual({
        version: 1,
        workspaces: {},
      });
    });
  });

  describe('loadRegistry', () => {
    it('should return empty registry if file does not exist', () => {
      const registry = loadRegistry();
      expect(registry).toEqual({
        version: 1,
        workspaces: {},
      });
    });

    it('should return empty registry if file is empty', () => {
      writeFileSync(join(testDir, REGISTRY_FILE_NAME), '', 'utf-8');
      const registry = loadRegistry();
      expect(registry).toEqual({
        version: 1,
        workspaces: {},
      });
    });

    it('should load valid registry', () => {
      const content = `
version: 1
workspaces:
  my-api:
    path: /path/to/my-api/.unireq
    location: local
    description: My API
  global-one:
    path: ~/.config/unireq/workspaces/global-one
    location: global
`;
      writeFileSync(join(testDir, REGISTRY_FILE_NAME), content, 'utf-8');

      const registry = loadRegistry();

      expect(registry.version).toBe(1);
      expect(registry.workspaces['my-api']).toEqual({
        path: '/path/to/my-api/.unireq',
        location: 'local',
        description: 'My API',
      });
      expect(registry.workspaces['global-one']).toEqual({
        path: '~/.config/unireq/workspaces/global-one',
        location: 'global',
      });
    });

    it('should throw on invalid YAML syntax', () => {
      writeFileSync(join(testDir, REGISTRY_FILE_NAME), 'invalid: yaml: syntax:', 'utf-8');

      expect(() => loadRegistry()).toThrow(RegistryError);
      expect(() => loadRegistry()).toThrow(/Failed to parse registry YAML/);
    });

    it('should throw on unsupported version', () => {
      const content = `
version: 99
workspaces: {}
`;
      writeFileSync(join(testDir, REGISTRY_FILE_NAME), content, 'utf-8');

      expect(() => loadRegistry()).toThrow(RegistryError);
      expect(() => loadRegistry()).toThrow(/Unsupported registry version: 99/);
    });

    it('should throw on schema validation error', () => {
      const content = `
version: 1
workspaces:
  invalid:
    path: 123
`;
      writeFileSync(join(testDir, REGISTRY_FILE_NAME), content, 'utf-8');

      expect(() => loadRegistry()).toThrow(RegistryError);
      expect(() => loadRegistry()).toThrow(/Invalid registry/);
    });

    it('should return empty registry if global path unavailable', () => {
      vi.spyOn(paths, 'getGlobalWorkspacePath').mockReturnValue(null);
      const registry = loadRegistry();
      expect(registry).toEqual({
        version: 1,
        workspaces: {},
      });
    });
  });

  describe('saveRegistry', () => {
    it('should save registry to file', () => {
      const config = {
        version: 1 as const,
        workspaces: {
          test: { path: '/test/path', location: 'local' as const },
        },
      };

      saveRegistry(config);

      const filePath = join(testDir, REGISTRY_FILE_NAME);
      expect(existsSync(filePath)).toBe(true);

      // Verify by loading back
      const loaded = loadRegistry();
      expect(loaded).toEqual(config);
    });

    it('should create directory if it does not exist', () => {
      // Remove the test dir
      rmSync(testDir, { recursive: true, force: true });
      expect(existsSync(testDir)).toBe(false);

      const config = createEmptyRegistry();
      saveRegistry(config);

      expect(existsSync(testDir)).toBe(true);
      expect(existsSync(join(testDir, REGISTRY_FILE_NAME))).toBe(true);
    });

    it('should throw if global path unavailable', () => {
      vi.spyOn(paths, 'getGlobalWorkspacePath').mockReturnValue(null);

      expect(() => saveRegistry(createEmptyRegistry())).toThrow(RegistryError);
      expect(() => saveRegistry(createEmptyRegistry())).toThrow(/Cannot determine registry path/);
    });
  });

  describe('addWorkspace', () => {
    it('should add local workspace to empty registry', () => {
      const result = addWorkspace('my-api', '/path/to/api', 'local');

      expect(result.workspaces['my-api']).toEqual({
        path: '/path/to/api',
        location: 'local',
      });
    });

    it('should add global workspace with description', () => {
      const result = addWorkspace('my-api', '~/.config/unireq/workspaces/my-api', 'global', 'My API project');

      expect(result.workspaces['my-api']).toEqual({
        path: '~/.config/unireq/workspaces/my-api',
        location: 'global',
        description: 'My API project',
      });
    });

    it('should preserve existing workspaces', () => {
      addWorkspace('first', '/path/first', 'local');
      const result = addWorkspace('second', '/path/second', 'local');

      expect(Object.keys(result.workspaces)).toHaveLength(2);
      expect(result.workspaces['first']).toBeDefined();
      expect(result.workspaces['second']).toBeDefined();
    });

    it('should overwrite existing workspace with same name', () => {
      addWorkspace('api', '/old/path', 'local');
      const result = addWorkspace('api', '/new/path', 'global');

      expect(result.workspaces['api']?.path).toBe('/new/path');
      expect(result.workspaces['api']?.location).toBe('global');
    });
  });

  describe('removeWorkspace', () => {
    it('should remove existing workspace', () => {
      addWorkspace('to-remove', '/path', 'local');

      const removed = removeWorkspace('to-remove');

      expect(removed).toBe(true);
      const registry = loadRegistry();
      expect(registry.workspaces['to-remove']).toBeUndefined();
    });

    it('should return false if workspace not found', () => {
      const removed = removeWorkspace('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('getWorkspace', () => {
    it('should return workspace entry', () => {
      addWorkspace('my-api', '/path/to/api', 'local', 'Description');

      const entry = getWorkspace('my-api');

      expect(entry).toEqual({
        path: '/path/to/api',
        location: 'local',
        description: 'Description',
      });
    });

    it('should return undefined for non-existent workspace', () => {
      const entry = getWorkspace('non-existent');
      expect(entry).toBeUndefined();
    });
  });

  describe('hasWorkspace', () => {
    it('should return true for existing workspace', () => {
      addWorkspace('my-api', '/path/to/api', 'local');
      expect(hasWorkspace('my-api')).toBe(true);
    });

    it('should return false for non-existent workspace', () => {
      expect(hasWorkspace('non-existent')).toBe(false);
    });
  });

  describe('listWorkspaces', () => {
    it('should return empty array when no workspaces', () => {
      const list = listWorkspaces();
      expect(list).toEqual([]);
    });

    it('should return all workspaces as tuples', () => {
      addWorkspace('api-one', '/path/one', 'local');
      addWorkspace('api-two', '/path/two', 'global');

      const list = listWorkspaces();

      expect(list).toHaveLength(2);
      expect(list.find(([name]) => name === 'api-one')?.[1]).toEqual({
        path: '/path/one',
        location: 'local',
      });
      expect(list.find(([name]) => name === 'api-two')?.[1]).toEqual({
        path: '/path/two',
        location: 'global',
      });
    });
  });
});
