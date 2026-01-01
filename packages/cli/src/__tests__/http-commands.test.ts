/**
 * Tests for HTTP command handlers
 * Following AAA pattern for unit tests
 */

import { describe, expect, it, vi } from 'vitest';
import { createDefaultRegistry } from '../repl/commands.js';
import { createHttpCommands, createHttpHandler } from '../repl/http-commands.js';

// Mock executeRequest to avoid real HTTP calls
vi.mock('../executor.js', () => ({
  executeRequest: vi.fn().mockResolvedValue(undefined),
}));

describe('createHttpHandler', () => {
  describe('when creating a handler', () => {
    it('should return a function', () => {
      // Arrange & Act
      const handler = createHttpHandler('GET');

      // Assert
      expect(typeof handler).toBe('function');
    });
  });
});

describe('createHttpCommands', () => {
  describe('when creating HTTP commands', () => {
    it('should return 7 commands', () => {
      // Arrange & Act
      const commands = createHttpCommands();

      // Assert
      expect(commands).toHaveLength(7);
    });

    it('should include all HTTP methods', () => {
      // Arrange & Act
      const commands = createHttpCommands();
      const names = commands.map((c) => c.name);

      // Assert
      expect(names).toContain('get');
      expect(names).toContain('post');
      expect(names).toContain('put');
      expect(names).toContain('patch');
      expect(names).toContain('delete');
      expect(names).toContain('head');
      expect(names).toContain('options');
    });

    it('should have descriptions for all commands', () => {
      // Arrange & Act
      const commands = createHttpCommands();

      // Assert
      for (const cmd of commands) {
        expect(cmd.description).toBeTruthy();
        expect(cmd.description).toContain('HTTP');
      }
    });

    it('should have handlers for all commands', () => {
      // Arrange & Act
      const commands = createHttpCommands();

      // Assert
      for (const cmd of commands) {
        expect(typeof cmd.handler).toBe('function');
      }
    });
  });
});

describe('createDefaultRegistry with HTTP commands', () => {
  describe('when creating default registry', () => {
    it('should include HTTP method commands', () => {
      // Arrange & Act
      const registry = createDefaultRegistry();

      // Assert
      expect(registry.has('get')).toBe(true);
      expect(registry.has('post')).toBe(true);
      expect(registry.has('put')).toBe(true);
      expect(registry.has('patch')).toBe(true);
      expect(registry.has('delete')).toBe(true);
      expect(registry.has('head')).toBe(true);
      expect(registry.has('options')).toBe(true);
    });

    it('should still include built-in commands', () => {
      // Arrange & Act
      const registry = createDefaultRegistry();

      // Assert
      expect(registry.has('help')).toBe(true);
      expect(registry.has('exit')).toBe(true);
      expect(registry.has('version')).toBe(true);
    });

    it('should have 21 total commands', () => {
      // Arrange & Act
      const registry = createDefaultRegistry();
      const commands = registry.getAll();

      // Assert
      // 3 built-in (help, exit, version) + 7 HTTP methods + 3 navigation (pwd, cd, ls)
      // + 1 describe + 1 profile + 1 secret + 1 auth + 4 collections (run, save, extract, vars)
      expect(commands).toHaveLength(21);
    });
  });
});
