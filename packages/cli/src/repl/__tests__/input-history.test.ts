/**
 * Tests for InputHistory class
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getHistoryFilePath, InputHistory } from '../input-history.js';

describe('InputHistory', () => {
  let testDir: string;

  beforeEach(() => {
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `input-history-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up temp directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('add', () => {
    it('should add a command to history', () => {
      // Arrange - use explicit historyPath to avoid global history interference
      const history = new InputHistory({ historyPath: join(testDir, 'history') });

      // Act
      history.add('get /users');

      // Assert
      expect(history.getAll()).toEqual(['get /users']);
    });

    it('should trim whitespace from commands', () => {
      // Arrange - use explicit historyPath to avoid global history interference
      const history = new InputHistory({ historyPath: join(testDir, 'history') });

      // Act
      history.add('  get /users  ');

      // Assert
      expect(history.getAll()).toEqual(['get /users']);
    });

    it('should skip empty commands', () => {
      // Arrange - use explicit historyPath to avoid global history interference
      const history = new InputHistory({ historyPath: join(testDir, 'history') });

      // Act
      history.add('');
      history.add('   ');
      history.add('\n');

      // Assert
      expect(history.length).toBe(0);
    });

    it('should skip duplicate of last entry', () => {
      // Arrange - use explicit historyPath to avoid global history interference
      const history = new InputHistory({ historyPath: join(testDir, 'history') });

      // Act
      history.add('get /users');
      history.add('get /users');
      history.add('get /users');

      // Assert
      expect(history.getAll()).toEqual(['get /users']);
    });

    it('should allow same command after different command', () => {
      // Arrange - use explicit historyPath to avoid global history interference
      const history = new InputHistory({ historyPath: join(testDir, 'history') });

      // Act
      history.add('get /users');
      history.add('post /orders');
      history.add('get /users');

      // Assert
      expect(history.getAll()).toEqual(['get /users', 'post /orders', 'get /users']);
    });

    it('should enforce max entries limit', () => {
      // Arrange - use explicit historyPath to avoid global history interference
      const history = new InputHistory({ maxEntries: 3, historyPath: join(testDir, 'history') });

      // Act
      history.add('cmd1');
      history.add('cmd2');
      history.add('cmd3');
      history.add('cmd4');

      // Assert
      expect(history.getAll()).toEqual(['cmd2', 'cmd3', 'cmd4']);
    });
  });

  describe('get', () => {
    it('should return entry at index', () => {
      // Arrange - use explicit historyPath to avoid global history interference
      const history = new InputHistory({ historyPath: join(testDir, 'history') });
      history.add('first');
      history.add('second');
      history.add('third');

      // Act & Assert
      expect(history.get(0)).toBe('first');
      expect(history.get(1)).toBe('second');
      expect(history.get(2)).toBe('third');
    });

    it('should return undefined for out of bounds index', () => {
      // Arrange - use explicit historyPath to avoid global history interference
      const history = new InputHistory({ historyPath: join(testDir, 'history') });
      history.add('only');

      // Act & Assert
      expect(history.get(5)).toBeUndefined();
      expect(history.get(-1)).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return copy of entries', () => {
      // Arrange - use explicit historyPath to avoid global history interference
      const history = new InputHistory({ historyPath: join(testDir, 'history') });
      history.add('cmd1');
      history.add('cmd2');

      // Act
      const entries = history.getAll();
      entries.push('modified');

      // Assert
      expect(history.getAll()).toEqual(['cmd1', 'cmd2']);
    });

    it('should return empty array when no entries', () => {
      // Arrange - use explicit historyPath to avoid global history interference
      const history = new InputHistory({ historyPath: join(testDir, 'history') });

      // Act & Assert
      expect(history.getAll()).toEqual([]);
    });
  });

  describe('length', () => {
    it('should return number of entries', () => {
      // Arrange - use explicit historyPath to avoid global history interference
      const history = new InputHistory({ historyPath: join(testDir, 'history') });

      // Act & Assert
      expect(history.length).toBe(0);
      history.add('cmd1');
      expect(history.length).toBe(1);
      history.add('cmd2');
      expect(history.length).toBe(2);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      // Arrange - use explicit historyPath to avoid global history interference
      const history = new InputHistory({ historyPath: join(testDir, 'history') });
      history.add('cmd1');
      history.add('cmd2');

      // Act
      history.clear();

      // Assert
      expect(history.length).toBe(0);
      expect(history.getAll()).toEqual([]);
    });
  });

  describe('persistence', () => {
    it('should save history to file', () => {
      // Arrange
      const historyPath = join(testDir, '.unireq', 'repl_history');
      const history = new InputHistory({ workspace: testDir });
      history.add('cmd1');
      history.add('cmd2');

      // Act
      history.save();

      // Assert
      expect(existsSync(historyPath)).toBe(true);
      const content = readFileSync(historyPath, 'utf8');
      expect(content).toBe('cmd1\ncmd2\n');
    });

    it('should create directory if not exists', () => {
      // Arrange
      const history = new InputHistory({ workspace: testDir });
      history.add('test');

      // Act
      history.save();

      // Assert
      expect(existsSync(join(testDir, '.unireq'))).toBe(true);
    });

    it('should load history from file', () => {
      // Arrange
      const historyDir = join(testDir, '.unireq');
      mkdirSync(historyDir, { recursive: true });
      writeFileSync(join(historyDir, 'repl_history'), 'cmd1\ncmd2\ncmd3\n', 'utf8');

      // Act
      const history = new InputHistory({ workspace: testDir });

      // Assert
      expect(history.getAll()).toEqual(['cmd1', 'cmd2', 'cmd3']);
    });

    it('should handle empty lines in history file', () => {
      // Arrange
      const historyDir = join(testDir, '.unireq');
      mkdirSync(historyDir, { recursive: true });
      writeFileSync(join(historyDir, 'repl_history'), 'cmd1\n\ncmd2\n\n', 'utf8');

      // Act
      const history = new InputHistory({ workspace: testDir });

      // Assert
      expect(history.getAll()).toEqual(['cmd1', 'cmd2']);
    });

    it('should respect maxEntries when loading', () => {
      // Arrange
      const historyDir = join(testDir, '.unireq');
      mkdirSync(historyDir, { recursive: true });
      writeFileSync(join(historyDir, 'repl_history'), 'cmd1\ncmd2\ncmd3\ncmd4\ncmd5\n', 'utf8');

      // Act
      const history = new InputHistory({ workspace: testDir, maxEntries: 3 });

      // Assert
      expect(history.getAll()).toEqual(['cmd3', 'cmd4', 'cmd5']);
    });

    it('should handle non-existent history file gracefully', () => {
      // Arrange & Act
      const history = new InputHistory({ workspace: testDir });

      // Assert
      expect(history.getAll()).toEqual([]);
    });

    it('should return history path', () => {
      // Arrange
      const history = new InputHistory({ workspace: testDir });

      // Act
      const path = history.getPath();

      // Assert
      expect(path).toBe(join(testDir, '.unireq', 'repl_history'));
    });
  });
});

describe('getHistoryFilePath', () => {
  it('should return workspace path when workspace provided', () => {
    // Arrange
    const workspace = '/home/user/project';

    // Act
    const path = getHistoryFilePath(workspace);

    // Assert
    expect(path).toBe('/home/user/project/.unireq/repl_history');
  });

  it('should return global path when no workspace', () => {
    // Act
    const path = getHistoryFilePath();

    // Assert
    // Should return a path (exact value depends on environment)
    // We just verify it's either null or contains repl_history
    if (path !== null) {
      expect(path).toContain('repl_history');
    }
  });
});
