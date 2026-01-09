/**
 * Shell escape and piping support
 *
 * Provides:
 * - `!cmd args` - Shell escape (spawn external command)
 * - `expr | cmd` - Pipe expression result to external command
 *
 * Uses node-pty for both shell escapes and piping to create a real
 * pseudo-terminal, so external commands see isatty() = true and output
 * colors naturally (jq, git, ls, etc.)
 *
 * For piping, we use printf '%s' to pass input to the command since
 * PTY doesn't handle stdin piping well directly.
 */

import * as pty from 'node-pty';
import { shouldPreserveExternalColors } from '../workspace/settings/store.js';

/**
 * Result of executing a shell command
 */
export interface ShellResult {
  /** Exit code (0 = success) */
  exitCode: number;
  /** Standard output (combined stdout+stderr in PTY mode) */
  stdout: string;
  /** Standard error (empty in PTY mode, kept for API compatibility) */
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
 * Get the shell to use for PTY
 */
function getShell(): string {
  if (process.platform === 'win32') {
    return process.env['COMSPEC'] ?? 'cmd.exe';
  }
  return process.env['SHELL'] ?? '/bin/sh';
}

/**
 * Get shell args for executing a command
 */
function getShellArgs(command: string): string[] {
  if (process.platform === 'win32') {
    return ['/c', command];
  }
  return ['-c', command];
}

/**
 * Build environment for PTY
 *
 * Uses the NO_COLOR standard (https://no-color.org/) to disable colors
 * when the externalColors setting is false. When enabled, we don't set
 * anything - the PTY naturally provides isatty()=true so programs
 * output colors by default.
 */
function buildPtyEnv(): { [key: string]: string } {
  const env: { [key: string]: string } = {};

  // Copy current environment
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }

  // When colors are disabled, use the NO_COLOR standard
  if (!shouldPreserveExternalColors()) {
    env['NO_COLOR'] = '1';
  }

  return env;
}

/**
 * Execute a shell command without stdin using PTY
 *
 * The command runs in a real pseudo-terminal, so programs like
 * jq, git, ls will output colors without needing special flags.
 *
 * @param command - Full command string (will be executed via shell)
 * @returns Promise resolving to ShellResult
 * @throws ShellError if command cannot be executed
 */
export function executeShellCommand(command: string): Promise<ShellResult> {
  return new Promise((resolve, reject) => {
    try {
      const shell = getShell();
      const args = getShellArgs(command);

      const ptyProcess = pty.spawn(shell, args, {
        name: 'xterm-256color',
        cols: process.stdout.columns ?? 80,
        rows: process.stdout.rows ?? 24,
        cwd: process.cwd(),
        env: buildPtyEnv(),
      });

      let output = '';

      ptyProcess.onData((data: string) => {
        output += data;
      });

      ptyProcess.onExit(({ exitCode }) => {
        resolve({
          exitCode: exitCode ?? 0,
          stdout: output,
          stderr: '', // PTY combines stdout/stderr
        });
      });
    } catch (error) {
      const err = error as Error;
      reject(new ShellError(`Failed to execute: ${err.message}`, command));
    }
  });
}

/**
 * Escape a string for use inside single quotes in shell
 * Single quote becomes: '\'' (end quote, escaped quote, start quote)
 */
function escapeForShellSingleQuotes(input: string): string {
  return input.replace(/'/g, "'\\''");
}

/**
 * Execute a shell command with stdin input using PTY and printf
 *
 * Uses PTY with printf to provide a real TTY environment so commands
 * like jq, grep --color, etc. output colors naturally.
 *
 * The command is constructed as:
 *   printf '%s' 'escaped-input' | command
 *
 * Using printf '%s' instead of echo because:
 * - No interpretation of escape sequences (\n stays literal)
 * - No trailing newline added
 * - Predictable behavior across shells
 *
 * @param input - Data to pipe to the command
 * @param command - Shell command to execute
 * @returns Promise resolving to ShellResult
 * @throws ShellError if command cannot be executed
 */
export function pipeToCommand(input: string, command: string): Promise<ShellResult> {
  return new Promise((resolve, reject) => {
    try {
      const shell = getShell();

      // Escape single quotes in input for shell
      const escaped = escapeForShellSingleQuotes(input);

      // Build command: printf '%s' 'input' | command
      const printfCommand = `printf '%s' '${escaped}' | ${command}`;

      const args = getShellArgs(printfCommand);

      const ptyProcess = pty.spawn(shell, args, {
        name: 'xterm-256color',
        cols: process.stdout.columns ?? 80,
        rows: process.stdout.rows ?? 24,
        cwd: process.cwd(),
        env: buildPtyEnv(),
      });

      let output = '';

      ptyProcess.onData((data: string) => {
        output += data;
      });

      ptyProcess.onExit(({ exitCode }) => {
        resolve({
          exitCode: exitCode ?? 0,
          stdout: output,
          stderr: '', // PTY combines stdout/stderr
        });
      });
    } catch (error) {
      const err = error as Error;
      reject(new ShellError(`Failed to execute: ${err.message}`, command));
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
