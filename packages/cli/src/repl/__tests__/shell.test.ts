/**
 * Tests for shell escape and piping
 */

import { describe, expect, it } from 'vitest';
import {
  executeShellCommand,
  extractShellCommand,
  hasPipeOperator,
  isShellEscape,
  pipeToCommand,
  ShellError,
  splitByPipe,
} from '../shell.js';

describe('isShellEscape', () => {
  it('returns true for commands starting with !', () => {
    expect(isShellEscape('!ls')).toBe(true);
    expect(isShellEscape('!echo hello')).toBe(true);
    expect(isShellEscape('!jq .')).toBe(true);
  });

  it('returns true with leading whitespace', () => {
    expect(isShellEscape('  !ls')).toBe(true);
    expect(isShellEscape('\t!echo')).toBe(true);
  });

  it('returns false for regular commands', () => {
    expect(isShellEscape('ls')).toBe(false);
    expect(isShellEscape('get /api')).toBe(false);
    expect(isShellEscape('echo _.status')).toBe(false);
  });

  it('returns false for empty input', () => {
    expect(isShellEscape('')).toBe(false);
    expect(isShellEscape('  ')).toBe(false);
  });
});

describe('extractShellCommand', () => {
  it('extracts command after !', () => {
    expect(extractShellCommand('!ls')).toBe('ls');
    expect(extractShellCommand('!echo hello world')).toBe('echo hello world');
    expect(extractShellCommand('!jq "."')).toBe('jq "."');
  });

  it('handles leading whitespace', () => {
    expect(extractShellCommand('  !ls -la')).toBe('ls -la');
  });

  it('trims whitespace from command', () => {
    expect(extractShellCommand('!  echo test  ')).toBe('echo test');
  });

  it('throws for non-shell-escape input', () => {
    expect(() => extractShellCommand('ls')).toThrow(ShellError);
    expect(() => extractShellCommand('get /api')).toThrow(ShellError);
  });
});

describe('hasPipeOperator', () => {
  it('returns true for input with pipe', () => {
    expect(hasPipeOperator('_.body | jq')).toBe(true);
    expect(hasPipeOperator('echo test | cat')).toBe(true);
    expect(hasPipeOperator('a|b')).toBe(true);
  });

  it('returns false for pipe inside single quotes', () => {
    expect(hasPipeOperator("echo 'a|b'")).toBe(false);
    expect(hasPipeOperator("jq '.foo | .bar'")).toBe(false);
  });

  it('returns false for pipe inside double quotes', () => {
    expect(hasPipeOperator('echo "a|b"')).toBe(false);
    expect(hasPipeOperator('jq ".foo | .bar"')).toBe(false);
  });

  it('returns false for no pipe', () => {
    expect(hasPipeOperator('get /api')).toBe(false);
    expect(hasPipeOperator('echo hello')).toBe(false);
  });

  it('handles mixed quotes', () => {
    expect(hasPipeOperator("echo 'a' | cat")).toBe(true);
    expect(hasPipeOperator('echo "a" | cat')).toBe(true);
  });
});

describe('splitByPipe', () => {
  it('splits on pipe operator', () => {
    expect(splitByPipe('_.body | jq')).toEqual({ left: '_.body', right: 'jq' });
    expect(splitByPipe('a | b | c')).toEqual({ left: 'a', right: 'b | c' });
  });

  it('trims whitespace', () => {
    expect(splitByPipe('  _.body  |  jq "."  ')).toEqual({ left: '_.body', right: 'jq "."' });
  });

  it('ignores pipe inside quotes', () => {
    expect(splitByPipe("jq '.a | .b' | cat")).toEqual({ left: "jq '.a | .b'", right: 'cat' });
    expect(splitByPipe('jq ".a | .b" | cat')).toEqual({ left: 'jq ".a | .b"', right: 'cat' });
  });

  it('returns null when no pipe', () => {
    expect(splitByPipe('get /api')).toBeNull();
    expect(splitByPipe('echo hello')).toBeNull();
  });
});

describe('executeShellCommand', () => {
  it('executes simple command', async () => {
    const result = await executeShellCommand('echo hello');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
    expect(result.stderr).toBe('');
  });

  it('captures stderr', async () => {
    const result = await executeShellCommand('echo error >&2');
    expect(result.exitCode).toBe(0);
    expect(result.stderr.trim()).toBe('error');
  });

  it('returns non-zero exit code on failure', async () => {
    const result = await executeShellCommand('exit 42');
    expect(result.exitCode).toBe(42);
  });

  it('handles command with arguments', async () => {
    const result = await executeShellCommand('echo -n test');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('test');
  });

  it('returns exit code 127 for command not found', async () => {
    // When using shell: true, the shell handles command not found with exit code 127
    const result = await executeShellCommand('nonexistentcommand12345');
    expect(result.exitCode).toBe(127);
    expect(result.stderr).toContain('not found');
  });
});

describe('pipeToCommand', () => {
  it('pipes input to command', async () => {
    const result = await pipeToCommand('hello world', 'cat');
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('hello world');
  });

  it('pipes JSON to jq-like processing', async () => {
    // Use a simple grep instead of jq which may not be installed
    const result = await pipeToCommand('line1\nline2\nline3', 'grep line2');
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('line2');
  });

  it('handles multi-line input', async () => {
    // wc -l counts newlines, so 2 newlines = 2 lines (no trailing newline)
    const input = 'line1\nline2\nline3';
    const result = await pipeToCommand(input, 'wc -l');
    expect(result.exitCode).toBe(0);
    // wc -l returns 2 because there are 2 newline characters
    expect(result.stdout.trim()).toBe('2');
  });

  it('returns non-zero exit code when command fails', async () => {
    const result = await pipeToCommand('no match here', 'grep nonexistent');
    expect(result.exitCode).toBe(1); // grep returns 1 when no match
  });

  it('returns exit code 127 for command not found', async () => {
    // When using shell: true, the shell handles command not found with exit code 127
    const result = await pipeToCommand('test', 'nonexistentcommand12345');
    expect(result.exitCode).toBe(127);
    expect(result.stderr).toContain('not found');
  });
});
