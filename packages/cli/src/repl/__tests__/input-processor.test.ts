/**
 * Tests for input processor (shell escape and piping)
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { consola } from 'consola';
import type { ReplState } from '../state.js';
import { isSpecialSyntax, processSpecialInput } from '../input-processor.js';

// Mock consola
vi.mock('consola', () => ({
  consola: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('isSpecialSyntax', () => {
  it('returns true for shell escape', () => {
    expect(isSpecialSyntax('!ls')).toBe(true);
    expect(isSpecialSyntax('!echo hello')).toBe(true);
    expect(isSpecialSyntax('  !cmd')).toBe(true);
  });

  it('returns true for pipe operator', () => {
    expect(isSpecialSyntax('_.body | jq')).toBe(true);
    expect(isSpecialSyntax('echo test | cat')).toBe(true);
  });

  it('returns true for bare underscore expressions', () => {
    expect(isSpecialSyntax('_.status')).toBe(true);
    expect(isSpecialSyntax('_.body')).toBe(true);
    expect(isSpecialSyntax('_.headers')).toBe(true);
    expect(isSpecialSyntax('_.body.data[0].name')).toBe(true);
    expect(isSpecialSyntax('_')).toBe(true);
  });

  it('returns false for regular commands', () => {
    expect(isSpecialSyntax('get /api')).toBe(false);
    expect(isSpecialSyntax('echo _.status')).toBe(false);
    expect(isSpecialSyntax('set x = _.body')).toBe(false);
  });

  it('returns false for pipe inside quotes', () => {
    expect(isSpecialSyntax("jq '.a | .b'")).toBe(false);
    expect(isSpecialSyntax('echo "a|b"')).toBe(false);
  });
});

describe('processSpecialInput', () => {
  let state: ReplState;

  beforeEach(() => {
    vi.clearAllMocks();
    state = {
      currentPath: '/',
      running: true,
      lastResponseStatus: 200,
      lastResponseBody: JSON.stringify({ name: 'Alice', items: [1, 2, 3] }),
      extractedVars: {
        token: 'my-token',
      },
    };
  });

  describe('shell escape (!cmd)', () => {
    it('executes shell command and returns output', async () => {
      const result = await processSpecialInput('!echo hello', state);
      expect(result.handled).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.output?.trim()).toBe('hello');
      expect(consola.log).toHaveBeenCalled();
    });

    it('handles command with arguments', async () => {
      const result = await processSpecialInput('!echo -n test', state);
      expect(result.handled).toBe(true);
      expect(result.output).toBe('test');
    });

    it('captures stderr', async () => {
      const result = await processSpecialInput('!echo error >&2', state);
      expect(result.handled).toBe(true);
      expect(result.error?.trim()).toBe('error');
      expect(consola.warn).toHaveBeenCalled();
    });

    it('reports non-zero exit code', async () => {
      const result = await processSpecialInput('!exit 42', state);
      expect(result.handled).toBe(true);
      expect(result.exitCode).toBe(42);
      expect(consola.error).toHaveBeenCalledWith('Command exited with code 42');
    });
  });

  describe('pipe (expr | cmd)', () => {
    it('pipes _.body to command', async () => {
      const result = await processSpecialInput('_.body | cat', state);
      expect(result.handled).toBe(true);
      expect(result.exitCode).toBe(0);
      // Output should be the JSON body
      expect(result.output).toContain('Alice');
    });

    it('pipes _.status to command', async () => {
      const result = await processSpecialInput('_.status | cat', state);
      expect(result.handled).toBe(true);
      expect(result.output?.trim()).toBe('200');
    });

    it('pipes variable to command', async () => {
      const result = await processSpecialInput('$token | cat', state);
      expect(result.handled).toBe(true);
      expect(result.output?.trim()).toBe('my-token');
    });

    it('handles grep command', async () => {
      const result = await processSpecialInput('_.body | grep Alice', state);
      expect(result.handled).toBe(true);
      expect(result.output).toContain('Alice');
    });

    it('shows error when variable not found', async () => {
      const result = await processSpecialInput('$unknown | cat', state);
      expect(result.handled).toBe(true);
      expect(consola.error).toHaveBeenCalledWith('Variable not found: unknown');
    });

    it('shows error when no response available', async () => {
      const emptyState: ReplState = {
        currentPath: '/',
        running: true,
      };
      const result = await processSpecialInput('_.body | cat', emptyState);
      expect(result.handled).toBe(true);
      expect(consola.error).toHaveBeenCalled();
    });
  });

  describe('bare underscore expressions', () => {
    it('displays _.status directly', async () => {
      const result = await processSpecialInput('_.status', state);
      expect(result.handled).toBe(true);
      expect(result.output).toBe('200');
      expect(consola.log).toHaveBeenCalledWith('200');
    });

    it('displays _.body directly', async () => {
      const result = await processSpecialInput('_.body', state);
      expect(result.handled).toBe(true);
      expect(result.output).toContain('Alice');
      expect(consola.log).toHaveBeenCalled();
    });

    it('displays _.body.name directly', async () => {
      const result = await processSpecialInput('_.body.name', state);
      expect(result.handled).toBe(true);
      expect(result.output).toBe('Alice');
    });

    it('displays full response with _', async () => {
      const result = await processSpecialInput('_', state);
      expect(result.handled).toBe(true);
      expect(result.output).toContain('200');
    });

    it('shows error when no response available', async () => {
      const emptyState: ReplState = {
        currentPath: '/',
        running: true,
      };
      const result = await processSpecialInput('_.status', emptyState);
      expect(result.handled).toBe(true);
      expect(result.error).toContain('No response available');
      expect(consola.error).toHaveBeenCalled();
    });

    it('shows error for invalid path', async () => {
      const result = await processSpecialInput('_.unknown', state);
      expect(result.handled).toBe(true);
      expect(consola.error).toHaveBeenCalled();
    });
  });

  describe('regular commands (not special)', () => {
    it('returns handled: false for regular commands', async () => {
      const result = await processSpecialInput('get /api', state);
      expect(result.handled).toBe(false);
    });

    it('returns handled: false for echo command', async () => {
      const result = await processSpecialInput('echo _.status', state);
      expect(result.handled).toBe(false);
    });

    it('returns handled: false for set command', async () => {
      const result = await processSpecialInput('set x = _.body', state);
      expect(result.handled).toBe(false);
    });
  });
});
