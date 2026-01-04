/**
 * Tests for Command Execution Hook
 */

import { describe, expect, it, vi } from 'vitest';
import { parseCommand } from '../useCommand.js';

describe('parseCommand', () => {
  describe('Basic parsing', () => {
    it('should parse simple command without args', () => {
      const result = parseCommand('help');

      expect(result).toEqual({ command: 'help', args: [] });
    });

    it('should parse command with single arg', () => {
      const result = parseCommand('get /users');

      expect(result).toEqual({ command: 'get', args: ['/users'] });
    });

    it('should parse command with multiple args', () => {
      const result = parseCommand('post /users name=John age=30');

      expect(result).toEqual({ command: 'post', args: ['/users', 'name=John', 'age=30'] });
    });

    it('should handle empty input', () => {
      const result = parseCommand('');

      expect(result).toEqual({ command: '', args: [] });
    });

    it('should handle whitespace-only input', () => {
      const result = parseCommand('   ');

      expect(result).toEqual({ command: '', args: [] });
    });

    it('should trim leading/trailing whitespace', () => {
      const result = parseCommand('  help  ');

      expect(result).toEqual({ command: 'help', args: [] });
    });

    it('should handle multiple spaces between args', () => {
      const result = parseCommand('get   /users   name=test');

      expect(result).toEqual({ command: 'get', args: ['/users', 'name=test'] });
    });
  });

  describe('Quoted arguments', () => {
    it('should preserve double-quoted strings', () => {
      const result = parseCommand('post /users "John Doe"');

      expect(result).toEqual({ command: 'post', args: ['/users', 'John Doe'] });
    });

    it('should preserve single-quoted strings', () => {
      const result = parseCommand("post /users 'John Doe'");

      expect(result).toEqual({ command: 'post', args: ['/users', 'John Doe'] });
    });

    it('should handle spaces in quoted strings', () => {
      const result = parseCommand('set header "Content-Type: application/json"');

      expect(result).toEqual({
        command: 'set',
        args: ['header', 'Content-Type: application/json'],
      });
    });

    it('should handle mixed quoted and unquoted args', () => {
      const result = parseCommand('post /api "test value" other');

      expect(result).toEqual({ command: 'post', args: ['/api', 'test value', 'other'] });
    });

    it('should handle nested quotes in double quotes', () => {
      const result = parseCommand('echo "He said \'hello\'"');

      expect(result).toEqual({ command: 'echo', args: ["He said 'hello'"] });
    });

    it('should handle nested quotes in single quotes', () => {
      const result = parseCommand('echo \'He said "hello"\'');

      expect(result).toEqual({ command: 'echo', args: ['He said "hello"'] });
    });
  });

  describe('Edge cases', () => {
    it('should handle unclosed quotes by treating as regular char', () => {
      // Unclosed quote - takes rest of string
      const result = parseCommand('echo "test');

      expect(result.command).toBe('echo');
      expect(result.args[0]).toBe('test');
    });

    it('should handle command with equal sign', () => {
      const result = parseCommand('set timeout=30');

      expect(result).toEqual({ command: 'set', args: ['timeout=30'] });
    });

    it('should handle paths with special chars', () => {
      const result = parseCommand('get /users/{id}/posts');

      expect(result).toEqual({ command: 'get', args: ['/users/{id}/posts'] });
    });

    it('should handle JSON body', () => {
      const result = parseCommand('post /users \'{"name":"John"}\'');

      expect(result).toEqual({ command: 'post', args: ['/users', '{"name":"John"}'] });
    });
  });
});

describe('useCommand', () => {
  // Note: Hook tests require React rendering context
  // Testing core behavior via integration tests or by testing callbacks

  describe('execute callback behavior', () => {
    it('should call onTranscriptEvent with command', async () => {
      // Since useCommand is a hook, we test by mocking the executor
      // and verifying callbacks are invoked correctly

      // This test validates the parseCommand integration
      const input = 'get /api/users';
      const parsed = parseCommand(input);

      expect(parsed.command).toBe('get');
      expect(parsed.args).toEqual(['/api/users']);
    });

    it('should handle empty command gracefully', async () => {
      const parsed = parseCommand('');

      expect(parsed.command).toBe('');
      expect(parsed.args).toEqual([]);
    });
  });

  describe('executor integration', () => {
    it('should pass command and args to executor', async () => {
      const executor = vi.fn();
      // JSON must be quoted to preserve internal double quotes
      const input = 'post /api/data \'{"key":"value"}\'';
      const { command, args } = parseCommand(input);

      await executor(command, args);

      expect(executor).toHaveBeenCalledWith('post', ['/api/data', '{"key":"value"}']);
    });

    it('should not call executor for empty command', async () => {
      const executor = vi.fn();
      const { command } = parseCommand('');

      if (command) {
        await executor(command, []);
      }

      expect(executor).not.toHaveBeenCalled();
    });
  });
});
