/**
 * Tests for navigation commands (cd, ls, pwd)
 * Following AAA pattern for unit tests
 */

import { describe, expect, it, vi } from 'vitest';
import { cdHandler, createNavigationCommands, lsHandler, pwdHandler } from '../repl/navigation.js';
import type { ReplState } from '../repl/state.js';

// Mock consola to capture output
vi.mock('consola', () => ({
  consola: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { consola } from 'consola';

describe('pwdHandler', () => {
  describe('when displaying current path', () => {
    it('should output the current path', async () => {
      // Arrange
      const state: ReplState = { currentPath: '/api/users', running: true };
      vi.mocked(consola.info).mockClear();

      // Act
      await pwdHandler([], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('/api/users');
    });

    it('should output root path', async () => {
      // Arrange
      const state: ReplState = { currentPath: '/', running: true };
      vi.mocked(consola.info).mockClear();

      // Act
      await pwdHandler([], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('/');
    });
  });
});

describe('cdHandler', () => {
  describe('when navigating with absolute paths', () => {
    it('should navigate to absolute path', async () => {
      // Arrange
      const state: ReplState = { currentPath: '/', running: true };

      // Act
      await cdHandler(['/api/users'], state);

      // Assert
      expect(state.currentPath).toBe('/api/users');
    });

    it('should navigate to root with /', async () => {
      // Arrange
      const state: ReplState = { currentPath: '/api/users', running: true };

      // Act
      await cdHandler(['/'], state);

      // Assert
      expect(state.currentPath).toBe('/');
    });
  });

  describe('when navigating with relative paths', () => {
    it('should navigate to relative path', async () => {
      // Arrange
      const state: ReplState = { currentPath: '/api', running: true };

      // Act
      await cdHandler(['users'], state);

      // Assert
      expect(state.currentPath).toBe('/api/users');
    });

    it('should navigate to nested relative path', async () => {
      // Arrange
      const state: ReplState = { currentPath: '/api', running: true };

      // Act
      await cdHandler(['users/admins'], state);

      // Assert
      expect(state.currentPath).toBe('/api/users/admins');
    });
  });

  describe('when navigating with parent paths', () => {
    it('should navigate to parent with ..', async () => {
      // Arrange
      const state: ReplState = { currentPath: '/api/users', running: true };

      // Act
      await cdHandler(['..'], state);

      // Assert
      expect(state.currentPath).toBe('/api');
    });

    it('should navigate up multiple levels', async () => {
      // Arrange
      const state: ReplState = { currentPath: '/api/users/admins', running: true };

      // Act
      await cdHandler(['../..'], state);

      // Assert
      expect(state.currentPath).toBe('/api');
    });

    it('should stay at root when at root', async () => {
      // Arrange
      const state: ReplState = { currentPath: '/', running: true };

      // Act
      await cdHandler(['..'], state);

      // Assert
      expect(state.currentPath).toBe('/');
    });
  });

  describe('when navigating without argument', () => {
    it('should navigate to root', async () => {
      // Arrange
      const state: ReplState = { currentPath: '/api/users', running: true };

      // Act
      await cdHandler([], state);

      // Assert
      expect(state.currentPath).toBe('/');
    });
  });

  describe('when normalizing paths', () => {
    it('should normalize complex path', async () => {
      // Arrange
      const state: ReplState = { currentPath: '/', running: true };

      // Act
      await cdHandler(['/api//users/../admins/'], state);

      // Assert
      expect(state.currentPath).toBe('/api/admins');
    });
  });
});

describe('lsHandler', () => {
  describe('when listing without OpenAPI', () => {
    it('should display placeholder message', async () => {
      // Arrange
      const state: ReplState = { currentPath: '/api', running: true };
      vi.mocked(consola.info).mockClear();
      vi.mocked(consola.warn).mockClear();

      // Act
      await lsHandler([], state);

      // Assert
      expect(consola.info).toHaveBeenCalledWith('Current path: /api');
      expect(consola.warn).toHaveBeenCalledWith('No OpenAPI spec loaded.');
      expect(consola.info).toHaveBeenCalledWith('Load a spec with: import <url-or-file>');
    });
  });
});

describe('createNavigationCommands', () => {
  describe('when creating navigation commands', () => {
    it('should return 3 commands', () => {
      // Arrange & Act
      const commands = createNavigationCommands();

      // Assert
      expect(commands).toHaveLength(3);
    });

    it('should include pwd, cd, ls commands', () => {
      // Arrange & Act
      const commands = createNavigationCommands();
      const names = commands.map((c) => c.name);

      // Assert
      expect(names).toContain('pwd');
      expect(names).toContain('cd');
      expect(names).toContain('ls');
    });

    it('should have descriptions for all commands', () => {
      // Arrange & Act
      const commands = createNavigationCommands();

      // Assert
      for (const cmd of commands) {
        expect(cmd.description).toBeTruthy();
      }
    });

    it('should have handlers for all commands', () => {
      // Arrange & Act
      const commands = createNavigationCommands();

      // Assert
      for (const cmd of commands) {
        expect(typeof cmd.handler).toBe('function');
      }
    });
  });
});
