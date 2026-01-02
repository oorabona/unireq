/**
 * Tests for custom REPL eval function
 */

import { describe, expect, it, vi } from 'vitest';
import { CommandRegistry } from '../commands.js';
import { createEval, isIncompleteJson, MultilineBuffer, MultilineIncomplete } from '../eval.js';
import { createReplState } from '../state.js';

describe('isIncompleteJson', () => {
  describe('complete JSON', () => {
    it('should return false for complete object', () => {
      expect(isIncompleteJson('{"name": "Alice"}')).toBe(false);
    });

    it('should return false for complete array', () => {
      expect(isIncompleteJson('[1, 2, 3]')).toBe(false);
    });

    it('should return false for nested complete JSON', () => {
      expect(isIncompleteJson('{"data": {"items": [1, 2]}}')).toBe(false);
    });

    it('should return false for no JSON', () => {
      expect(isIncompleteJson('get /users')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isIncompleteJson('')).toBe(false);
    });
  });

  describe('incomplete JSON', () => {
    it('should return true for unclosed object', () => {
      expect(isIncompleteJson('{"name": "Alice"')).toBe(true);
    });

    it('should return true for unclosed array', () => {
      expect(isIncompleteJson('[1, 2, 3')).toBe(true);
    });

    it('should return true for just opening brace', () => {
      expect(isIncompleteJson('{')).toBe(true);
    });

    it('should return true for just opening bracket', () => {
      expect(isIncompleteJson('[')).toBe(true);
    });

    it('should return true for nested incomplete', () => {
      expect(isIncompleteJson('{"data": {"items": [1, 2]}')).toBe(true);
    });

    it('should return true for command with incomplete JSON body', () => {
      expect(isIncompleteJson('post /users {"name": "Alice"')).toBe(true);
    });
  });

  describe('string handling', () => {
    it('should ignore braces inside strings', () => {
      expect(isIncompleteJson('{"text": "some { brace }"}')).toBe(false);
    });

    it('should handle escaped quotes', () => {
      expect(isIncompleteJson('{"text": "say \\"hello\\""}')).toBe(false);
    });

    it('should handle incomplete with brace in string', () => {
      expect(isIncompleteJson('{"text": "some { brace"')).toBe(true);
    });
  });
});

describe('MultilineBuffer', () => {
  it('should accumulate lines', () => {
    // Arrange
    const buffer = new MultilineBuffer();

    // Act
    buffer.addLine('{');
    buffer.addLine('"name": "Alice"');
    buffer.addLine('}');

    // Assert
    expect(buffer.getInput()).toBe('{\n"name": "Alice"\n}');
  });

  it('should return false for incomplete JSON', () => {
    // Arrange
    const buffer = new MultilineBuffer();

    // Act & Assert
    expect(buffer.addLine('{')).toBe(false);
    expect(buffer.addLine('"name": "Alice"')).toBe(false);
  });

  it('should return true when JSON is complete', () => {
    // Arrange
    const buffer = new MultilineBuffer();

    // Act
    buffer.addLine('{');
    const result = buffer.addLine('}');

    // Assert
    expect(result).toBe(true);
  });

  it('should clear buffer', () => {
    // Arrange
    const buffer = new MultilineBuffer();
    buffer.addLine('{');

    // Act
    buffer.clear();

    // Assert
    expect(buffer.isEmpty()).toBe(true);
    expect(buffer.getInput()).toBe('');
  });

  it('should report empty correctly', () => {
    // Arrange
    const buffer = new MultilineBuffer();

    // Act & Assert
    expect(buffer.isEmpty()).toBe(true);
    buffer.addLine('test');
    expect(buffer.isEmpty()).toBe(false);
  });
});

describe('createEval', () => {
  it('should execute command through registry', async () => {
    // Arrange
    const registry = new CommandRegistry();
    const handler = vi.fn().mockResolvedValue(undefined);
    registry.register({ name: 'test', description: 'Test command', handler });

    const state = createReplState();
    const evalFn = createEval(registry, state);

    // Act
    await new Promise<void>((resolve) => {
      evalFn('test arg1 arg2', {}, '', (err) => {
        expect(err).toBeNull();
        resolve();
      });
    });

    // Assert
    expect(handler).toHaveBeenCalledWith(['arg1', 'arg2'], state);
  });

  it('should handle empty input', async () => {
    // Arrange
    const registry = new CommandRegistry();
    const state = createReplState();
    const evalFn = createEval(registry, state);

    // Act
    await new Promise<void>((resolve) => {
      evalFn('', {}, '', (err, result) => {
        expect(err).toBeNull();
        expect(result).toBeUndefined();
        resolve();
      });
    });
  });

  it('should handle whitespace-only input', async () => {
    // Arrange
    const registry = new CommandRegistry();
    const state = createReplState();
    const evalFn = createEval(registry, state);

    // Act
    await new Promise<void>((resolve) => {
      evalFn('   \n  ', {}, '', (err, result) => {
        expect(err).toBeNull();
        expect(result).toBeUndefined();
        resolve();
      });
    });
  });

  it('should return Recoverable for incomplete JSON', async () => {
    // Arrange
    const registry = new CommandRegistry();
    const state = createReplState();
    const evalFn = createEval(registry, state);

    // Act & Assert
    await new Promise<void>((resolve) => {
      evalFn('post /users {', {}, '', (err) => {
        expect(err).toBeInstanceOf(Error);
        // Recoverable extends SyntaxError, and wraps our MultilineIncomplete
        // The wrapped error is accessible via err.err
        expect((err as unknown as { err: Error }).err).toBeInstanceOf(MultilineIncomplete);
        resolve();
      });
    });
  });

  it('should handle command errors gracefully', async () => {
    // Arrange
    const registry = new CommandRegistry();
    const handler = vi.fn().mockRejectedValue(new Error('Command failed'));
    registry.register({ name: 'fail', description: 'Failing command', handler });

    const state = createReplState();
    const evalFn = createEval(registry, state);

    // Act & Assert
    await new Promise<void>((resolve) => {
      evalFn('fail', {}, '', (err, result) => {
        // Error is logged but not passed to callback
        expect(err).toBeNull();
        expect(result).toBeUndefined();
        resolve();
      });
    });
  });

  it('should handle unknown command', async () => {
    // Arrange
    const registry = new CommandRegistry();
    const state = createReplState();
    const evalFn = createEval(registry, state);

    // Act & Assert
    await new Promise<void>((resolve) => {
      evalFn('unknowncommand', {}, '', (err, result) => {
        // Unknown command throws, caught and returned as null err
        expect(err).toBeNull();
        expect(result).toBeUndefined();
        resolve();
      });
    });
  });
});

describe('MultilineIncomplete', () => {
  it('should have correct name', () => {
    const error = new MultilineIncomplete();
    expect(error.name).toBe('MultilineIncomplete');
  });

  it('should have default message', () => {
    const error = new MultilineIncomplete();
    expect(error.message).toBe('Incomplete input');
  });

  it('should accept custom message', () => {
    const error = new MultilineIncomplete('Custom message');
    expect(error.message).toBe('Custom message');
  });
});
