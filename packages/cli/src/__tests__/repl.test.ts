/**
 * Tests for REPL module
 * Following AAA pattern for unit tests
 */

import { describe, expect, it, vi } from 'vitest';
import type { ReplState } from '../repl/index.js';
import { CommandRegistry, createDefaultRegistry, createReplState, formatPrompt, parseInput } from '../repl/index.js';

describe('createReplState', () => {
  describe('when called without options', () => {
    it('should create state with default path', () => {
      // Arrange & Act
      const state = createReplState();

      // Assert
      expect(state.currentPath).toBe('/');
      expect(state.running).toBe(true);
      expect(state.workspace).toBeUndefined();
    });
  });

  describe('when called with workspace option', () => {
    it('should include workspace in state', () => {
      // Arrange
      const options = { workspace: '/my/project' };

      // Act
      const state = createReplState(options);

      // Assert
      expect(state.workspace).toBe('/my/project');
      expect(state.currentPath).toBe('/');
    });
  });
});

describe('formatPrompt', () => {
  describe('when path is root', () => {
    it('should format prompt with root path', () => {
      // Arrange
      const state: ReplState = { currentPath: '/', running: true };

      // Act
      const prompt = formatPrompt(state);

      // Assert
      expect(prompt).toBe('unireq /> ');
    });
  });

  describe('when path is nested', () => {
    it('should format prompt with nested path', () => {
      // Arrange
      const state: ReplState = { currentPath: '/users/123', running: true };

      // Act
      const prompt = formatPrompt(state);

      // Assert
      expect(prompt).toBe('unireq /users/123> ');
    });
  });
});

describe('parseInput', () => {
  describe('when input is empty', () => {
    it('should return empty command and args', () => {
      // Arrange
      const input = '';

      // Act
      const result = parseInput(input);

      // Assert
      expect(result.command).toBe('');
      expect(result.args).toEqual([]);
    });
  });

  describe('when input is whitespace only', () => {
    it('should return empty command and args', () => {
      // Arrange
      const input = '   ';

      // Act
      const result = parseInput(input);

      // Assert
      expect(result.command).toBe('');
      expect(result.args).toEqual([]);
    });
  });

  describe('when input is single command', () => {
    it('should parse command without args', () => {
      // Arrange
      const input = 'help';

      // Act
      const result = parseInput(input);

      // Assert
      expect(result.command).toBe('help');
      expect(result.args).toEqual([]);
    });
  });

  describe('when input has command with args', () => {
    it('should parse command and arguments', () => {
      // Arrange
      const input = 'get /users 123';

      // Act
      const result = parseInput(input);

      // Assert
      expect(result.command).toBe('get');
      expect(result.args).toEqual(['/users', '123']);
    });
  });

  describe('when input has trailing whitespace', () => {
    it('should trim and parse correctly', () => {
      // Arrange
      const input = '  exit   ';

      // Act
      const result = parseInput(input);

      // Assert
      expect(result.command).toBe('exit');
      expect(result.args).toEqual([]);
    });
  });

  describe('when input has multiple spaces between args', () => {
    it('should handle multiple spaces', () => {
      // Arrange
      const input = 'post   /api   data';

      // Act
      const result = parseInput(input);

      // Assert
      expect(result.command).toBe('post');
      expect(result.args).toEqual(['/api', 'data']);
    });
  });
});

describe('CommandRegistry', () => {
  describe('register', () => {
    it('should register a command', () => {
      // Arrange
      const registry = new CommandRegistry();
      const command = {
        name: 'test',
        description: 'Test command',
        handler: vi.fn(),
      };

      // Act
      registry.register(command);

      // Assert
      expect(registry.has('test')).toBe(true);
    });
  });

  describe('get', () => {
    it('should return registered command', () => {
      // Arrange
      const registry = new CommandRegistry();
      const command = {
        name: 'test',
        description: 'Test command',
        handler: vi.fn(),
      };
      registry.register(command);

      // Act
      const result = registry.get('test');

      // Assert
      expect(result).toBe(command);
    });

    it('should return undefined for unknown command', () => {
      // Arrange
      const registry = new CommandRegistry();

      // Act
      const result = registry.get('unknown');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all registered commands', () => {
      // Arrange
      const registry = new CommandRegistry();
      registry.register({ name: 'a', description: 'A', handler: vi.fn() });
      registry.register({ name: 'b', description: 'B', handler: vi.fn() });

      // Act
      const commands = registry.getAll();

      // Assert
      expect(commands).toHaveLength(2);
      expect(commands.map((c) => c.name)).toContain('a');
      expect(commands.map((c) => c.name)).toContain('b');
    });
  });

  describe('execute', () => {
    it('should execute registered command', async () => {
      // Arrange
      const registry = new CommandRegistry();
      const handler = vi.fn();
      registry.register({ name: 'test', description: 'Test', handler });
      const state: ReplState = { currentPath: '/', running: true };

      // Act
      await registry.execute('test', ['arg1'], state);

      // Assert
      expect(handler).toHaveBeenCalledWith(['arg1'], state);
    });

    it('should throw for unknown command', async () => {
      // Arrange
      const registry = new CommandRegistry();
      const state: ReplState = { currentPath: '/', running: true };

      // Act & Assert
      await expect(registry.execute('unknown', [], state)).rejects.toThrow(
        "Unknown command: unknown. Type 'help' for available commands.",
      );
    });
  });
});

describe('createDefaultRegistry', () => {
  it('should include help command', () => {
    // Arrange & Act
    const registry = createDefaultRegistry();

    // Assert
    expect(registry.has('help')).toBe(true);
  });

  it('should include exit command', () => {
    // Arrange & Act
    const registry = createDefaultRegistry();

    // Assert
    expect(registry.has('exit')).toBe(true);
  });

  it('should include version command', () => {
    // Arrange & Act
    const registry = createDefaultRegistry();

    // Assert
    expect(registry.has('version')).toBe(true);
  });
});

describe('exit command handler', () => {
  it('should set running to false', async () => {
    // Arrange
    const registry = createDefaultRegistry();
    const state: ReplState = { currentPath: '/', running: true };

    // Act
    await registry.execute('exit', [], state);

    // Assert
    expect(state.running).toBe(false);
  });
});
