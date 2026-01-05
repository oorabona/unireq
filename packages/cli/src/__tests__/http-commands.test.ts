/**
 * Tests for HTTP command handlers
 * Following AAA pattern for unit tests
 *
 * Also covers URL resolution integration (BDD scenarios S-3 to S-8)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRegistry } from '../repl/commands.js';
import { createHttpCommands, createHttpHandler } from '../repl/http-commands.js';
import type { ReplState } from '../repl/state.js';

// Mock consola to suppress error output during tests
vi.mock('consola', () => ({
  consola: {
    error: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
  },
}));

// Mock executeRequest - use vi.hoisted to create the mock function
const { mockExecuteRequest } = vi.hoisted(() => ({
  mockExecuteRequest: vi.fn().mockResolvedValue({ status: 200 }),
}));

vi.mock('../executor.js', () => ({
  executeRequest: mockExecuteRequest,
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

    it('should have 25 total commands', () => {
      // Arrange & Act
      const registry = createDefaultRegistry();
      const commands = registry.getAll();

      // Assert
      // 3 built-in (help, exit, version) + 7 HTTP methods + 3 navigation (pwd, cd, ls)
      // + 1 describe + 1 import + 1 workspace + 1 profile + 1 defaults + 1 secret + 1 auth + 5 collections (run, save, extract, vars, history)
      expect(commands).toHaveLength(25);
    });
  });
});

describe('HTTP command URL resolution', () => {
  /**
   * Helper to create a minimal ReplState for testing
   */
  function createTestState(overrides: Partial<ReplState> = {}): ReplState {
    return {
      currentPath: '/',
      running: true,
      ...overrides,
    };
  }

  beforeEach(() => {
    mockExecuteRequest.mockClear();
  });

  describe('S-3: Implicit URL (no input)', () => {
    it('should use baseUrl + currentPath when no URL provided', async () => {
      // Arrange
      const handler = createHttpHandler('GET');
      const state = createTestState({
        currentPath: '/users',
        activeProfile: 'prod',
        workspaceConfig: {
          version: 2,
          name: 'my-api',
          profiles: {
            prod: { baseUrl: 'https://api.example.com' },
          },
        },
      });

      // Act
      await handler([], state);

      // Assert
      expect(mockExecuteRequest).toHaveBeenCalled();
      const request = mockExecuteRequest.mock.calls[0]?.[0];
      expect(request?.url).toBe('https://api.example.com/users');
    });
  });

  describe('S-4: Relative segment', () => {
    it('should append segment to currentPath', async () => {
      // Arrange
      const handler = createHttpHandler('GET');
      const state = createTestState({
        currentPath: '/users',
        activeProfile: 'prod',
        workspaceConfig: {
          version: 2,
          name: 'my-api',
          profiles: {
            prod: { baseUrl: 'https://api.example.com' },
          },
        },
      });

      // Act
      await handler(['123'], state);

      // Assert
      expect(mockExecuteRequest).toHaveBeenCalled();
      const request = mockExecuteRequest.mock.calls[0]?.[0];
      expect(request?.url).toBe('https://api.example.com/users/123');
    });
  });

  describe('S-5: Absolute path', () => {
    it('should replace currentPath with absolute path', async () => {
      // Arrange
      const handler = createHttpHandler('GET');
      const state = createTestState({
        currentPath: '/users',
        activeProfile: 'prod',
        workspaceConfig: {
          version: 2,
          name: 'my-api',
          profiles: {
            prod: { baseUrl: 'https://api.example.com' },
          },
        },
      });

      // Act
      await handler(['/orders'], state);

      // Assert
      expect(mockExecuteRequest).toHaveBeenCalled();
      const request = mockExecuteRequest.mock.calls[0]?.[0];
      expect(request?.url).toBe('https://api.example.com/orders');
    });
  });

  describe('S-6: Explicit URL', () => {
    it('should use explicit URL as-is, ignoring baseUrl', async () => {
      // Arrange
      const handler = createHttpHandler('GET');
      const state = createTestState({
        currentPath: '/users',
        activeProfile: 'prod',
        workspaceConfig: {
          version: 2,
          name: 'my-api',
          profiles: {
            prod: { baseUrl: 'https://api.example.com' },
          },
        },
      });

      // Act
      await handler(['https://other.com/foo'], state);

      // Assert
      expect(mockExecuteRequest).toHaveBeenCalled();
      const request = mockExecuteRequest.mock.calls[0]?.[0];
      expect(request?.url).toBe('https://other.com/foo');
    });
  });

  describe('S-7: Error when no URL and no baseUrl', () => {
    it('should not call executeRequest when no baseUrl and no input', async () => {
      // Arrange
      const handler = createHttpHandler('GET');
      const state = createTestState({
        currentPath: '/users',
        // No activeProfile, no workspaceConfig
      });

      // Act
      await handler([], state);

      // Assert - executeRequest should NOT be called
      expect(mockExecuteRequest).not.toHaveBeenCalled();
    });
  });

  describe('S-8: Error when relative path and no baseUrl', () => {
    it('should not call executeRequest for relative path without baseUrl', async () => {
      // Arrange
      const handler = createHttpHandler('GET');
      const state = createTestState({
        currentPath: '/users',
        // No activeProfile, no workspaceConfig
      });

      // Act
      await handler(['/orders'], state);

      // Assert - executeRequest should NOT be called
      expect(mockExecuteRequest).not.toHaveBeenCalled();
    });
  });

  describe('Options preservation', () => {
    it('should preserve options when using implicit URL', async () => {
      // Arrange
      const handler = createHttpHandler('GET');
      const state = createTestState({
        currentPath: '/users',
        activeProfile: 'prod',
        workspaceConfig: {
          version: 2,
          name: 'my-api',
          profiles: {
            prod: { baseUrl: 'https://api.example.com' },
          },
        },
      });

      // Act
      await handler(['-i', '-S'], state);

      // Assert
      expect(mockExecuteRequest).toHaveBeenCalled();
      const request = mockExecuteRequest.mock.calls[0]?.[0];
      expect(request?.url).toBe('https://api.example.com/users');
      expect(request?.includeHeaders).toBe(true);
      expect(request?.showSummary).toBe(true);
    });

    it('should preserve options when using explicit URL', async () => {
      // Arrange
      const handler = createHttpHandler('POST');
      const state = createTestState({
        currentPath: '/',
      });

      // Act
      await handler(['https://api.example.com/users', '-H', 'Content-Type:application/json'], state);

      // Assert
      expect(mockExecuteRequest).toHaveBeenCalled();
      const request = mockExecuteRequest.mock.calls[0]?.[0];
      expect(request?.url).toBe('https://api.example.com/users');
      expect(request?.headers).toContain('Content-Type:application/json');
    });
  });
});
