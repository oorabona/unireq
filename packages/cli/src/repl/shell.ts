/**
 * Shell escape and piping support
 *
 * Provides:
 * - `!cmd args` - Shell escape (spawn external command)
 * - `expr | cmd` - Pipe expression result to external command
 */

import { spawn } from 'node:child_process';

/**
 * Result of executing a shell command
 */
export interface ShellResult {
  /** Exit code (0 = success) */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
}

/**
 * Error thrown when shell command fails to execute
 */
export class ShellError extends Error {
  readonly command: string;
  readonly exitCode?: number;

  constructor(message: string, command: string, exitCode?: number) {
    super(message);
    this.name = 'ShellError';
    this.command = command;
    this.exitCode = exitCode;
    Object.setPrototypeOf(this, ShellError.prototype);
  }
}

/**
 * Check if input starts with shell escape prefix
 */
export function isShellEscape(input: string): boolean {
  return input.trimStart().startsWith('!');
}

/**
 * Check if input contains a pipe operator (not inside quotes)
 */
export function hasPipeOperator(input: string): boolean {
  // Simple check - look for | not inside quotes
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const prevChar = i > 0 ? input[i - 1] : '';

    // Skip escaped characters
    if (prevChar === '\\') {
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === '|' && !inSingleQuote && !inDoubleQuote) {
      return true;
    }
  }

  return false;
}

/**
 * Split input by pipe operator (respecting quotes)
 */
export function splitByPipe(input: string): { left: string; right: string } | null {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const prevChar = i > 0 ? input[i - 1] : '';

    // Skip escaped characters
    if (prevChar === '\\') {
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === '|' && !inSingleQuote && !inDoubleQuote) {
      return {
        left: input.slice(0, i).trim(),
        right: input.slice(i + 1).trim(),
      };
    }
  }

  return null;
}

/**
 * Execute a shell command without stdin
 *
 * @param command - Full command string (will be executed via shell)
 * @returns Promise resolving to ShellResult
 * @throws ShellError if command cannot be executed
 */
export function executeShellCommand(command: string): Promise<ShellResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '1' },
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new ShellError(`Command not found: ${command.split(' ')[0]}`, command));
      } else {
        reject(new ShellError(`Failed to execute: ${error.message}`, command));
      }
    });

    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 0,
        stdout,
        stderr,
      });
    });
  });
}

/**
 * Execute a shell command with stdin input
 *
 * @param input - Data to pipe to stdin
 * @param command - Shell command to execute
 * @returns Promise resolving to ShellResult
 * @throws ShellError if command cannot be executed
 */
export function pipeToCommand(input: string, command: string): Promise<ShellResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '1' },
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new ShellError(`Command not found: ${command.split(' ')[0]}`, command));
      } else {
        reject(new ShellError(`Failed to execute: ${error.message}`, command));
      }
    });

    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 0,
        stdout,
        stderr,
      });
    });

    // Write input to stdin and close
    if (child.stdin) {
      // Handle EPIPE error when command exits before we finish writing
      // This is expected when command doesn't exist or fails immediately
      child.stdin.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code !== 'EPIPE') {
          // Only reject on non-EPIPE errors
          reject(new ShellError(`Failed to write to stdin: ${err.message}`, command));
        }
        // EPIPE is ignored - the 'close' event will still fire with the exit code
      });
      child.stdin.write(input);
      child.stdin.end();
    }
  });
}

/**
 * Extract the command from a shell escape line
 * Removes the leading `!` and trims whitespace
 */
export function extractShellCommand(input: string): string {
  const trimmed = input.trimStart();
  if (!trimmed.startsWith('!')) {
    throw new ShellError('Not a shell escape command', input);
  }
  return trimmed.slice(1).trim();
}
