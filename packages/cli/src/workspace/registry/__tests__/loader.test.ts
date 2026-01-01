/**
 * Tests for workspace registry loader
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
  loadRegistry,
  RegistryError,
  removeWorkspace,
  saveRegistry,
  setActiveWorkspace,
} from '../loader.js';

describe('Registry Loader', () => {
  let testDir: string;

  beforeEach(() => {
    // Create temp directory for tests
    testDir = join(tmpdir(), `unireq-registry-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });

    // Mock getGlobalWorkspacePath to use test directory
    vi.spyOn(paths, 'getGlobalWorkspacePath').mockReturnValue(testDir);
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('getRegistryPath', () => {
    it('should return path to workspaces.yaml', () => {
      const path = getRegistryPath();
      expect(path).toBe(join(testDir, 'workspaces.yaml'));
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
      writeFileSync(join(testDir, 'workspaces.yaml'), '', 'utf-8');
      const registry = loadRegistry();
      expect(registry).toEqual({
        version: 1,
        workspaces: {},
      });
    });

    it('should load valid registry', () => {
      const content = `
version: 1
active: my-api
workspaces:
  my-api:
    path: /path/to/my-api/.unireq
    description: My API
  other:
    path: /path/to/other/.unireq
`;
      writeFileSync(join(testDir, 'workspaces.yaml'), content, 'utf-8');

      const registry = loadRegistry();

      expect(registry.version).toBe(1);
      expect(registry.active).toBe('my-api');
      expect(registry.workspaces['my-api']).toEqual({
        path: '/path/to/my-api/.unireq',
        description: 'My API',
      });
      expect(registry.workspaces['other']).toEqual({
        path: '/path/to/other/.unireq',
      });
    });

    it('should throw on invalid YAML syntax', () => {
      writeFileSync(join(testDir, 'workspaces.yaml'), 'invalid: yaml: syntax:', 'utf-8');

      expect(() => loadRegistry()).toThrow(RegistryError);
      expect(() => loadRegistry()).toThrow(/Failed to parse registry YAML/);
    });

    it('should throw on unsupported version', () => {
      const content = `
version: 99
workspaces: {}
`;
      writeFileSync(join(testDir, 'workspaces.yaml'), content, 'utf-8');

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
      writeFileSync(join(testDir, 'workspaces.yaml'), content, 'utf-8');

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
        active: 'test',
        workspaces: {
          test: { path: '/test/path' },
        },
      };

      saveRegistry(config);

      const filePath = join(testDir, 'workspaces.yaml');
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
      expect(existsSync(join(testDir, 'workspaces.yaml'))).toBe(true);
    });

    it('should throw if global path unavailable', () => {
      vi.spyOn(paths, 'getGlobalWorkspacePath').mockReturnValue(null);

      expect(() => saveRegistry(createEmptyRegistry())).toThrow(RegistryError);
      expect(() => saveRegistry(createEmptyRegistry())).toThrow(/Cannot determine registry path/);
    });
  });

  describe('addWorkspace', () => {
    it('should add workspace to empty registry', () => {
      const result = addWorkspace('my-api', '/path/to/api');

      expect(result.workspaces['my-api']).toEqual({
        path: '/path/to/api',
      });
    });

    it('should add workspace with description', () => {
      const result = addWorkspace('my-api', '/path/to/api', 'My API project');

      expect(result.workspaces['my-api']).toEqual({
        path: '/path/to/api',
        description: 'My API project',
      });
    });

    it('should preserve existing workspaces', () => {
      addWorkspace('first', '/path/first');
      const result = addWorkspace('second', '/path/second');

      expect(Object.keys(result.workspaces)).toHaveLength(2);
      expect(result.workspaces['first']).toBeDefined();
      expect(result.workspaces['second']).toBeDefined();
    });

    it('should overwrite existing workspace with same name', () => {
      addWorkspace('api', '/old/path');
      const result = addWorkspace('api', '/new/path');

      expect(result.workspaces['api']?.path).toBe('/new/path');
    });
  });

  describe('removeWorkspace', () => {
    it('should remove existing workspace', () => {
      addWorkspace('to-remove', '/path');

      const removed = removeWorkspace('to-remove');

      expect(removed).toBe(true);
      const registry = loadRegistry();
      expect(registry.workspaces['to-remove']).toBeUndefined();
    });

    it('should return false if workspace not found', () => {
      const removed = removeWorkspace('non-existent');
      expect(removed).toBe(false);
    });

    it('should clear active if removing active workspace', () => {
      addWorkspace('active-one', '/path');
      setActiveWorkspace('active-one');

      removeWorkspace('active-one');

      const registry = loadRegistry();
      expect(registry.active).toBeUndefined();
    });
  });

  describe('setActiveWorkspace', () => {
    it('should set active workspace', () => {
      addWorkspace('my-api', '/path');

      const result = setActiveWorkspace('my-api');

      expect(result).toBe(true);
      const registry = loadRegistry();
      expect(registry.active).toBe('my-api');
    });

    it('should return false if workspace not found', () => {
      const result = setActiveWorkspace('non-existent');
      expect(result).toBe(false);
    });

    it('should clear active when passing undefined', () => {
      addWorkspace('my-api', '/path');
      setActiveWorkspace('my-api');

      const result = setActiveWorkspace(undefined);

      expect(result).toBe(true);
      const registry = loadRegistry();
      expect(registry.active).toBeUndefined();
    });
  });

  describe('getWorkspace', () => {
    it('should return workspace entry', () => {
      addWorkspace('my-api', '/path/to/api', 'Description');

      const entry = getWorkspace('my-api');

      expect(entry).toEqual({
        path: '/path/to/api',
        description: 'Description',
      });
    });

    it('should return undefined for non-existent workspace', () => {
      const entry = getWorkspace('non-existent');
      expect(entry).toBeUndefined();
    });
  });
});
